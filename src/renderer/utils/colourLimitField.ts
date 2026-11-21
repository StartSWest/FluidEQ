/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { hexOfHsv } from './hsvColour';
import { labOf } from './windowFill';

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
 * can hold more than one run of colours a limit leaves alone: on the white
 * window the deep colours that carry the floor's colour for a label and the
 * pastels that carry the dark ink, with the mid-tones between them and the
 * near-whites above them out (`filledFace`). Each column is sampled, every
 * run's two ends found by halving, and each run joined to the one that
 * continues it in the next column.
 */

export type TColourLimit = (hex: string) => string;

/** Columns across the field: enough that the edge reads as a curve. */
const COLUMNS = 48;
/**
 * Samples down a column before its ends are halved toward: one every 31st
 * of the value. The white window's mid-tones span about a fifth, but beside
 * the greys the wedge where a near-grey is worn as monochrome (`filledOn`)
 * and a colour a step more saturated keeps its hue narrows to nothing, and
 * sampled at 16 it was found in one column and missed in the next, drawn as
 * a row of drips.
 */
const SAMPLES = 32;
/** Halvings of each end: 1/2^8 of a column's height, under a pixel. */
const HALVINGS = 8;
/**
 * The least span of value a run or a gap between runs is drawn at: a 75th,
 * two pixels of the 148px field. Under it are the rule's own rounding at
 * `UNNOTICED`'s edge, which came out as specks in the black.
 */
const LEAST_SPAN = 1 / 75;

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

/** A run of colours that can be picked down one column, by value: 0 to 1. */
interface IRun {
  low: number;
  high: number;
}

/** One column of the field: its saturation and its runs, lowest first. */
export interface IColumn {
  s: number;
  runs: IRun[];
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

/** Each column's runs of values that `limit` leaves alone at hue `h`. */
export const allowedSpans = (limit: TColourLimit, h: number): IColumn[] =>
  Array.from({ length: COLUMNS }, (_, column) => {
    const s = column / (COLUMNS - 1);
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
    return { s, runs: withoutSpecks(runs) };
  });

/**
 * The runs of two neighbouring columns in groups that touch: a run with the
 * runs of the other column it overlaps, and theirs, and so on. Within one
 * column runs never overlap, so a group holds several of one column only
 * where a run of the other spans them.
 */
const groupsOf = (
  left: readonly IRun[],
  right: readonly IRun[],
): { left: IRun[]; right: IRun[] }[] => {
  const all = [
    ...left.map((run) => ({ run, isLeft: true })),
    ...right.map((run) => ({ run, isLeft: false })),
  ].sort((one, other) => one.run.low - other.run.low);
  const groups: { left: IRun[]; right: IRun[]; high: number }[] = [];
  all.forEach(({ run, isLeft }) => {
    const open = groups[groups.length - 1];
    const group =
      open && run.low <= open.high
        ? open
        : { left: [] as IRun[], right: [] as IRun[], high: run.high };
    if (group !== open) {
      groups.push(group);
    }
    group.high = Math.max(group.high, run.high);
    (isLeft ? group.left : group.right).push(run);
  });
  return groups;
};

const point = (x: number, v: number) => `${x.toFixed(4)} ${(1 - v).toFixed(4)}`;
const shape = (corners: string[]) => `M${corners.join(' L')} Z`;
const line = (from: string, to: string) => `M${from} L${to}`;

/** The gaps between one column's runs inside a group, lowest first. */
const gapsWithin = (runs: readonly IRun[]): IRun[] =>
  runs.slice(1).map((run, index) => ({
    low: runs[index]?.high ?? run.low,
    high: run.low,
  }));

/**
 * The field outside every run, in a 1 by 1 box with value up: `fill` covers
 * it (the whole box, with what can be picked cut out of it and filled even-
 * odd), `edge` traces where the two meet. Between two columns each group of
 * touching runs is one band from the span of its runs in the first to their
 * span in the second; a gap between runs of one column inside it narrows to a
 * point halfway, and so does a run that touches nothing across.
 */
export const outsideOf = (
  columns: readonly IColumn[],
): { fill: string; edge: string } | undefined => {
  if (
    columns.every(
      ({ runs }) =>
        runs.length === 1 && runs.every((run) => run.low <= 0 && run.high >= 1),
    )
  ) {
    return undefined;
  }
  const cuts: string[] = [];
  const edges: string[] = [];
  const xOf = (column: number) => column / (columns.length - 1);
  columns.slice(1).forEach(({ runs: next }, index) => {
    const x0 = xOf(index);
    const x1 = xOf(index + 1);
    const middle = (x0 + x1) / 2;
    // A wedge from `x`'s interval to a point halfway: a run that closes, cut
    // out, or a gap that closes inside a band, filled back in.
    const wedge = (x: number, { low, high }: IRun) => {
      const top = point(x, high);
      const bottom = point(x, low);
      const tip = point(middle, (low + high) / 2);
      cuts.push(shape([top, tip, bottom]));
      edges.push(line(top, tip), line(tip, bottom));
    };
    groupsOf(columns[index]?.runs ?? [], next).forEach(({ left, right }) => {
      const first = left[0];
      const last = left[left.length - 1];
      const nextFirst = right[0];
      const nextLast = right[right.length - 1];
      if (!first || !last || !nextFirst || !nextLast) {
        left.forEach((run) => wedge(x0, run));
        right.forEach((run) => wedge(x1, run));
        return;
      }
      const top = point(x0, last.high);
      const bottom = point(x0, first.low);
      const nextTop = point(x1, nextLast.high);
      const nextBottom = point(x1, nextFirst.low);
      cuts.push(shape([top, nextTop, nextBottom, bottom]));
      if (last.high < 1 || nextLast.high < 1) {
        edges.push(line(top, nextTop));
      }
      if (first.low > 0 || nextFirst.low > 0) {
        edges.push(line(bottom, nextBottom));
      }
      gapsWithin(left).forEach((gap) => wedge(x0, gap));
      gapsWithin(right).forEach((gap) => wedge(x1, gap));
    });
  });
  return {
    fill: [shape(['0 0', '1 0', '1 1', '0 1']), ...cuts].join(' '),
    edge: edges.join(' '),
  };
};
