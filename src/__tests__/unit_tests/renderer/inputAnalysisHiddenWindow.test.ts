/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A track measured while the window paints nothing.
 *
 * The main window runs no animation frames while it is minimised or covered,
 * and the analysis used to wait for one after every second of audio: it
 * parked after its first second holding the whole decoded file, and could not
 * see the abort of the job that replaced it until the window came back.
 */

import { MessageChannel as NodeMessageChannel } from 'worker_threads';
import { analyzeInputTrack } from 'renderer/dsp/inputNormalizer';

const RATE = 48_000;
const SECONDS = 3;

/** A 1 kHz sine at a quarter of full scale on both channels: -12.04 LUFS. */
const decodedTone = (): AudioBuffer => {
  const length = RATE * SECONDS;
  const samples = Float32Array.from(
    { length },
    (_, index) => 0.25 * Math.sin((2 * Math.PI * 1000 * index) / RATE),
  );
  return {
    sampleRate: RATE,
    length,
    duration: SECONDS,
    numberOfChannels: 2,
    getChannelData: () => samples,
  } as unknown as AudioBuffer;
};

/** Called with `new`, which hands back the object it returns. */
function FakeAudioContext() {
  return {
    decodeAudioData: () => Promise.resolve(decodedTone()),
    close: () => Promise.resolve(),
  };
}

/** Frames asked for, which run only when the test paints. */
let frames: Map<number, FrameRequestCallback>;
let lastFrame: number;
const paint = () => {
  const due = Array.from(frames.values());
  frames.clear();
  due.forEach((callback) => callback(0));
};

beforeEach(() => {
  Object.assign(globalThis, {
    AudioContext: FakeAudioContext,
    MessageChannel: NodeMessageChannel,
  });
  frames = new Map();
  lastFrame = 0;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    lastFrame += 1;
    frames.set(lastFrame, callback);
    return lastFrame;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  Reflect.deleteProperty(globalThis, 'AudioContext');
  Reflect.deleteProperty(globalThis, 'MessageChannel');
});

const options = (
  overrides: Partial<Parameters<typeof analyzeInputTrack>[1]> = {},
) => ({
  sampleRateHint: RATE,
  signal: new AbortController().signal,
  isCancelled: () => false,
  onProgress: () => undefined,
  ...overrides,
});

it('measures to the end in a window that paints nothing', async () => {
  const reported: number[] = [];
  const analysis = await analyzeInputTrack(
    new ArrayBuffer(8),
    options({ onProgress: ({ fraction }) => reported.push(fraction) }),
  );
  // The positive control: the whole file was measured, not a first second.
  expect(analysis?.integratedLufs).toBeCloseTo(-12.04, 1);
  // Nothing was painted, so nothing was reported but the end.
  expect(reported).toEqual([1]);
});

it('lets go of a cancelled job with no frame to wake it', async () => {
  const controller = new AbortController();
  // The first chunk asks for a frame to report on; the track changing there
  // is the queue moving on mid-measurement.
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => {
    controller.abort();
    return 1;
  });
  const analysis = await analyzeInputTrack(
    new ArrayBuffer(8),
    options({ signal: controller.signal }),
  );
  expect(analysis).toBeUndefined();
});

it('reports once per painted frame, and nothing after its last fraction', async () => {
  const reported: number[] = [];
  let chunks = 0;
  const analysis = await analyzeInputTrack(
    new ArrayBuffer(8),
    options({
      // Asked once a chunk: a paint every tenth one.
      isCancelled: () => {
        chunks += 1;
        if (chunks % 10 === 0) {
          paint();
        }
        return false;
      },
      onProgress: ({ fraction }) => reported.push(fraction),
    }),
  );
  expect(analysis).toBeDefined();
  expect(reported.length).toBeGreaterThan(1);
  expect(reported.length).toBeLessThan(chunks);
  expect(reported).toEqual([...reported].sort((a, b) => a - b));
  expect(reported[reported.length - 1]).toBe(1);
  // A frame after the end must not put the panel back on "analysing".
  const settled = reported.length;
  paint();
  expect(reported).toHaveLength(settled);
});
