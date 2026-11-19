/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { hexOfHsv } from './hsvColour';
import type { TColourLimit } from './useColourLimits';
import { labOf } from './windowFill';

/**
 * WHERE A PICK WILL NOT GO, SHOWN SOFTLY (Ivan, 2026-11-18, choosing "soft
 * fade, no line: the blocked part fades out gently with no hard edge, and the
 * dot stops where the fade begins", after a field painted in cells, one
 * shaded with an edge and one stretched were all sent back).
 *
 * The square stays the whole colour square. For one hue each column (one
 * saturation) holds one or more runs of colours the window wears as picked
 * (`useColourLimits`): on a dark window one, on the white window the deep
 * colours and the pastels with the mid-tones between them out. Outside a run
 * the menu's own material comes over the square, from nothing at the run's
 * end to most of the way a fade's length further on, eased at both ends, so
 * no edge is drawn anywhere.
 */

/** Columns sampled across the square; the browser smooths between them. */
export const SHADE_COLUMNS = 48;
/** Samples down a column before each run's ends are halved toward. */
const SAMPLES = 32;
/** Halvings of each end: 1/2^8 of a column's height, under a pixel. */
const HALVINGS = 8;
/** The least run, or gap between runs, kept: two pixels of the 148px square. */
const LEAST_SPAN = 1 / 75;
/**
 * How far, in OKLab, the limit may move a colour and still leave it alone:
 * about one just-noticeable step, wide enough for the rule's own rounding.
 */
const UNNOTICED = 0.02;
/** How far past a run's end, in value, the shade takes to come in. */
export const SHADE_FADE = 0.16;
/** How much of the square the shade covers where it is fully in. */
export const SHADE_MOST = 0.78;

/** Whether `limit` leaves `hex` as it is, to the eye. */
const isWithinLimit = (limit: TColourLimit, hex: string): boolean => {
  const asked = labOf(hex);
  const kept = labOf(limit(hex));
  return (
    asked !== undefined &&
    kept !== undefined &&
    Math.hypot(asked.l - kept.l, asked.a - kept.a, asked.b - kept.b) <=
      UNNOTICED
  );
};

/** A run of values a column's colours are worn as picked over: 0 to 1. */
export interface IRun {
  low: number;
  high: number;
}

/** `ok` and `not` straddle an end of a run: halved toward it. */
const endBetween = (
  allowed: (v: number) => boolean,
  ok: number,
  not: number,
): number => {
  let inside = ok;
  let outside = not;
  for (let step = 0; step < HALVINGS; step += 1) {
    const middle = (inside + outside) / 2;
    if (allowed(middle)) {
      inside = middle;
    } else {
      outside = middle;
    }
  }
  return inside;
};

const valueAt = (sample: number) => sample / (SAMPLES - 1);

/** `runs` with every gap under `LEAST_SPAN` closed, then every run under it dropped. */
const withoutSpecks = (runs: readonly IRun[]): IRun[] =>
  runs
    .reduce<IRun[]>((joined, run) => {
      const before = joined[joined.length - 1];
      if (before && run.low - before.high < LEAST_SPAN) {
        before.high = run.high;
      } else {
        joined.push({ ...run });
      }
      return joined;
    }, [])
    .filter((run) => run.high - run.low >= LEAST_SPAN);

/** Each sampled column's runs at hue `h`, from no saturation to full. */
export const runsOfColumns = (limit: TColourLimit, h: number): IRun[][] =>
  Array.from({ length: SHADE_COLUMNS }, (_, column) => {
    const s = column / (SHADE_COLUMNS - 1);
    const allowed = (v: number) => isWithinLimit(limit, hexOfHsv({ h, s, v }));
    const marks = Array.from({ length: SAMPLES }, (__, sample) =>
      allowed(valueAt(sample)),
    );
    const runs: IRun[] = [];
    let first: number | undefined;
    marks.forEach((mark, sample) => {
      if (!mark) {
        return;
      }
      first ??= sample;
      const last = sample === SAMPLES - 1;
      if (!last && marks[sample + 1] === true) {
        return;
      }
      runs.push({
        low:
          first === 0
            ? 0
            : endBetween(allowed, valueAt(first), valueAt(first - 1)),
        high: last
          ? 1
          : endBetween(allowed, valueAt(sample), valueAt(sample + 1)),
      });
      first = undefined;
    });
    return withoutSpecks(runs);
  });

/** Eased both ways: no corner where the shade starts or where it is full. */
const ease = (share: number) => share * share * (3 - 2 * share);

/** How much shade lies over value `v` in a column with `runs`: 0 to 1. */
export const shadeAt = (runs: readonly IRun[], v: number): number => {
  if (runs.length === 0) {
    return SHADE_MOST;
  }
  const distance = runs.reduce((nearest, run) => {
    if (v >= run.low && v <= run.high) {
      return 0;
    }
    return Math.min(nearest, v < run.low ? run.low - v : v - run.high);
  }, Number.POSITIVE_INFINITY);
  return SHADE_MOST * ease(Math.min(1, distance / SHADE_FADE));
};

/** Columns either side the shade is softened over across: about a seventh. */
const ACROSS = 3;

/**
 * The shade over each column at `stops + 1` places down it, top first, eased
 * across as well as down. Down a column the shade fades over `SHADE_FADE`;
 * across, a column with a run beside one with none would otherwise turn from
 * clear to shaded in one column's width, a step a few pixels wide, so each
 * value is the weighted mean of the columns `ACROSS` either side.
 */
export const shadeGrid = (
  runs: readonly (readonly IRun[])[],
  stops: number,
): number[][] => {
  const down = runs.map((columnRuns) =>
    Array.from({ length: stops + 1 }, (_, stop) =>
      shadeAt(columnRuns, 1 - stop / stops),
    ),
  );
  return down.map((column, index) =>
    column.map((_, stop) => {
      let sum = 0;
      let weights = 0;
      for (let offset = -ACROSS; offset <= ACROSS; offset += 1) {
        const near = down[index + offset];
        const value = near?.[stop];
        if (value !== undefined) {
          const weight = ACROSS + 1 - Math.abs(offset);
          sum += value * weight;
          weights += weight;
        }
      }
      return weights > 0 ? sum / weights : 0;
    }),
  );
};
