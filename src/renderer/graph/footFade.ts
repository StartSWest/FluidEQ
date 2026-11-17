/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * THE GRAPH'S CONTENT FADES OUT AT ITS FOOT, AND NOTHING ELSE CHANGES (Ivan,
 * 2026-11-17: "It needs to be a smooth transition the eye cannot see, just
 * the fading, don't show anything else"; over a Plus scene, "the colour
 * bleeds onto the viz").
 *
 * A mask, never a colour: over the last 56px of the EQ page's graph what is
 * drawn — a scene, a standard look's bars, wave or spectrum, the grid, the
 * curves and their fills — goes from opaque to transparent, and what shows
 * through is the one surface the graph and the page under it both stand on
 * (`App.scss`, the EQ page's seam). It was a gradient of the card's colour
 * painted over the picture: on an empty graph, which stands on the window's
 * floor, that read as a lighter band, and over a scene it washed the scene's
 * foot blue.
 *
 * One curve for every layer: the chart's own drawing takes it as an SVG mask
 * (`ChartFootMask`), the canvases and the scene's layer as the CSS mask this
 * module writes (`footFadeMaskImage`), so the two can never disagree.
 */

/** The fade's height where the plot has room for all of it. */
export const FOOT_FADE_HEIGHT = 56;

/**
 * How opaque the content still is at each tenth of the way down: smootherstep,
 * eased at both ends, so neither where it starts nor where it ends can be
 * picked out. A straight two-stop ramp left a line at its top.
 */
export const FOOT_FADE_OPACITY = [
  1, 0.98, 0.93, 0.84, 0.72, 0.57, 0.42, 0.28, 0.16, 0.07, 0,
];

/**
 * The fade's height on a plot whose foot is at `foot` and whose −20 dB line
 * is at `top`: never above that line, so it covers only the compressed band
 * no band's handle reaches, and is shortened to it on a short graph rather
 * than move the scale.
 */
export const footFadeHeight = (foot: number, top: number): number =>
  Math.max(0, Math.min(FOOT_FADE_HEIGHT, Math.round(foot - top)));

/**
 * The CSS mask for a box whose bottom is the graph's foot: opaque down to the
 * fade, then the curve to transparent at the foot. `none` with no fade.
 */
export const footFadeMaskImage = (height: number): string => {
  if (height <= 0) {
    return 'none';
  }
  const last = FOOT_FADE_OPACITY.length - 1;
  const stops = FOOT_FADE_OPACITY.map((opacity, step) => {
    const above = height - (height * step) / last;
    return `rgba(0, 0, 0, ${opacity}) calc(100% - ${above.toFixed(2)}px)`;
  });
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
};
