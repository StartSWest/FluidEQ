/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISystemSoundBlock } from '../systemSound/systemSound';

/** One tenth of a second of the output: its loudest sample, in dBFS. */
export interface IPeakFrame {
  peakDbfs: number;
  durationMs: number;
  /** Where it began, in frames of audio heard since listening started. */
  startFrame: number;
}

/** Below anything a sample can hold: digital silence. */
const SILENCE_DBFS = -240;

/**
 * The output's sample peaks over each tenth of a second, from the blocks the
 * core hears, across every channel — what the window's headroom worklet
 * measured on its capture (`headroom-meter.worklet`, now gone with it).
 * Frames follow on from block to block whatever size the blocks are; a new
 * rate starts a new frame, since a tenth of a second is a different number
 * of samples.
 */
export const createPeakFrames = (onFrame: (frame: IPeakFrame) => void) => {
  let rate = 0;
  let windowFrames = 0;
  let peak = 0;
  let filled = 0;
  let startFrame = 0;
  let heard = 0;

  return {
    push: (block: ISystemSoundBlock): void => {
      if (block.sampleRate !== rate) {
        rate = block.sampleRate;
        windowFrames = Math.max(1, Math.round(rate / 10));
        peak = 0;
        filled = 0;
      }
      const pcm = new Float32Array(block.pcm);
      for (let frame = 0; frame < block.frames; frame += 1) {
        if (filled === 0) {
          startFrame = heard;
        }
        for (let channel = 0; channel < block.channels; channel += 1) {
          peak = Math.max(
            peak,
            Math.abs(pcm[frame * block.channels + channel]),
          );
        }
        filled += 1;
        heard += 1;
        if (filled === windowFrames) {
          onFrame({
            peakDbfs: peak > 0 ? 20 * Math.log10(peak) : SILENCE_DBFS,
            durationMs: (1000 * filled) / rate,
            startFrame,
          });
          peak = 0;
          filled = 0;
        }
      }
    },
    /** Frames of audio heard so far, the clock `startFrame` is on. */
    heardFrames: (): number => heard,
  };
};
