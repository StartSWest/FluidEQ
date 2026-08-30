/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The shape behind the Custom crossfade curve.
 *
 * The three built-in curves are closed-form functions of progress and nothing
 * can move them. This one is four points the user drags, and everything that
 * needs a gain from it — the preview, the Web Audio automation table, the
 * table the native mixer reads per sample — comes through the functions here,
 * so there is exactly one definition of what a dragged handle means.
 *
 * The endpoints are not stored and cannot be dragged. A fade whose outgoing
 * deck ends anywhere but silence leaves the previous track audible under the
 * new one until the player's cleanup timer tears the deck down, which is a
 * fade that does not finish; pinning them makes that unreachable rather than
 * merely discouraged.
 */

/** One dragged handle. `at` is progress through the fade, `gain` is linear. */
export interface ICrossfadePoint {
  at: number;
  gain: number;
}

export interface ICrossfadeShape {
  outgoing: readonly ICrossfadePoint[];
  incoming: readonly ICrossfadePoint[];
}

/**
 * Four, which is the most a 168px-wide preview can hold without the handles
 * touching, and enough for the shapes a crossfade is actually made of: a fast
 * cut, a slow bleed, a hold, and a dip.
 */
export const CROSSFADE_SHAPE_HANDLES = 4;

/**
 * How many points the sampled table carries to Web Audio and to the host.
 *
 * The native mixer interpolates between them per sample, so this is the
 * resolution of the SHAPE and not of the gain: 64 points across a fade that is
 * never shorter than 250ms puts a knot every 4ms, well under anything a
 * listener can resolve as a step, while staying small enough to sit inside the
 * crossfader struct with no allocation on the audio thread.
 */
export const CROSSFADE_TABLE_POINTS = 64;

/** Handles may not be dragged onto the pinned ends, or onto each other. */
const MIN_HANDLE_GAP = 0.02;

const clampUnit = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
};

/**
 * Equal power, sampled at four evenly spaced points.
 *
 * Custom therefore starts on the curve it was reached from rather than on a
 * straight line: picking it and dragging nothing should not change the sound.
 * Four handles and a shape-preserving spline cannot reproduce a sine exactly —
 * measured worst case is 0.01 of linear gain, under 0.1 dB — so it is the same
 * fade to a listener, not the same numbers to a test.
 */
const equalPowerAt = (at: number, incoming: boolean): number => {
  const rising = Math.sin((at * Math.PI) / 2);
  const falling = Math.cos((at * Math.PI) / 2);
  const sum = Math.max(Number.EPSILON, rising + falling);
  return (incoming ? rising : falling) / sum;
};

const defaultSide = (incoming: boolean): ICrossfadePoint[] =>
  Array.from({ length: CROSSFADE_SHAPE_HANDLES }, (_, index) => {
    const at = (index + 1) / (CROSSFADE_SHAPE_HANDLES + 1);
    return { at, gain: equalPowerAt(at, incoming) };
  });

export const defaultCrossfadeShape = (): ICrossfadeShape => ({
  outgoing: defaultSide(false),
  incoming: defaultSide(true),
});

/**
 * The pinned ends plus the dragged handles, in order.
 *
 * Outgoing runs 1 to 0 and incoming 0 to 1; both are anchored at exactly those
 * values, which is what guarantees a completed fade is silent on one side and
 * unity on the other no matter where the handles were left.
 */
const knots = (
  points: readonly ICrossfadePoint[],
  incoming: boolean,
): ICrossfadePoint[] => [
  { at: 0, gain: incoming ? 0 : 1 },
  ...points,
  { at: 1, gain: incoming ? 1 : 0 },
];

/**
 * Shape-preserving cubic interpolation (Fritsch-Carlson).
 *
 * A plain cubic spline through dragged points overshoots: pull one handle down
 * and the curve dips BELOW it on the way past, so a fade the user drew as
 * monotonic develops a gain of -0.04 and inverts the signal for a few
 * milliseconds. This one cannot overshoot a knot by construction, so what is
 * drawn between two handles stays between them.
 */
const slopes = (points: readonly ICrossfadePoint[]): number[] => {
  const count = points.length;
  const widths: number[] = [];
  const secants: number[] = [];
  for (let index = 0; index < count - 1; index += 1) {
    const width = points[index + 1].at - points[index].at;
    widths.push(width);
    secants.push((points[index + 1].gain - points[index].gain) / width);
  }

  const interior = (index: number): number => {
    const before = secants[index - 1];
    const after = secants[index];
    if (before * after <= 0) {
      // A turning point. Zero slope here is what stops the curve from
      // continuing past the handle it was told to turn at.
      return 0;
    }
    const weightBefore = 2 * widths[index] + widths[index - 1];
    const weightAfter = widths[index] + 2 * widths[index - 1];
    return (
      (weightBefore + weightAfter) /
      (weightBefore / before + weightAfter / after)
    );
  };

  /**
   * The three-point end slope, with the shape-preserving guard on it.
   *
   * Taking the end secant instead is simpler and was what this did first, but
   * it starts the curve at the average slope of the first segment rather than
   * at its own — equal power leaves the top at -1.57 and the secant says
   * -1.22, so the default shape came away from the curve it is supposed to
   * reproduce. The guard is what keeps the extra steepness from turning into
   * an overshoot: zero if it would set off in the wrong direction, and capped
   * at three times the secant next to a turn.
   */
  const end = (near: number, far: number, width: number, next: number) => {
    const slope = ((2 * width + next) * near - width * far) / (width + next);
    if (slope * near <= 0) {
      return 0;
    }
    if (near * far <= 0 && Math.abs(slope) > 3 * Math.abs(near)) {
      return 3 * near;
    }
    return slope;
  };

  return points.map((_, index) => {
    if (index === 0) {
      return end(secants[0], secants[1], widths[0], widths[1]);
    }
    if (index === count - 1) {
      return end(
        secants[count - 2],
        secants[count - 3],
        widths[count - 2],
        widths[count - 3],
      );
    }
    return interior(index);
  });
};

/**
 * The interpolated shape itself, which is what the table is sampled FROM.
 *
 * Not what anything audible calls: see `crossfadeShapeGain` below for why the
 * gain is read out of the table on both sides rather than evaluated here.
 */
const shapeCurve = (
  shape: ICrossfadeShape,
  progress: number,
  incoming: boolean,
): number => {
  const points = knots(incoming ? shape.incoming : shape.outgoing, incoming);
  const unit = clampUnit(progress);
  const derivatives = slopes(points);

  let segment = points.length - 2;
  for (let index = 0; index < points.length - 1; index += 1) {
    if (unit <= points[index + 1].at) {
      segment = index;
      break;
    }
  }

  const from = points[segment];
  const to = points[segment + 1];
  const width = to.at - from.at;
  const local = (unit - from.at) / width;
  const square = local * local;
  const cube = square * local;

  // Cubic Hermite, written out rather than through a basis helper: this runs
  // once per sample of the exported table and per painted frame of the preview.
  const gain =
    (2 * cube - 3 * square + 1) * from.gain +
    (cube - 2 * square + local) * width * derivatives[segment] +
    (-2 * cube + 3 * square) * to.gain +
    (cube - square) * width * derivatives[segment + 1];

  return clampUnit(gain);
};

/**
 * One side, sampled for Web Audio's curve automation and for the host.
 *
 * Rounded to single precision because that is what the host stores. Sending a
 * double the native side then narrows would leave the two interpolating from
 * numbers that differ in the last bits, which is a parity failure with no
 * cause to find — the port is correct and the fixture is not.
 */
export const crossfadeShapeTable = (
  shape: ICrossfadeShape,
  incoming: boolean,
): number[] =>
  Array.from({ length: CROSSFADE_TABLE_POINTS }, (_, index) =>
    Math.fround(
      shapeCurve(shape, index / (CROSSFADE_TABLE_POINTS - 1), incoming),
    ),
  );

/**
 * Both sides' tables for one shape, built once.
 *
 * Keyed on the shape object because a drag produces a new one per frame and
 * the old ones must not be held: React hands the same object back between
 * renders, so a still curve builds its table once and a dragged one builds it
 * as often as it changes.
 */
const tables = new WeakMap<ICrossfadeShape, [number[], number[]]>();

const tableFor = (shape: ICrossfadeShape, incoming: boolean): number[] => {
  const cached = tables.get(shape);
  if (cached) {
    return cached[incoming ? 1 : 0];
  }
  const built: [number[], number[]] = [
    crossfadeShapeTable(shape, false),
    crossfadeShapeTable(shape, true),
  ];
  tables.set(shape, built);
  return built[incoming ? 1 : 0];
};

/**
 * One side's gain at a point in the fade, read out of the sampled table.
 *
 * Out of the TABLE and not off the spline, even here where the spline is
 * available: the native mixer only ever receives the table, so evaluating the
 * exact curve on this side would make the preview and the Web Audio fallback
 * disagree with the engine that is actually audible — by a little, in the
 * places where the shape bends hardest, which is precisely where a user drags.
 * Both sides interpolate the same 64 points the same way, so what is drawn is
 * what is heard on either engine.
 */
export const crossfadeShapeGain = (
  shape: ICrossfadeShape,
  progress: number,
  incoming: boolean,
): number => {
  const side = tableFor(shape, incoming);
  const unit = clampUnit(progress);
  const last = CROSSFADE_TABLE_POINTS - 1;
  const scaled = unit * last;
  const lower = Math.min(last - 1, Math.floor(scaled));
  const fraction = scaled - lower;
  return side[lower] + (side[lower + 1] - side[lower]) * fraction;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * One side out of storage or off the wire, made safe to interpolate.
 *
 * Sorted, spaced and clamped rather than rejected: this arrives from
 * localStorage and from an older build's saved curve, and a shape with two
 * handles at the same `at` divides by a zero width. Anything unreadable falls
 * back to the default side whole, because half a shape is not a curve.
 */
const clampSide = (value: unknown, incoming: boolean): ICrossfadePoint[] => {
  if (!Array.isArray(value) || value.length !== CROSSFADE_SHAPE_HANDLES) {
    return defaultSide(incoming);
  }
  const points = value.map((entry, index): ICrossfadePoint => {
    if (
      !isRecord(entry) ||
      typeof entry.at !== 'number' ||
      typeof entry.gain !== 'number'
    ) {
      return defaultSide(incoming)[index];
    }
    return { at: clampUnit(entry.at), gain: clampUnit(entry.gain) };
  });

  points.sort((left, right) => left.at - right.at);

  /**
   * Walked forward, each handle pushed clear of the one before it.
   *
   * Clamping each handle against a fixed slot instead let four handles that
   * all arrived at 0.5 stay at 0.5 — every segment zero-width, every secant a
   * division by zero, and a NaN gain that silences the deck. The ceiling keeps
   * room for the handles still to come so the last one cannot reach the pinned
   * end either.
   */
  let previous = 0;
  return points.map((point, index) => {
    const ceiling = 1 - MIN_HANDLE_GAP * (CROSSFADE_SHAPE_HANDLES - index);
    const at = Math.min(ceiling, Math.max(previous + MIN_HANDLE_GAP, point.at));
    previous = at;
    return { at, gain: point.gain };
  });
};

export const clampCrossfadeShape = (value: unknown): ICrossfadeShape => {
  const shape = isRecord(value) ? value : {};
  return {
    outgoing: clampSide(shape.outgoing, false),
    incoming: clampSide(shape.incoming, true),
  };
};

/**
 * Where a handle may be dragged to, given where its neighbours are.
 *
 * The editor asks rather than deciding for itself, so the rule that keeps the
 * shape interpolable lives beside the interpolation instead of in the pointer
 * handler.
 */
export const crossfadeHandleBounds = (
  points: readonly ICrossfadePoint[],
  index: number,
): { min: number; max: number } => ({
  min: (index === 0 ? 0 : points[index - 1].at) + MIN_HANDLE_GAP,
  max:
    (index === points.length - 1 ? 1 : points[index + 1].at) - MIN_HANDLE_GAP,
});
