/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { hexOfHsv } from './hsvColour';
import { labOf } from './windowLight';

/**
 * WHERE A COLOUR PICKER CANNOT GO (Ivan, 2026-11-18: "whatever colours are
 * selected are the ones used, and the limit should be on the pickers, not
 * before applying them to the UI", and of the first version, which painted
 * the field as the window would wear it in cells: "they need to be smooth").
 *
 * A limit is the window's own rule for a colour (`useColourLimits.ts`): what
 * it would wear for it. A colour the limit leaves alone can be picked as it
 * is, and the field is stretched over only those (`fieldRangeOf`), so
 * every place in it can be picked. For one hue, a column of the field (one saturation)
 * holds one run of colours a limit leaves alone - the rules lighten or darken
 * toward one end - so each column is sampled and its two ends found by
 * halving.
 */

export type TColourLimit = (hex: string) => string;

/** Columns across the field: enough that the edge reads as a curve. */
const COLUMNS = 48;
/** Samples down a column before its ends are halved toward. */
const SAMPLES = 12;
/** Halvings of each end: 1/2^8 of a column's height, under a pixel. */
const HALVINGS = 8;

/**
 * How far, in OKLab, the limit may move a colour and still leave it alone:
 * about one just-noticeable step. Wide enough for the rule's own rounding and
 * for a near-grey it takes the last of the colour out of (`filledOn`'s
 * monochrome), which would otherwise cut a notch of "cannot" into the field
 * beside its grey edge.
 */
const UNNOTICED = 0.02;

/** Whether `limit` leaves `hex` as it is, to the eye. */
export const isWithinLimit = (limit: TColourLimit, hex: string): boolean => {
  const asked = labOf(hex);
  const kept = labOf(limit(hex));
  return (
    asked !== undefined &&
    kept !== undefined &&
    Math.hypot(asked.l - kept.l, asked.a - kept.a, asked.b - kept.b) <=
      UNNOTICED
  );
};

/** One column's run of colours that can be picked, by value: 0 to 1. */
interface ISpan {
  s: number;
  low: number;
  high: number;
}

/** `ok` and `not` straddle an end of the run: halved toward it. */
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

/**
 * Each column's run of values that `limit` leaves alone at hue `h`, from
 * no saturation to full; undefined for a column with none.
 */
export const allowedSpans = (
  limit: TColourLimit,
  h: number,
): (ISpan | undefined)[] =>
  Array.from({ length: COLUMNS }, (_, column) => {
    const s = column / (COLUMNS - 1);
    const allowed = (v: number) => isWithinLimit(limit, hexOfHsv({ h, s, v }));
    const values = Array.from(
      { length: SAMPLES },
      (__, index) => index / (SAMPLES - 1),
    );
    const marks = values.map(allowed);
    const first = marks.indexOf(true);
    const last = marks.lastIndexOf(true);
    if (first < 0) {
      return undefined;
    }
    const low =
      first === 0
        ? 0
        : endBetween(allowed, values[first] ?? 0, values[first - 1] ?? 0);
    const high =
      last === SAMPLES - 1
        ? 1
        : endBetween(allowed, values[last] ?? 1, values[last + 1] ?? 1);
    return { s, low, high };
  });

/** A place in the field: 0 to 1 across, 0 to 1 down. */
export interface IFieldPlace {
  x: number;
  y: number;
}

/**
 * The field stretched over only what can be picked: across, the saturations
 * that have any colour inside the limit; down each column, from its lightest
 * allowed value at the top to its darkest at the bottom. Every place in it is
 * a colour the window wears as picked, so there is nothing to draw over and
 * no line through it (Ivan, 2026-11-18, choosing "only allowed colours" over
 * a shaded part with an edge: "those divisions suck").
 */
export interface IFieldRange {
  /** The saturation and value at a place. */
  colourAt: (place: IFieldPlace) => { s: number; v: number };
  /** Where a saturation and value stand, held inside the field. */
  placeOf: (s: number, v: number) => IFieldPlace;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** The plain field: saturation across, value up. */
export const OPEN_FIELD: IFieldRange = {
  colourAt: ({ x, y }) => ({ s: clamp01(x), v: clamp01(1 - y) }),
  placeOf: (s, v) => ({ x: clamp01(s), y: clamp01(1 - v) }),
};

/**
 * `spans` as a field. Columns with none between two that have some take
 * their neighbours' run, a straight line between them; the saturations past
 * the first and last column with any are left out of the field.
 */
export const fieldRangeOf = (spans: (ISpan | undefined)[]): IFieldRange => {
  const known = spans.filter((span): span is ISpan => span !== undefined);
  const first = known[0];
  const last = known[known.length - 1];
  if (!first || !last) {
    return OPEN_FIELD;
  }
  const sMin = first.s;
  const sMax = last.s;
  // The run at any saturation, straight between the columns either side.
  const runAt = (s: number): { low: number; high: number } => {
    const after = known.findIndex((span) => span.s >= s);
    const right = known[after < 0 ? known.length - 1 : after] ?? last;
    const left = known[Math.max(0, after - 1)] ?? first;
    if (right.s <= left.s) {
      return { low: right.low, high: right.high };
    }
    const share = (s - left.s) / (right.s - left.s);
    return {
      low: left.low + (right.low - left.low) * share,
      high: left.high + (right.high - left.high) * share,
    };
  };
  const width = sMax - sMin;
  return {
    colourAt: ({ x, y }) => {
      const s = sMin + clamp01(x) * width;
      const { low, high } = runAt(s);
      return { s, v: low + (1 - clamp01(y)) * (high - low) };
    },
    placeOf: (s, v) => {
      const held = Math.min(sMax, Math.max(sMin, s));
      const { low, high } = runAt(held);
      return {
        x: width > 0 ? (held - sMin) / width : 0,
        y: high > low ? clamp01(1 - (v - low) / (high - low)) : 0,
      };
    },
  };
};
