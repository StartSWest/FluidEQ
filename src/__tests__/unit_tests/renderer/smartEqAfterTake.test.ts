/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ANALYSIS_BINS } from 'common/dsp/analysisWire';
import type { IHostAnalysis } from 'common/dsp/analysisWire';
import {
  IMeasurementOptions,
  measureSource,
} from 'renderer/audio/smartEqMeasurement';

/**
 * After the take, the tap is only time (`onAfterTake`): Smart correction
 * walks the last of its curve in on the music's own half seconds instead of
 * a timer, and nothing more is measured meanwhile.
 */

let deliver: ((frame: IHostAnalysis) => void) | undefined;
let unsubscribed = 0;
let now = 0;

const FRAME_MS = (ANALYSIS_BINS * 2 * 1000) / 48000;

const windowOf = (index: number, isSilent = false): Float32Array => {
  const bins = new Float32Array(ANALYSIS_BINS);
  for (let bin = 0; bin < ANALYSIS_BINS; bin += 1) {
    const frequency = Math.max(20, (bin * 48000) / (ANALYSIS_BINS * 2));
    bins[bin] = isSilent
      ? -160
      : -20 -
        11 * Math.log10(Math.max(frequency, 80) / 80) +
        Math.sin(index * 12.9898 + bin * 78.233) * 1.5 +
        4 * Math.sin(index * 4.1414);
  }
  return bins;
};

const frames = (count: number, from: number, isSilent = false) => {
  for (let index = 0; index < count; index += 1) {
    now += FRAME_MS;
    deliver?.({
      sequence: from + index,
      spectra: { denoise: windowOf(from + index, isSilent) },
      correlation: 1,
      peaks: [0.5, 0.5],
    } as unknown as IHostAnalysis);
  }
};

const settle = async () => {
  for (let tick = 0; tick < 4; tick += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

const open = async (options: Partial<IMeasurementOptions>) => {
  const controller = new AbortController();
  const seen = { reports: 0, previews: 0, after: [] as boolean[] };
  const measurement = measureSource(
    {
      source: 'host',
      signal: controller.signal,
      onReport: () => {
        seen.reports += 1;
      },
      onPreview: () => {
        seen.previews += 1;
      },
      ...options,
    },
    (key: string) => key,
  );
  measurement.done.catch(() => undefined);
  await settle();
  return { controller, measurement, seen };
};

/** Frames for this much music. */
const framesFor = (ms: number) => Math.ceil(ms / FRAME_MS);
/** Frame intervals that make half a second of music. */
const HALF_SECOND = Math.ceil(500 / FRAME_MS);

beforeEach(() => {
  deliver = undefined;
  unsubscribed = 0;
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
            unsubscribed += 1;
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

describe('a measurement after its take', () => {
  it('keeps the tap after a hold, as a half second of music at a time', async () => {
    const after: boolean[] = [];
    const { controller, measurement, seen } = await open({
      isContinuous: true,
      onAfterTake: (isLast) => after.push(isLast),
    });
    frames(framesFor(3000), 0);
    // The control: it was measuring before the hold.
    expect(seen.reports).toBeGreaterThan(0);
    const { reports, previews } = seen;

    measurement.hold();
    // The first frame after the hold starts the count; each half second is
    // that many intervals after it.
    frames(4 * HALF_SECOND + 1, 1000);

    // Four half seconds of music, and nothing more measured.
    expect(after).toEqual([false, false, false, false]);
    expect(seen.reports).toBe(reports);
    expect(seen.previews).toBe(previews);
    expect(unsubscribed).toBe(0);

    // Silence buys no time.
    frames(framesFor(2000), 2000, true);
    expect(after).toHaveLength(4);

    controller.abort();
    expect(unsubscribed).toBe(1);
  });

  it('closes the tap at a hold when nothing walks on it', async () => {
    const { measurement } = await open({ isContinuous: true });
    frames(framesFor(1000), 0);
    const ended = measurement.done.then(
      () => 'resolved',
      (error: unknown) => (error as DOMException).name,
    );
    measurement.hold();
    expect(unsubscribed).toBe(1);
    expect(await ended).toBe('AbortError');
  });

  it('keeps a one-shot’s tap past its answer while something walks on it', async () => {
    const after: boolean[] = [];
    const { controller, measurement } = await open({
      onAfterTake: (isLast) => after.push(isLast),
    });
    let answered = false;
    measurement.done.then(
      () => {
        answered = true;
        return undefined;
      },
      () => undefined,
    );
    // Past the one-shot's backstop, so it answers whatever it heard.
    frames(framesFor(40000), 0);
    await settle();
    expect(answered).toBe(true);
    expect(unsubscribed).toBe(0);
    const afterAnswer = after.length;
    frames(framesFor(1000), 9000);
    // A second of music is two half seconds, or three with what was left
    // over from before it; none of them the last.
    expect([2, 3]).toContain(after.length - afterAnswer);
    expect(after.every((isLast) => !isLast)).toBe(true);
    controller.abort();
    expect(unsubscribed).toBe(1);
  });

  it('closes a one-shot’s tap at its answer otherwise', async () => {
    const { measurement } = await open({});
    let answered = false;
    measurement.done.then(
      () => {
        answered = true;
        return undefined;
      },
      () => undefined,
    );
    frames(framesFor(40000), 0);
    await settle();
    expect(answered).toBe(true);
    expect(unsubscribed).toBe(1);
  });
});
