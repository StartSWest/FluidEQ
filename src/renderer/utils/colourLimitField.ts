/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { hexOfHsv } from './hsvColour';
import { labOf } from './windowFill';

/**
 * ONLY WHAT CAN BE PICKED (Ivan, 2026-11-18: "whatever colours are selected
 * are the ones used, and the limit should be on the pickers, not before
 * applying them to the UI"; of a field painted in cells, "they need to be
 * smooth"; of a shaded part with an edge, "those divisions suck", choosing a
 * square stretched so every spot in it can be picked).
 *
 * A limit is the window's own rule for a colour (`useColourLimits.ts`): what
 * it would wear for it. A colour the limit leaves alone can be picked as it
 * is. For one hue, a column of the field (one saturation) holds one or more
 * runs of such colours: on a dark window one, from the darkest a label
 * reads on up; on the white window two, the deep colours that carry the
 * floor's colour for a label and the pastels that carry the dark ink, the
 * mid-tones between them and the near-whites above out (`filledFace`). Each
 * column is sampled, every run's ends found by halving, and the field is
 * those runs stacked, lightest at the top (`fieldRangeOf`).
 */

export type TColourLimit = (hex: string) => string;

/** Columns across the field, each drawn one canvas unit wide. */
const COLUMNS = 64;
/**
 * Samples down a column before its ends are halved toward: one every 31st
 * of the value. The white window's mid-tones span about a fifth, but beside
 * the greys the wedge where a near-grey is worn as monochrome narrows to
 * nothing, and at 16 it was found in one column and missed in the next.
 */
const SAMPLES = 32;
/** Halvings of each end: 1/2^8 of a column's height, under a pixel. */
const HALVINGS = 8;
/**
 * The least span of value a run, or a gap between two, is kept at: a 75th,
 * two pixels of the 148px field. Under it are the rule's own rounding at
 * `UNNOTICED`'s edge, specks rather than colours anybody could aim at.
 */
const LEAST_SPAN = 1 / 75;

/**
 * How far, in OKLab, the limit may move a colour and still leave it alone:
 * about one just-noticeable step. Wide enough for the rule's own rounding and
 * for a near-grey it takes the last of the colour out of (monochrome), which
 * would otherwise cut a notch of "cannot" beside the grey edge.
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

/** A run of values that can be picked down one column: 0 to 1. */
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

/** A place in the field: 0 to 1 across, 0 to 1 down. */
export interface IFieldPlace {
  x: number;
  y: number;
}

/** One stretch of a drawn column: from `top` to `bottom` down the field. */
export interface IFieldStretch {
  top: number;
  bottom: number;
  /** The value at its top and at its bottom. */
  high: number;
  low: number;
}

/**
 * The field stretched over only what can be picked: across, the saturations
 * that have any colour inside the limit; down each column its runs stacked,
 * lightest at the top, each as tall as its share of what can be picked
 * there. Every place in it is a colour the window wears as picked.
 */
export interface IFieldRange {
  /** The saturation and value at a place. */
  colourAt: (place: IFieldPlace) => { s: number; v: number };
  /** Where a saturation and value stand, held inside the field. */
  placeOf: (s: number, v: number) => IFieldPlace;
  /** The columns to draw, left to right, each with its stretches. */
  drawn: { s: number; stretches: IFieldStretch[] }[];
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** The plain field: saturation across, value up. */
export const OPEN_FIELD: IFieldRange = {
  colourAt: ({ x, y }) => ({ s: clamp01(x), v: clamp01(1 - y) }),
  placeOf: (s, v) => ({ x: clamp01(s), y: clamp01(1 - v) }),
  drawn: [],
};

/** A column's runs as stretches of the field's height, lightest first. */
const stretchesOf = (runs: readonly IRun[]): IFieldStretch[] => {
  const total = runs.reduce((sum, run) => sum + (run.high - run.low), 0);
  let top = 0;
  return [...runs]
    .sort((one, other) => other.high - one.high)
    .map((run) => {
      const bottom = total > 0 ? top + (run.high - run.low) / total : 1;
      const stretch = { top, bottom, high: run.high, low: run.low };
      top = bottom;
      return stretch;
    });
};

/**
 * `columns` as a field. The saturations before the first and after the last
 * column with any run are left out; a column with none between two that have
 * some takes the nearer one's runs.
 */
export const fieldRangeOf = (columns: readonly IColumn[]): IFieldRange => {
  const usable = columns.filter((column) => column.runs.length > 0);
  const first = usable[0];
  const last = usable[usable.length - 1];
  if (!first || !last) {
    return OPEN_FIELD;
  }
  const inField = columns
    .filter((column) => column.s >= first.s && column.s <= last.s)
    .map((column) => {
      if (column.runs.length > 0) {
        return column;
      }
      const nearest = usable.reduce((best, other) =>
        Math.abs(other.s - column.s) < Math.abs(best.s - column.s)
          ? other
          : best,
      );
      return { s: column.s, runs: nearest.runs };
    });
  const drawn = inField.map((column) => ({
    s: column.s,
    stretches: stretchesOf(column.runs),
  }));
  const width = last.s - first.s;
  const columnAt = (x: number) =>
    drawn[Math.round(clamp01(x) * (drawn.length - 1))] ?? drawn[0];
  return {
    colourAt: ({ x, y }) => {
      const column = columnAt(x);
      const s = first.s + clamp01(x) * width;
      const down = clamp01(y);
      const stretch =
        column?.stretches.find((one) => down <= one.bottom) ??
        column?.stretches[column.stretches.length - 1];
      if (!stretch) {
        return { s, v: 1 - down };
      }
      const height = stretch.bottom - stretch.top;
      const share = height > 0 ? (down - stretch.top) / height : 0;
      return { s, v: stretch.high - share * (stretch.high - stretch.low) };
    },
    placeOf: (s, v) => {
      const x = width > 0 ? clamp01((s - first.s) / width) : 0;
      const column = columnAt(x);
      const stretches = column?.stretches ?? [];
      // The stretch holding `v`, else the one whose end is nearest it.
      const distance = (one: IFieldStretch) =>
        v > one.high ? v - one.high : Math.max(0, one.low - v);
      const stretch = stretches.reduce<IFieldStretch | undefined>(
        (best, one) => (!best || distance(one) < distance(best) ? one : best),
        undefined,
      );
      if (!stretch) {
        return { x, y: clamp01(1 - v) };
      }
      const span = stretch.high - stretch.low;
      const share = span > 0 ? clamp01((stretch.high - v) / span) : 0;
      return {
        x,
        y: stretch.top + share * (stretch.bottom - stretch.top),
      };
    },
    drawn,
  };
};
