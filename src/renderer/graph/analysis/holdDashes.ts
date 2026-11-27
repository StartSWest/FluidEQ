/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { placeLevel, type IAnalysisReading } from './analysisFrame';

/**
 * The Analyzer's peak hold as a fine dashed line, on either side of the
 * Brightness (Ivan, 2026-11-27, pointing at the page's own drawing of it on
 * white: "this is what I want", and "in dark theme intermittent too").
 *
 * The page strokes the hold with the canvas's own line dash, which is laid
 * along the line: 3px on, 3px off, measured from the line's first point,
 * with round ends. The engine used to cut its dashes by screen column
 * instead, so every cliff of the hold was drawn whole or not at all and the
 * line read as broken; it now dashes by the same length along the line
 * (`analyzerHoldDash` in `engineLooks/analyzerLook.ts`), from the lengths
 * written here.
 */

/** A dash and the gap after it, along the line, in CSS pixels. */
export const HOLD_DASH = 3;
export const HOLD_DASH_GAP = 3;

/** The hold's line width, in CSS pixels. */
export const HOLD_LINE_WIDTH = 1.25;

/**
 * How far along the hold's line each of its points stands, from its first
 * point, in CSS pixels: the length the canvas measures its dashes by.
 */
export const holdLengths = (
  reading: Pick<IAnalysisReading, 'xs' | 'band'>,
  hold: Float64Array,
  out: Float64Array,
): Float64Array => {
  const { xs, band } = reading;
  let along = 0;
  let lastX = xs[0];
  let lastY = placeLevel(band, hold[0]);
  for (let index = 0; index < hold.length; index += 1) {
    const x = xs[index];
    const y = placeLevel(band, hold[index]);
    along += Math.hypot(x - lastX, y - lastY);
    out[index] = along;
    lastX = x;
    lastY = y;
  }
  return out;
};
