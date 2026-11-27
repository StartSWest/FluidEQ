/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ANALYSIS_BINS } from 'common/dsp/analysisWire';
import type { IHostAnalysis } from 'common/dsp/analysisWire';
import { smartEqResponse } from 'common/smartEqContinuous';
import { measureSource } from 'renderer/audio/smartEqMeasurement';
import type { IBalanceReport } from 'renderer/utils/autoBalanceCapture';
import { SONG_LISTEN_BOUNDS } from 'renderer/utils/smartEqHold';
import { SMART_EQ_LAYOUT, solveSmartEq } from 'renderer/utils/smartEqSolve';

/**
 * Smart correction's curve keeps its shape while it forms, through the
 * full-band gate's holds.
 *
 * Seen live on 2026-11-20: the curve forming on the graph jumped to another
 * shape mid-settle (3.7 dB at 40 Hz where it had shown 1.3). It was drawn
 * from a second accumulator through the gate's holds and from the
 * measurement otherwise, and the two had not counted the same frames: a hold
 * the record ends throws its frames away in the measurement and kept them in
 * the second one, so the curve went back and forth between two answers.
 */

let deliver: ((frame: IHostAnalysis) => void) | undefined;
let now = 0;

const FRAME_MS = (ANALYSIS_BINS * 2 * 1000) / 48000;

type TRecord = 'no-air' | 'breakdowns';

/**
 * The presence lines' own idea of a record — flat to 80 Hz, then 11 dB a
 * decade down (`expectedLevelDb`) — with a dip in the mids for the
 * correction to lift and windows that move by a few decibels.
 *
 * `no-air`: nothing over 8.8 kHz, so the gate holds from the first window
 * and runs out at twenty seconds. `breakdowns`: the whole band, but the bass
 * drops out for three seconds twice, so the gate holds and the record ends
 * the hold — the frames in between, with the mids standing out against a
 * frame that lost its bass, are thrown away.
 */
const songWindow = (index: number, record: TRecord): Float32Array => {
  const bins = new Float32Array(ANALYSIS_BINS);
  const seconds = (index * FRAME_MS) / 1000;
  const breakdown =
    record === 'breakdowns' &&
    ((seconds >= 12 && seconds < 15) || (seconds >= 26 && seconds < 29));
  const movement = 4 * Math.sin(index * 4.1414);
  for (let bin = 0; bin < ANALYSIS_BINS; bin += 1) {
    const frequency = Math.max(20, (bin * 48000) / (ANALYSIS_BINS * 2));
    const noise = Math.sin(index * 12.9898 + bin * 78.233) * 1.5;
    const dip = frequency >= 500 && frequency <= 2500 ? -6 : 0;
    const absent =
      (record === 'no-air' && frequency > 8800) ||
      (breakdown && frequency < 150);
    bins[bin] = absent
      ? -160
      : -20 -
        11 * Math.log10(Math.max(frequency, 80) / 80) +
        noise +
        movement +
        dip;
  }
  return bins;
};

const curveOf = (report: IBalanceReport) => {
  const gains = solveSmartEq(report);
  return gains ? smartEqResponse(SMART_EQ_LAYOUT, gains) : undefined;
};

const widestGap = (a: number[], b: number[]) =>
  a.reduce(
    (widest, level, point) => Math.max(widest, Math.abs(b[point] - level)),
    0,
  );

/** The widest move between one drawn curve and the next. */
const widestStep = (
  previews: Array<{ curve: number[] | undefined }>,
): number => {
  const drawn = previews.filter((preview) => preview.curve !== undefined);
  let widest = 0;
  for (let index = 1; index < drawn.length; index += 1) {
    widest = Math.max(
      widest,
      widestGap(
        drawn[index - 1].curve as number[],
        drawn[index].curve as number[],
      ),
    );
  }
  return widest;
};

/** Forty seconds of a record through the real measurement. */
const play = async (record: TRecord) => {
  const previews: Array<{ heardMs: number; curve: number[] | undefined }> = [];
  const reports: IBalanceReport[] = [];
  const controller = new AbortController();
  const measurement = measureSource(
    {
      source: 'host',
      signal: controller.signal,
      isContinuous: true,
      ...SONG_LISTEN_BOUNDS,
      onReport: (report) => reports.push(report),
      onPreview: ({ report, heardMs }) =>
        previews.push({ heardMs, curve: curveOf(report) }),
    },
    (key: string) => key,
  );
  measurement.done.catch(() => undefined);
  for (let tick = 0; tick < 4; tick += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
  const frames = Math.round(40000 / FRAME_MS);
  for (let index = 0; index < frames; index += 1) {
    now += FRAME_MS;
    deliver?.({
      sequence: index,
      spectra: { denoise: songWindow(index, record) },
      correlation: 1,
      peaks: [0.5, 0.5],
    } as unknown as IHostAnalysis);
  }
  controller.abort();
  return { previews, reports };
};

beforeEach(() => {
  deliver = undefined;
  now = 0;
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

describe("Smart correction's forming curve through the gate", () => {
  it('forms through a hold that opens the song and hands over unchanged', async () => {
    const { previews, reports } = await play('no-air');

    // The control: the gate held from the start, ran out, and the
    // measurement took in the whole hold in its first report.
    const handover = reports.findIndex(
      (report, index) =>
        report.listenedMs - (index > 0 ? reports[index - 1].listenedMs : 0) >
        15000,
    );
    expect(handover).toBe(0);
    const handoverHeardMs = reports[handover].listenedMs;

    // It formed while the measurement waited.
    expect(
      previews.some(
        (preview) =>
          preview.curve !== undefined && preview.heardMs < handoverHeardMs,
      ),
    ).toBe(true);
    // And what was drawn just before the hand-over is what the measurement
    // gives just after it.
    const before = [...previews]
      .reverse()
      .find(
        (preview) =>
          preview.curve !== undefined && preview.heardMs < handoverHeardMs,
      );
    expect(
      widestGap(
        before?.curve as number[],
        curveOf(reports[handover]) as number[],
      ),
    ).toBeLessThan(0.1);
    expect(
      widestStep(previews.filter((preview) => preview.heardMs > 6000)),
    ).toBeLessThan(0.5);
  });

  it('never jumps through breakdowns the record ends', async () => {
    const { previews, reports } = await play('breakdowns');

    // The control: the gate did hold mid-song and the record ended each
    // hold, so the measurement threw those frames away — of forty seconds
    // played it learned from well under forty, and from more than the
    // breakdowns leave out.
    const learned = reports[reports.length - 1].listenedMs;
    expect(learned).toBeLessThan(37000);
    expect(learned).toBeGreaterThan(25000);
    // The seconds heard never count backwards.
    const backwards = previews.filter(
      (preview, index) =>
        index > 0 && preview.heardMs < previews[index - 1].heardMs,
    );
    expect(backwards).toHaveLength(0);

    // After the first seconds, while the ranges fill, the drawn curve never
    // goes back. 0.65 dB is the half second before the gate hears a
    // breakdown, which the measurement learns from and the graph glides over;
    // drawing the held frames and dropping them when the bass returns moved
    // it 1.6 dB.
    const settled = previews.filter((preview) => preview.heardMs > 6000);
    expect(widestStep(settled)).toBeLessThan(0.9);
  });
});
