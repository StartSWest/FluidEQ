/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// A SCENE UNDER A BLUR IS DRAWN AT THE PIXELS THAT SURVIVE IT (Ivan,
// 2026-11-18: "can we smartly use the scaler on the scene when the user
// selects blur, because at the end there's no point rendering the full scene
// quality when blur is active"). CSS `blur(r)` is a Gaussian whose standard
// deviation is r: past about one sample every 0.8 r, finer sampling only
// draws detail the blur then takes away, and the worker's plain upscale
// under it is as smooth as the blur leaves anything. So the scene is drawn
// at a sample every 0.8 r CSS pixels and no finer: the more blur, the fewer
// pixels ("the more blur, less res"). A tenth of the panel's pixels each way
// at the least, a hundredth of the work, reached at about 13px of blur on a
// 1x display, where a sample ten CSS pixels apart is already finer than the
// blur leaves anything.

/** CSS pixels a sample may stand apart under a blur of 1 CSS pixel. */
const SAMPLE_SPACING_PER_BLUR_PX = 0.8;
/** The smallest scale a blur draws at, of the panel's pixels each way. */
const BLURRED_SCALE_FLOOR = 0.1;

/**
 * The largest scale worth drawing under `blurPx` CSS pixels of blur, where
 * a scale of 1 is `pixelsPerCssPx` output pixels for each CSS pixel; 1 with
 * no blur. Never above 1: a blur never asks for more than the panel has.
 */
export const blurredScale = (
  blurPx: number,
  pixelsPerCssPx: number,
): number => {
  if (!(blurPx > 0) || !(pixelsPerCssPx > 0)) {
    return 1;
  }
  const scale = 1 / (SAMPLE_SPACING_PER_BLUR_PX * blurPx * pixelsPerCssPx);
  return Math.min(1, Math.max(BLURRED_SCALE_FLOOR, scale));
};
