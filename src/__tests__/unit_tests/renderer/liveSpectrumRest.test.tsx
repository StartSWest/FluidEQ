/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The capture going quiet when the output does.
 *
 * A visible window never went idle: the pump published a new waveform and a
 * new pair of levels thirty times a second through any silence, so every
 * consumer of the frame re-rendered and both meters redrew the same rest for
 * as long as the window was open. Nothing on screen showed it — a silent frame
 * looks like the last one — so what is held here is the publishing itself:
 * silence publishes until the meters are down, then one resting frame, then
 * nothing, and the first loud frame is published again.
 *
 * The capture is Windows loopback and cannot run here, so the Web Audio pieces
 * are stand-ins whose every sample is the one number the test sets
 * (`fakeLiveCapture.ts`). The pump's clock is the audio clock, ticked by hand;
 * the fake timers only move `performance.now()`, which the meters' ballistics
 * read, and nothing in the capture may leave a timer behind.
 */

import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import {
  SILENT_WAVEFORM,
  UPDATE_INTERVAL_MS,
  isMeterAtRest,
} from 'renderer/graph/liveSpectrumFrames';
import { IOutputLevel, LEVEL_FLOOR_DB } from 'renderer/graph/outputLevel';
import useLiveOutputSpectrum from 'renderer/graph/useLiveOutputSpectrum';
import {
  installFakeCapture,
  signal,
  tickAudio,
  uninstallFakeCapture,
} from '../../utils/fakeLiveCapture';

jest.mock('renderer/graph/liveFrameReader', () => ({
  connectDrawAnalyser: () => ({}),
  createLiveFrameReader: () => ({
    read: () => ({
      points: [],
      graphPoints: [],
      waveform: [],
      channelPeaks: [],
    }),
  }),
}));
jest.mock('renderer/graph/liveGraphBand', () => ({
  ...jest.requireActual('renderer/graph/liveGraphBand'),
  createLiveGraphBand: () => ({}),
}));

interface IPublished {
  atMs: number;
  waveform: number[];
  outputLevels: IOutputLevel[];
}

let published: IPublished[] = [];
let control: ReturnType<typeof useLiveOutputSpectrum>['control'] | undefined;

/** A meter's worth of consumer: it claims the capture and notes each frame. */
function Probe() {
  const spectrum = useLiveOutputSpectrum();
  control = spectrum.control;
  const { claim } = spectrum.control;
  const { waveform, outputLevels } = spectrum.frame;
  useEffect(() => claim('display'), [claim]);
  useEffect(() => {
    published.push({ atMs: performance.now(), waveform, outputLevels });
  }, [waveform, outputLevels]);
  return null;
}

/** Everything the capture's start awaits, which no timer advances. */
const settle = async () => {
  await act(async () => {
    for (let turn = 0; turn < 40; turn += 1) {
      // eslint-disable-next-line no-await-in-loop -- each turn is one microtask of the start's await chain
      await Promise.resolve();
    }
  });
};

/**
 * One tick of the audio clock per step: a thirtieth of a second of audio, and
 * the same of wall time for the meters' ballistics.
 */
const tick = (count = 1) => {
  for (let step = 0; step < count; step += 1) {
    act(() => {
      jest.advanceTimersByTime(UPDATE_INTERVAL_MS);
      tickAudio(UPDATE_INTERVAL_MS);
    });
  }
};

const ticksIn = (ms: number) => Math.ceil(ms / UPDATE_INTERVAL_MS);

beforeAll(() => {
  installFakeCapture();
});

afterAll(() => {
  uninstallFakeCapture();
});

beforeEach(async () => {
  // Microtasks left real, so the count below is of timers alone: React queues
  // its own work as microtasks, and a faked one counts as a timer.
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
  published = [];
  signal.amplitude = 0.5;
  render(<Probe />);
  await settle();
  if (!control?.isActive) {
    throw new Error('The stand-in capture did not start.');
  }
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the live capture on the audio clock', () => {
  it('runs no timer of its own, and publishes a frame on every tick of audio', () => {
    // The pump was a 33 ms interval, which a minimised window throttles to
    // once a second and then once a minute. Nothing of the capture's is left
    // on the window's timers now.
    expect(jest.getTimerCount()).toBe(0);

    // POSITIVE CONTROL: the audio clock alone drives it.
    const before = published.length;
    act(() => {
      tickAudio(UPDATE_INTERVAL_MS);
    });
    expect(published.length).toBe(before + 1);
    act(() => {
      tickAudio(UPDATE_INTERVAL_MS);
    });
    act(() => {
      tickAudio(UPDATE_INTERVAL_MS);
    });
    expect(published.length).toBe(before + 3);

    // And a wall clock moving with no audio is nothing to it.
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(published.length).toBe(before + 3);
  });
});

describe('the live capture in silence', () => {
  it('publishes until the meters are down, then one resting frame, then nothing', () => {
    tick(10);
    const beforeSilence = published.length;
    // POSITIVE CONTROL: sound is published on every tick.
    expect(beforeSilence).toBeGreaterThanOrEqual(10);

    signal.amplitude = 0;
    const silenceFrom = performance.now();
    tick(ticksIn(20_000));

    const silent = published.slice(beforeSilence);
    const resting = silent.filter(
      (frame) => frame.waveform === SILENT_WAVEFORM,
    );
    expect(resting).toHaveLength(1);
    const last = silent[silent.length - 1];
    // The resting frame is the last one, and it says rest everywhere.
    expect(last.waveform).toBe(SILENT_WAVEFORM);
    last.outputLevels.forEach((level) => {
      expect(level.levelDb).toBe(LEVEL_FLOOR_DB);
      expect(level.peakDb).toBe(LEVEL_FLOOR_DB);
      expect(level.isClipping).toBe(false);
    });
    // Published all the way down: a -6 dBFS peak holds for a second and
    // falls at 12 dB a second, so the floor is five and a half seconds off.
    expect(last.atMs - silenceFrom).toBeGreaterThan(5_000);
    expect(last.atMs - silenceFrom).toBeLessThan(7_000);
    // And nothing after it, for the fourteen seconds that followed.
    expect(performance.now() - last.atMs).toBeGreaterThan(13_000);
  });

  it('publishes the first loud frame when sound returns', () => {
    signal.amplitude = 0;
    tick(ticksIn(10_000));
    const rested = published.length;
    expect(published[rested - 1].waveform).toBe(SILENT_WAVEFORM);

    signal.amplitude = 0.5;
    tick();
    expect(published).toHaveLength(rested + 1);
    const back = published[rested];
    expect(back.waveform).not.toBe(SILENT_WAVEFORM);
    expect(Math.max(...back.waveform)).toBeCloseTo(0.5, 5);
    expect(back.outputLevels[0].levelDb).toBeGreaterThan(LEVEL_FLOOR_DB);

    // A new identity on every tick after it, or React would draw none of them.
    tick(3);
    expect(published).toHaveLength(rested + 4);
  });

  it('keeps publishing through silence while a measurement is running', async () => {
    const abort = new AbortController();
    const running = control?.captureBalanceProfile({
      isContinuous: true,
      signal: abort.signal,
    });
    signal.amplitude = 0;
    tick(ticksIn(10_000));
    const quietFrom = published.length;

    // Smart EQ's countdown on the graph is worked out on these frames.
    tick(30);
    expect(published.length - quietFrom).toBe(30);

    act(() => abort.abort());
    await expect(running).rejects.toThrow();
  });

  it('still says the output has come to rest while a measurement runs through the quiet', async () => {
    const abort = new AbortController();
    const running = control?.captureBalanceProfile({
      isContinuous: true,
      signal: abort.signal,
    });
    tick(10);
    signal.amplitude = 0;
    // POSITIVE CONTROL: falling, the meters are not at rest yet.
    tick(3);
    expect(published[published.length - 1].waveform).not.toBe(SILENT_WAVEFORM);

    // Down on the floor: the resting waveform, which is how the graph learns
    // the music stopped (`SilenceWatch`), while the levels keep coming.
    tick(ticksIn(10_000));
    const quietFrom = published.length;
    expect(published[quietFrom - 1].waveform).toBe(SILENT_WAVEFORM);
    tick(5);
    expect(published.length - quietFrom).toBe(5);
    published.slice(quietFrom).forEach((frame) => {
      expect(frame.waveform).toBe(SILENT_WAVEFORM);
    });

    act(() => abort.abort());
    await expect(running).rejects.toThrow();
  });
});

describe('a meter frame at rest', () => {
  const floor: IOutputLevel = {
    levelDb: LEVEL_FLOOR_DB,
    peakDb: LEVEL_FLOOR_DB,
    isClipping: false,
  };

  it('is digital silence with every reading on the floor', () => {
    expect(isMeterAtRest([0, 0, 0], [floor, floor])).toBe(true);
  });

  it('is not a quiet window, a held peak, a level or a clip warning', () => {
    // A sample far under the meter's floor still draws on the titlebar.
    expect(isMeterAtRest([0, 0.0001, 0], [floor, floor])).toBe(false);
    expect(isMeterAtRest([0, 0, 0], [floor, { ...floor, peakDb: -59 }])).toBe(
      false,
    );
    expect(isMeterAtRest([0, 0, 0], [{ ...floor, levelDb: -40 }, floor])).toBe(
      false,
    );
    expect(
      isMeterAtRest([0, 0, 0], [floor, { ...floor, isClipping: true }]),
    ).toBe(false);
  });
});
