/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Bass, Mid and Treble over the whole rack, the way an amplifier has them.
 *
 * Three controls that move every band together into one smooth shape instead
 * of fifteen gains moved one at a time: the classic Baxandall pair of shelves
 * with a broad bell between them, which is what a hi-fi tone control has been
 * since 1952 — gentle, wide, and flat in the middle when both ends are lifted
 * by the same amount, so raising Bass and Treble makes the smile rather than
 * two bumps with a hole between them.
 *
 * Three things here are not obvious and are what make it work:
 *
 *  - **The band gains are FITTED to the target, not sampled from it.** Bands
 *    two thirds of an octave apart overlap, so writing the target's value at
 *    each centre lands a curve half again as tall as the one asked for — the
 *    same trap the factory curves document. What is solved here is the
 *    interaction: a matrix of what every band does at every control point,
 *    then least squares for the gains whose SUM is the target. It is the
 *    method from Välimäki and Liski's accurate cascade graphic equalizer.
 *    Measured on the fifteen-band rack against the ideal shelf: 0.26 dB rms
 *    and 1.1 dB at its worst, in the top octave, at six decibels of Treble.
 *    That last decibel is the rack and not the fit — a search that ignores
 *    this arithmetic and walks the gains downhill on the real response for
 *    four thousand steps arrives at the same 1.1, because bands this far
 *    apart cross a hair below their half-power points and ripple between
 *    centres whatever gains they are given. A correction pass for the
 *    biquad's slight nonlinearity in gain was tried and measured no better
 *    at ±6 and marginally worse at ±12, so there is not one.
 *
 *  - **What the rack was already doing is carried through untouched.** The
 *    curve is split once, when the controls appear, into the tone it appears
 *    to be carrying and a RESIDUAL — everything the three shapes cannot
 *    explain. Every turn of a knob then fits `residual + tone`, so a band
 *    somebody dipped by hand stays dipped while Treble is turned, and turning
 *    it back returns the curve it started from rather than an approximation
 *    of an approximation. Splitting once rather than on every turn is the
 *    whole of that: a projection that ran per turn would feed its own
 *    rounding back in, and forty turns of a knob would walk the curve away.
 *
 *  - **The controls are read out of the curve, not stored beside it.** The
 *    rack has nowhere to keep three more numbers, and a control that only
 *    ever adds is not a control — it is a nudge button that forgets where it
 *    has been. The split above uses least squares with a constant term, so an
 *    overall trim is not mistaken for tone, and a curve that came from here
 *    reads back as exactly what was set.
 */
import {
  clampGain,
  FilterTypeEnum,
  IFilter,
  NO_GAIN_FILTER_TYPES,
} from './constants';
import { getResponseGainAtFrequencies } from './response';

export interface IToneStack {
  /** dB at the bottom. */
  bass: number;
  /** dB through the middle. */
  mid: number;
  /** dB at the top. */
  treble: number;
}

export const FLAT_TONE: IToneStack = { bass: 0, mid: 0, treble: 0 };

/**
 * How far each control goes. Ivan's number, 2026-09-20.
 *
 * It was twelve first, on the reasoning that these shapes are wide and the
 * bands carrying them would run out of room. Measured, they do not: at twenty
 * decibels of Treble the tallest band the fit asks for is eighteen, nothing
 * reaches the band's own clamp, and the error against the ideal shelf stays
 * the same fixed share of whatever is asked — 1.1 dB at six, 2.2 at twelve,
 * 3.7 at twenty, which is the rack's ripple scaling with the curve rather
 * than anything giving way. So the ceiling is a taste decision and not an
 * engineering one, and sixteen is where he set it: four decibels of daylight
 * under the band's twenty, which is the room the fit needs to carry the last
 * of it.
 */
export const TONE_MAX_DB = 16;

/**
 * Where the two shelves hinge and how wide the bell is.
 *
 * A Baxandall pair is specified by its corners — classically 300 Hz and
 * 1.5 kHz, where the response has moved 3 dB of a ±20 dB design. Stated as
 * the shelf midpoints these filters are built from, the same audible split
 * lands at 250 Hz and 2.5 kHz: low enough that Bass is bass rather than
 * warmth, high enough that Treble is air rather than presence, and far enough
 * apart to leave 400 Hz to 1.5 kHz nearly untouched when both are raised
 * together — which is the smile, and the reason the two ends are shelves
 * rather than bells. The 0.5 is deliberately gentler than the 0.7 a band
 * starts at: a steep shelf reads as a step, and a tone control that steps is
 * a tone control that sounds broken.
 */
const SHAPES: Readonly<Record<keyof IToneStack, Omit<IFilter, 'id' | 'gain'>>> =
  {
    bass: { type: FilterTypeEnum.LSC, frequency: 250, quality: 0.5 },
    mid: { type: FilterTypeEnum.PK, frequency: 900, quality: 0.6 },
    treble: { type: FilterTypeEnum.HSC, frequency: 2_500, quality: 0.5 },
  };

const KNOBS: readonly (keyof IToneStack)[] = ['bass', 'mid', 'treble'];

/**
 * What the controls are being judged against, and the rack's own share of it.
 *
 * Held by the caller for as long as the controls are on screen and rebuilt
 * whenever the rack changes underneath them.
 */
export interface IToneBase {
  /** Where the fit is measured. */
  points: readonly number[];
  /** dB the adjustable bands must produce before any tone is added. */
  residual: readonly number[];
}

/**
 * Where the fit is judged: every band centre and the gap beside it.
 *
 * Centres alone are not enough — a rack can hit all fifteen of them and still
 * ripple between them — so each adjacent pair contributes its geometric
 * middle as well, which is the point the two bands' skirts have to agree at.
 * Nothing outside the outermost centre is asked for: a rack of bells cannot
 * hold a shelf past its last band, and a fit told to try spends real bands
 * reaching for a decibel it can never keep.
 */
const controlPoints = (bands: readonly IFilter[]): number[] => {
  const centres = [
    ...new Set(
      bands
        .map((band) => band.frequency)
        .filter((frequency) => Number.isFinite(frequency) && frequency > 0),
    ),
  ].sort((one, other) => one - other);
  const points = [...centres];
  centres.forEach((frequency, at) => {
    const next = centres[at + 1];
    if (next !== undefined && next > frequency) {
      points.push(Math.sqrt(frequency * next));
    }
  });
  return points.sort((one, other) => one - other);
};

/** The dB the three shapes add up to, at these frequencies. */
export const toneResponse = (
  tone: IToneStack,
  frequencies: readonly number[],
): number[] =>
  getResponseGainAtFrequencies(
    {
      filters: KNOBS.map((knob, at) => ({
        ...SHAPES[knob],
        id: `tone-${at}`,
        gain: tone[knob],
      })),
    },
    frequencies,
  );

/**
 * Which of the three a band belongs to: the one whose shape reaches it most.
 *
 * Not a list of frequencies, because the rack's are not fixed — six bands,
 * thirty-one, and anything imported all have to answer this — and not a guess
 * either. Each shape is asked what it does at that frequency and the loudest
 * wins, which draws the same two borders on every rack — measured at 342 Hz
 * between Bass and Mid and 2141 Hz between Mid and Treble, where the shelves
 * hand the curve over to the bell. On the six-band rack that is two bands
 * each; on the thirty-one it is thirteen, eight and ten. It is what lets "put
 * Treble back to flat" mean the treble bands and leave the other two alone.
 */
export const toneRegionOf = (frequency: number): keyof IToneStack => {
  const reach = KNOBS.map((knob) =>
    Math.abs(toneResponse({ ...FLAT_TONE, [knob]: 1 }, [frequency])[0]),
  );
  return KNOBS[reach.indexOf(Math.max(...reach))];
};

/**
 * Solve `matrix · x = right` by elimination with partial pivoting.
 *
 * As wide as the rack has bands, so at most sixty-four: nothing cleverer than
 * elimination earns its keep at that size, and it runs once per turn of a dial.
 */
const solve = (matrix: number[][], right: readonly number[]): number[] => {
  const size = right.length;
  const rows = matrix.map((row, at) => [...row, right[at]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) {
        pivot = row;
      }
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const head = rows[column][column];
    if (!Number.isFinite(head) || Math.abs(head) < 1e-12) {
      return new Array<number>(size).fill(0);
    }
    for (let row = column + 1; row < size; row += 1) {
      const factor = rows[row][column] / head;
      if (factor !== 0) {
        for (let at = column; at <= size; at += 1) {
          rows[row][at] -= factor * rows[column][at];
        }
      }
    }
  }
  const answer = new Array<number>(size).fill(0);
  for (let row = size - 1; row >= 0; row -= 1) {
    let sum = rows[row][size];
    for (let column = row + 1; column < size; column += 1) {
      sum -= rows[row][column] * answer[column];
    }
    answer[row] = sum / rows[row][row];
  }
  return answer.map((value) => (Number.isFinite(value) ? value : 0));
};

/**
 * How hard neighbouring bands are held to each other.
 *
 * Without this a thirty-one-band rack answers a Treble of +12 with a sawtooth
 * — +3.7, +3.0, +2.9, +6.1, +2.1, +7.0, +1.9, +8.1, +3.5, +9.7 — because
 * third-octave bands overlap so heavily that lifting one and dropping its
 * neighbour produces very nearly the same curve as moving both a little. Both
 * answers fit; only one of them is a tone control. A plain ridge cannot tell
 * them apart, since the jagged answer is no larger than the smooth one: what
 * separates them is ROUGHNESS, so what is penalised is the second difference
 * along the rack — the standard Tikhonov choice for a problem whose unknowns
 * lie in a row and whose answer is meant to be a curve.
 *
 * 0.35 measured: the smooth answer at every rack size, and a fifth of a
 * decibel of accuracy given up for it on the thirty-one.
 */
const SMOOTHNESS = 0.35;

/**
 * The floor under the diagonal, for conditioning alone.
 *
 * Small on purpose: at this size it is only there to keep two bands sitting on
 * the same frequency from being answered with a hundred decibels each and a
 * cancellation between them. Smoothness above is what shapes the answer.
 */
const RIDGE = 1e-3;

/**
 * Least squares for `columns · x ≈ target`, optionally held smooth.
 *
 * `smooth` is the weight on the second difference of the answer, and means
 * something only where the unknowns are a rack in frequency order; the
 * projection onto the three tone shapes passes zero, because "bass, mid and
 * treble should vary smoothly" is not a sentence about anything.
 */
const leastSquares = (
  columns: readonly number[][],
  target: readonly number[],
  ridge: number,
  smooth = 0,
): number[] => {
  const width = columns.length;
  /**
   * Per point, so the two terms keep their balance whatever is being fitted.
   *
   * The data term is a sum over control points and the smoothness below is a
   * sum over bands, so an absolute weight on the second means the first
   * outgrows it as the rack gets bigger and loses to it when only one third
   * of the rack is being solved. Measured on the twenty-band: Treble at +16
   * came out at +18 across the top, the fit giving up two decibels of
   * accuracy to buy a straighter line through seven bands. Dividing by the
   * count makes `SMOOTHNESS` mean the same thing in every case.
   */
  const scale = target.length > 0 ? 1 / target.length : 1;
  const normal = columns.map((column, row) =>
    columns.map((other, at) => {
      const dot =
        column.reduce((sum, value, point) => sum + value * other[point], 0) *
        scale;
      return at === row ? dot + ridge : dot;
    }),
  );
  if (smooth > 0 && width >= 3) {
    // Each row of the difference operator is (-1, 2, -1) over three bands in a
    // row; added to the normal equations it costs the fit whatever curvature
    // it asks for. Per band, for the same reason the data term is per point.
    const each = smooth / width;
    for (let at = 1; at < width - 1; at += 1) {
      const stencil: [number, number][] = [
        [at - 1, -1],
        [at, 2],
        [at + 1, -1],
      ];
      stencil.forEach(([row, one]) => {
        stencil.forEach(([column, other]) => {
          normal[row][column] += each * one * other;
        });
      });
    }
  }
  const right = columns.map(
    (column) =>
      column.reduce((sum, value, point) => sum + value * target[point], 0) *
      scale,
  );
  return solve(normal, right);
};

/**
 * Bands that are in the chain at all.
 *
 * A band switched off shapes nothing, and it was being measured anyway: the
 * response these read from does not know about the switch, so one band left
 * at +9 dB and turned off put a decibel and a half onto the Bass dial of a
 * rack that was making a flat line.
 */
const live = (band: IFilter): boolean => band.isEnabled !== false;

/** Bands this fit is allowed to move: in the chain, and with a gain to move. */
const adjustable = (band: IFilter): boolean =>
  live(band) && !NO_GAIN_FILTER_TYPES.includes(band.type);

const responseOf = (
  bands: readonly IFilter[],
  frequencies: readonly number[],
): number[] =>
  getResponseGainAtFrequencies({ filters: [...bands] }, frequencies);

/**
 * What the rack has to produce once this tone is taken off it.
 *
 * The bands with no gain of their own still shape the curve — a notch, a
 * high-pass — and the adjustable ones cannot be asked to undo them, so they
 * come off here too.
 */
export const rebaseToneStack = (
  filters: readonly IFilter[],
  tone: IToneStack,
): IToneBase => {
  const points = controlPoints(filters);
  const measured = responseOf(filters.filter(live), points);
  const already = toneResponse(tone, points);
  const fixed = responseOf(
    filters.filter((band) => live(band) && !adjustable(band)),
    points,
  );
  return {
    points,
    residual: measured.map((value, at) => value - already[at] - fixed[at]),
  };
};

/**
 * Split the rack into the tone it appears to carry and everything else.
 *
 * Called once, when the controls appear, and again whenever the rack changes
 * under them. The constant column is why an overall trim does not read as
 * tone: a rack lifted two decibels everywhere projects onto it and leaves all
 * three controls where they were, which is the answer somebody looking at a
 * flat-but-loud curve would give.
 */
export const openToneStack = (
  filters: readonly IFilter[],
): { tone: IToneStack; base: IToneBase } => {
  const points = controlPoints(filters);
  const empty = { points, residual: points.map(() => 0) };
  if (filters.filter(adjustable).length === 0) {
    return { tone: FLAT_TONE, base: empty };
  }
  const measured = responseOf(filters.filter(live), points);
  const columns = [
    ...KNOBS.map((knob) => toneResponse({ ...FLAT_TONE, [knob]: 1 }, points)),
    points.map(() => 1),
  ];
  const found = leastSquares(columns, measured, RIDGE / 10);
  const read = (at: number) => {
    const value = Math.max(
      -TONE_MAX_DB,
      Math.min(TONE_MAX_DB, Math.round((found[at] ?? 0) * 10) / 10),
    );
    // A dial rounded past zero from below comes back as negative zero, and
    // shows on the face as "-0.0".
    return value === 0 ? 0 : value;
  };
  const tone: IToneStack = { bass: read(0), mid: read(1), treble: read(2) };
  const already = toneResponse(tone, points);
  const fixed = responseOf(
    filters.filter((band) => live(band) && !adjustable(band)),
    points,
  );
  return {
    tone,
    base: {
      points,
      residual: measured.map((value, at) => value - already[at] - fixed[at]),
    },
  };
};

/**
 * The band gains that carry this tone on top of that base.
 *
 * `moved` is which dial was turned, and it is what keeps a dial honest: only
 * the bands that dial speaks for are allowed to change, and every other band
 * stands exactly where it was. Without it the fit is free to answer a lift at
 * the top by tilting the whole rack — the smoothness it is held to makes a
 * long gentle ramp cost nothing, so raising Treble by five put nearly a
 * decibel into the 25 Hz band, which is not what a treble control does.
 * Omitted, every band may move, which is what a fresh rack wants.
 *
 * Returns only the bands that move, as edits, so a caller sends them the way
 * every other multi-band edit is sent.
 */
export const fitToneStack = (
  filters: readonly IFilter[],
  base: IToneBase,
  tone: IToneStack,
  moved?: keyof IToneStack,
): { id: string; gain: number }[] => {
  // In frequency order, because the smoothness the fit is held to is "this
  // band and the one beside it" — which is only a sentence about a rack whose
  // bands are in order. A caller handing them over in any other one would
  // otherwise be penalised for the shape of its own list.
  const all = filters
    .filter(adjustable)
    .slice()
    .sort((one, other) => one.frequency - other.frequency);
  const bands =
    moved === undefined
      ? all
      : all.filter((band) => toneRegionOf(band.frequency) === moved);
  if (bands.length === 0 || base.points.length === 0) {
    return [];
  }
  /**
   * Judged only where the bands that may move can reach.
   *
   * A shelf's skirt runs a long way past the bands that carry it — a Treble
   * of +16 asks for 2.4 dB at 1 kHz, and the treble bands start at 2.5 — and
   * a fit scored on points it cannot reach does the only thing it can: it
   * lifts the bands it DOES own, trying to make up the difference next door.
   * Measured on the twenty-band rack, that put the top of the curve at
   * +18.0 dB where the dial said 16. So the points end one band's gap outside
   * the moving bands, and beyond that the dial is simply not answerable.
   */
  const reach = (() => {
    if (moved === undefined) {
      return base.points;
    }
    const low = bands[0].frequency;
    const high = bands[bands.length - 1].frequency;
    const beside = (at: number, step: number) => {
      const found = all.findIndex((band) => band.frequency === at);
      return all[found + step]?.frequency;
    };
    const floor = Math.sqrt(low * (beside(low, -1) ?? low));
    const ceiling = Math.sqrt(high * (beside(high, 1) ?? high));
    return base.points.filter(
      (frequency) => frequency >= floor && frequency <= ceiling,
    );
  })();
  const keep = base.points
    .map((frequency, at) => (reach.includes(frequency) ? at : -1))
    .filter((at) => at >= 0);
  const points = keep.map((at) => base.points[at]);
  const wanted = toneResponse(tone, points);
  // The bands standing still are part of what the curve already does, so what
  // is left for the moving ones is the target less their share of it.
  const standing = all.filter((band) => !bands.includes(band));
  const held = responseOf(standing, points);
  const target = keep.map(
    (at, index) => base.residual[at] + wanted[index] - held[index],
  );
  /**
   * What one decibel of each band does, everywhere the fit is judged.
   *
   * Measured through the same response the graph is drawn from rather than
   * derived, so a band's type, its width and its place in the rack are all
   * already in the number — and the fit answers for the rack in front of it
   * rather than for an idealised one.
   */
  const columns = bands.map((band) =>
    responseOf([{ ...band, gain: 1 }], points),
  );
  const answer = leastSquares(columns, target, RIDGE, SMOOTHNESS);
  return bands
    .map((band, at) => {
      const fitted = Math.round(clampGain(answer[at]) * 100) / 100;
      // A fiftieth of a decibel is not a tone decision, and left in it shows
      // up: a rack that should read flat reads "-0.0" on the bands the fit
      // rounded past zero.
      const gain = Math.abs(fitted) < 0.02 ? 0 : fitted;
      return { id: band.id, gain, was: band.gain };
    })
    .filter((edit) => Math.abs(edit.gain - edit.was) >= 0.01)
    .map(({ id, gain }) => ({ id, gain }));
};
