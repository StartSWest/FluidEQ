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
 * is; the rest of the field is drawn over, with a vector edge, so it is
 * smooth at any size. For one hue, a column of the field (one saturation)
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

/**
 * The parts of the field outside the spans, in a 1 by 1 box with value up:
 * `fill` covers them, `edge` traces where they meet what can be picked.
 */
export const outsideOf = (
  spans: (ISpan | undefined)[],
): { fill: string; edge: string } | undefined => {
  if (spans.every((span) => span && span.low <= 0 && span.high >= 1)) {
    return undefined;
  }
  const xs = spans.map((_, column) => column / (spans.length - 1));
  // Down from the top to the run's top; a column with none is covered whole.
  const tops = spans.map((span) => (span ? 1 - span.high : 1));
  const bottoms = spans.map((span) => (span ? 1 - span.low : 1));
  const along = (ys: number[]) =>
    ys
      .map((y, index) => `${(xs[index] ?? 0).toFixed(4)} ${y.toFixed(4)}`)
      .reverse()
      .join(' L');
  const line = (ys: number[]) =>
    ys
      .map(
        (y, index) =>
          `${index === 0 ? 'M' : 'L'}${(xs[index] ?? 0).toFixed(4)} ${y.toFixed(4)}`,
      )
      .join(' ');
  const fill = [
    `M0 0 L1 0 L${along(tops)} Z`,
    `M0 1 L1 1 L${along(bottoms)} Z`,
  ].join(' ');
  const edge = [
    tops.some((y) => y > 0) ? line(tops) : '',
    bottoms.some((y) => y < 1) ? line(bottoms) : '',
  ]
    .filter(Boolean)
    .join(' ');
  return { fill, edge };
};
