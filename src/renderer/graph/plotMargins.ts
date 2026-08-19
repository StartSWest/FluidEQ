/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * How much room the plot leaves above itself.
 *
 * The controls strip floats over the top of the chart with no surface of its
 * own, and its children take pointer events. So anything of the plot that ends
 * up underneath it is not merely hard to read — it cannot be grabbed at all,
 * which is how the band handles at the top of a boosted curve became
 * unreachable while looking perfectly present.
 *
 * The old headroom was a flat thirty pixels, chosen so a curve at +20 dB was
 * not shaved off. The strip is taller than that before it wraps — eight pixels
 * down from the card, then a button of at least twenty-eight — and it wraps to
 * a second row whenever the chips do not fit, which happens on a narrow pane
 * with several layers in the chain. A constant cannot follow that.
 */

/** Where the strip starts, matching `top` on `.live-output-controls`. */
export const CONTROLS_OFFSET = 8;

/**
 * Gap between the bottom of the strip and the top of the plot.
 *
 * A handle is grabbed by its centre but hit by its edge, so leaving zero would
 * put the top row of handles half under a button.
 */
export const CONTROLS_CLEARANCE = 6;

/** Headroom kept when nothing has been measured, and the floor thereafter. */
export const MINIMUM_TOP_MARGIN = 30;

/**
 * Headroom above the plot, in pixels.
 *
 * `controlsHeight` is measured from the live element rather than derived from
 * the stylesheet: the strip's height depends on what is in it and how wide the
 * pane is, and both change without this code being told.
 *
 * Stretching gives the headroom up on purpose — that space is most of the gap
 * this mode exists to reclaim, and there is no handle up there to clip once the
 * drawing is the point rather than the measurement.
 */
export const plotTopMargin = (
  isStretched: boolean,
  controlsHeight: number,
): number => {
  if (isStretched) {
    return 4;
  }
  if (!Number.isFinite(controlsHeight) || controlsHeight <= 0) {
    return MINIMUM_TOP_MARGIN;
  }
  return Math.max(
    MINIMUM_TOP_MARGIN,
    Math.ceil(controlsHeight) + CONTROLS_OFFSET + CONTROLS_CLEARANCE,
  );
};
