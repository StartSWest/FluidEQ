/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ANALYSIS_BINS } from 'common/dsp/analysisWire';
import type { IHostAnalysis } from 'common/dsp/analysisWire';
import { measureSource } from 'renderer/audio/smartEqMeasurement';
import type { IBalanceReport } from 'renderer/utils/autoBalanceCapture';
import { SONG_LISTEN_BOUNDS, isReadyToHold } from 'renderer/utils/smartEqHold';

/**
 * A Library song, from the playback host's frames to a held correction.
 *
 * Smart correction hears a Library song through the host's analysis frames,
 * reading the rack-input spectrum (`spectra.denoise`). Under the FluidEQ
 * Engine the host plays the Library raw and its frames carried no such
 * spectrum, so the measurement heard nothing and said "Listening" for the
 * whole song (2026-11-20). The control is the same song in frames that carry
 * only the master tap — what the raw route sent — which must hear nothing:
 * that is what proves the measurement reads the tap and not merely any frame.
 */

let deliver: ((frame: IHostAnalysis) => void) | undefined;
let now = 0;

const FRAME_MS = (ANALYSIS_BINS * 2 * 1000) / 48000;

/** A record's spectrum for one window: a falling tilt with frame noise. */
const songWindow = (index: number): Float32Array => {
  const bins = new Float32Array(ANALYSIS_BINS);
  for (let bin = 0; bin < ANALYSIS_BINS; bin += 1) {
    const frequency = Math.max(20, (bin * 48000) / (ANALYSIS_BINS * 2));
    // Deterministic, so the test is the same on every run.
    const noise = Math.sin(index * 12.9898 + bin * 78.233) * 3;
    bins[bin] = -18 - 4.5 * Math.log2(frequency / 100) + noise;
  }
  return bins;
};

const hostFrame = (index: number, stage: 'denoise' | 'master'): IHostAnalysis =>
  ({
    sequence: index,
    spectra: { [stage]: songWindow(index) },
    correlation: 1,
    peaks: [0.5, 0.5],
  }) as unknown as IHostAnalysis;

/** Plays `seconds` of the song as host frames carrying `stage`. */
const play = async (seconds: number, stage: 'denoise' | 'master') => {
  const reports: IBalanceReport[] = [];
  const controller = new AbortController();
  const measurement = measureSource(
    {
      source: 'host',
      signal: controller.signal,
      isContinuous: true,
      ...SONG_LISTEN_BOUNDS,
      onReport: (report) => reports.push(report),
    },
    (key: string) => key,
  );
  measurement.done.catch(() => undefined);
  // The tap is claimed asynchronously; let it open.
  for (let tick = 0; tick < 4; tick += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
  const frames = Math.round((seconds * 1000) / FRAME_MS);
  for (let index = 0; index < frames; index += 1) {
    now += FRAME_MS;
    deliver?.(hostFrame(index, stage));
  }
  controller.abort();
  return reports;
};

beforeEach(() => {
  deliver = undefined;
  jest.spyOn(performance, 'now').mockImplementation(() => now);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        setDspHostAnalysis: () => Promise.resolve(true),
        onDspHostAnalysis: (listener: (frame: IHostAnalysis) => void) => {
          deliver = listener;
          return () => {
            deliver = undefined;
          };
        },
      },
    },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Smart correction on a Library song', () => {
  it('hears nothing from frames without the rack-input tap (control)', async () => {
    const reports = await play(30, 'master');
    expect(reports).toHaveLength(0);
  });

  it('hears the song from the tap and holds it', async () => {
    const reports = await play(90, 'denoise');
    expect(reports.length).toBeGreaterThan(0);
    expect(reports[reports.length - 1].listenedMs).toBeGreaterThan(10000);
    const held = reports.find(isReadyToHold);
    expect(held).toBeDefined();
    // Held within the running mode's backstop, never later.
    expect((held as IBalanceReport).listenedMs).toBeLessThanOrEqual(
      (SONG_LISTEN_BOUNDS.maxListenMs ?? 0) + 1000,
    );
  });
});
