/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** One frame of the 60 Hz screen the old per-frame easings were tuned on. */
const TUNED_FRAME_MS = 1000 / 60;

/**
 * The half-life that closes `perFrame` of the remaining distance in one
 * 60 Hz frame, for `getEaseFactor` (`common/smoothing.ts`).
 *
 * For an easing first written as a fixed step a frame: counted in frames it
 * runs four times as fast on a 240 Hz screen as on the 60 Hz one it was tuned
 * on. As a half-life it keeps its tuned speed on a screen of any rate.
 */
const halfLifeOfFrameStep = (perFrame: number): number =>
  (TUNED_FRAME_MS * Math.LN2) / -Math.log(1 - perFrame);

export default halfLifeOfFrameStep;
