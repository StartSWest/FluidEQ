/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The capture's samples as the audio thread hands them over, block by block
 * (`pcmCapture.worklet.ts`, the processor named `CAPTURE_PROCESSOR`), for
 * anything that has to hear every moment of the music however late the page
 * gets to it.
 */

export interface ICaptureBlock {
  channels: 1 | 2;
  frames: number;
  /** Interleaved, `channels` samples a frame. */
  pcm: Float32Array;
}

/** The processor's block, as it posts it; or nothing. */
export const readCaptureBlock = (data: unknown): ICaptureBlock | undefined => {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const { channels, frames, pcm } = data as Record<string, unknown>;
  if (
    (channels !== 1 && channels !== 2) ||
    typeof frames !== 'number' ||
    !Number.isInteger(frames) ||
    frames <= 0 ||
    !(pcm instanceof ArrayBuffer) ||
    pcm.byteLength !== channels * frames * Float32Array.BYTES_PER_ELEMENT
  ) {
    return undefined;
  }
  return { channels, frames, pcm: new Float32Array(pcm) };
};

/**
 * `block` added to the end of each channel's newest samples, oldest first, as
 * an analyser holds them (`soundHops.ts`). A single channel is both.
 */
export const keepNewestSamples = (
  left: Float32Array,
  right: Float32Array,
  { channels, frames, pcm }: ICaptureBlock,
) => {
  const size = left.length;
  const kept = Math.min(frames, size);
  left.copyWithin(0, kept);
  right.copyWithin(0, kept);
  for (let frame = frames - kept; frame < frames; frame += 1) {
    const at = size - frames + frame;
    left[at] = pcm[frame * channels];
    right[at] = pcm[frame * channels + channels - 1];
  }
};
