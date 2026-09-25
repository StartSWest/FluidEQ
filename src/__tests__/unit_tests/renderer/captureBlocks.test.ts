/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  keepNewestSamples,
  readCaptureBlock,
} from 'renderer/audio/captureBlocks';

const bufferOf = (values: number[]) => new Float32Array(values).buffer;

describe('readCaptureBlock', () => {
  it('reads a block as the capture processor posts it', () => {
    const block = readCaptureBlock({
      channels: 2,
      frames: 2,
      pcm: bufferOf([1, 2, 3, 4]),
      sequence: 7,
    });
    expect(block?.channels).toBe(2);
    expect(block?.frames).toBe(2);
    expect(Array.from(block?.pcm ?? [])).toEqual([1, 2, 3, 4]);
  });

  it.each([
    ['nothing', undefined],
    ['three channels', { channels: 3, frames: 1, pcm: bufferOf([1, 2, 3]) }],
    ['no frames', { channels: 1, frames: 0, pcm: bufferOf([]) }],
    ['a fraction of a frame', { channels: 1, frames: 1.5, pcm: bufferOf([1]) }],
    [
      'samples that do not fill it',
      { channels: 2, frames: 2, pcm: bufferOf([1, 2, 3]) },
    ],
    ['samples that are not a buffer', { channels: 1, frames: 1, pcm: [1] }],
  ])('refuses %s', (_name, data) => {
    expect(readCaptureBlock(data)).toBeUndefined();
  });
});

describe('keepNewestSamples', () => {
  it('adds a block to the end of each channel, oldest first', () => {
    const left = new Float32Array([1, 2, 3, 4]);
    const right = new Float32Array([5, 6, 7, 8]);
    keepNewestSamples(left, right, {
      channels: 2,
      frames: 2,
      pcm: new Float32Array([10, 20, 11, 21]),
    });
    expect(Array.from(left)).toEqual([3, 4, 10, 11]);
    expect(Array.from(right)).toEqual([7, 8, 20, 21]);
  });

  it('spreads a single channel to both', () => {
    const left = new Float32Array(3);
    const right = new Float32Array(3);
    keepNewestSamples(left, right, {
      channels: 1,
      frames: 2,
      pcm: new Float32Array([4, 5]),
    });
    expect(Array.from(left)).toEqual([0, 4, 5]);
    expect(Array.from(right)).toEqual([0, 4, 5]);
  });

  it('keeps only the newest of a block longer than the history', () => {
    const left = new Float32Array(2);
    const right = new Float32Array(2);
    keepNewestSamples(left, right, {
      channels: 1,
      frames: 4,
      pcm: new Float32Array([1, 2, 3, 4]),
    });
    expect(Array.from(left)).toEqual([3, 4]);
  });
});
