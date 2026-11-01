/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISystemSoundBlock } from '../../core/systemSound/systemSound';

/**
 * The signal Chromium's analyser readings were taken over
 * (`.erb/scripts/generate-analyser-reference.cjs`, which writes it out again
 * for the page it runs in): seeded noise on both sides, 440 Hz on the left,
 * 1 kHz on the right and 60 Hz under both, in single precision.
 */
export const SIGNAL_RATE = 48000;
export const SIGNAL_LENGTH = 16384;

export interface IStereoSignal {
  left: Float32Array;
  right: Float32Array;
}

export const analyserSignal = (): IStereoSignal => {
  // mulberry32, exactly as the page runs it.
  let seed = 0x5eed1234;
  /* eslint-disable no-bitwise -- the generator is defined in 32-bit integer
   * operations, and has to be the page's to the bit or the readings are of
   * another signal. */
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /* eslint-enable no-bitwise */
  const tone = (frequency: number, n: number) =>
    Math.sin((2 * Math.PI * frequency * n) / SIGNAL_RATE);
  const left = new Float32Array(SIGNAL_LENGTH);
  const right = new Float32Array(SIGNAL_LENGTH);
  for (let n = 0; n < SIGNAL_LENGTH; n += 1) {
    left[n] = Math.fround(
      (random() * 2 - 1) * 0.05 + 0.5 * tone(440, n) + 0.2 * tone(60, n),
    );
    right[n] = Math.fround(
      (random() * 2 - 1) * 0.05 + 0.25 * tone(1000, n) + 0.2 * tone(60, n),
    );
  }
  return { left, right };
};

/**
 * Frames `from` to `until` of `signal` as the core hears blocks: interleaved,
 * in blocks of `blockFrames` and a shorter last one, so a history's
 * wrap-around lands mid-block.
 */
export const signalBlocks = (
  signal: IStereoSignal,
  from: number,
  until: number,
  blockFrames = 333,
): ISystemSoundBlock[] => {
  const blocks: ISystemSoundBlock[] = [];
  for (let at = from; at < until; at += blockFrames) {
    const frames = Math.min(blockFrames, until - at);
    const pcm = new Float32Array(frames * 2);
    for (let frame = 0; frame < frames; frame += 1) {
      pcm[frame * 2] = signal.left[at + frame];
      pcm[frame * 2 + 1] = signal.right[at + frame];
    }
    blocks.push({
      sampleRate: SIGNAL_RATE,
      channels: 2,
      frames,
      sequence: blocks.length,
      pcm: pcm.buffer,
    });
  }
  return blocks;
};
