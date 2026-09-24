/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ANALYSIS_RANGE_DB, clamp01 } from './analysisFrame';

/**
 * Cutting the reading into bands, in POWER.
 *
 * Shared by the third-octave analyser, the note spectrum and the energy
 * bands, because all three ask the same question of the same numbers and a
 * second copy of this loop is a second chance for one of them to average
 * decibels by mistake.
 *
 * A band is a SHARE OF THE ENERGY. The readings arrive as a fraction of the
 * plot's depth, so they come back to decibels, are summed as power, and go
 * back to the fraction — averaging the fractions directly is averaging
 * decibels, which reports a band holding one loud tone and three silent
 * points as if it were a quarter as loud as it is, and taking the loudest of
 * them instead reports a narrow tone as if it filled the whole band. On a
 * display people set room curves by, either is a lie with consequences.
 */

/** One reading as power, or nothing at all where it is on the floor. */
const asPower = (level: number) =>
  level <= 0 ? 0 : 10 ** (((level - 1) * ANALYSIS_RANGE_DB) / 10);

/** Mean power back to a fraction of the plot's depth. */
const asLevel = (mean: number) =>
  mean <= 0 ? 0 : clamp01(1 + Math.log10(mean) / (ANALYSIS_RANGE_DB / 10));

/**
 * `levels` cut into `bands.length` equal slices of the plot's LOG axis.
 *
 * Equal slices of a log axis are fractional octaves, which is what makes
 * thirty-four of them the standard third-octave set and a hundred and
 * thirty-six of them one bar per semitone. Written into `bands`.
 */
export const readFractionalBands = (
  levels: Float64Array,
  bands: Float64Array,
): void => {
  const count = bands.length;
  const points = levels.length;
  for (let band = 0; band < count; band += 1) {
    const from = Math.floor((band * points) / count);
    const to = Math.max(from + 1, Math.floor(((band + 1) * points) / count));
    let power = 0;
    for (let index = from; index < to; index += 1) {
      power += asPower(levels[index]);
    }
    bands[band] = asLevel(power / (to - from));
  }
};

/**
 * `levels` cut at named frequencies rather than into equal slices.
 *
 * What the energy bands need: a listener names bass, mid and treble by where
 * they are in hertz, not by an equal share of the picture.
 */
export const readNamedBands = (
  levels: Float64Array,
  axis: Float64Array,
  edges: readonly number[],
  bands: Float64Array,
): void => {
  const points = levels.length;
  let at = 0;
  for (let band = 0; band < bands.length; band += 1) {
    const from = edges[band];
    const to = edges[band + 1];
    while (at < points - 1 && axis[at] < from) {
      at += 1;
    }
    let power = 0;
    let counted = 0;
    for (let index = at; index < points && axis[index] < to; index += 1) {
      power += asPower(levels[index]);
      counted += 1;
    }
    bands[band] = counted > 0 ? asLevel(power / counted) : 0;
  }
};
