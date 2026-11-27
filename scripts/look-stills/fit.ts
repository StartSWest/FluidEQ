/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { biasColumn, chooseRoles, columnOf, scatterOf } from './choose';
import { leastSquares, solveRows } from './linear';

/**
 * How a look's still is split into the window's colours
 * (`src/renderer/graph/lookStills/stillRoles.ts`).
 *
 * The look is drawn many times, the same music each time, under different
 * colours for its roles. A canvas mixes colours linearly - a fill, a
 * gradient between two colours, an alpha, a glow added on top - so each
 * pixel, premultiplied, is the sum of each role's colour times a weight of
 * its own, plus what is drawn in fixed inks:
 *
 *   pixel(state) = sum over roles k of w_k * role_k(state) + b
 *
 * Every state gives three equations a pixel (red, green, blue) in the same
 * unknowns, so a few more states than roles pin the weights down, and the
 * same least-squares answer serves every pixel: it is worked out once and
 * applied to each. Its alpha is the drawing's coverage, which the colours do
 * not move; that is checked, not assumed.
 *
 * The roles are taken one at a time, the one that explains most of what is
 * left first, for as long as one explains more than the drawings' own
 * rounding. Solved all at once, roles that move together - a one-colour
 * ramp is built from the very stop it sits beside - came out as large
 * weights cancelling each other, which no 8-bit mask can hold.
 *
 * Light added on a dark window stops at white: a glowing bar's core is its
 * colour two and three times over, clipped. A drawing clipped there says
 * only "at least this", so a pixel with any is solved from its other
 * drawings alone, and a weight past one is kept as the role laid on again
 * (`ShippedLookStill` adds the layers and clips at white as the canvas did).
 *
 * What is shipped is that answer quantised as the window composites it: an
 * 8-bit mask per layer, and one layer of what is left, unpremultiplied.
 * `reconstruct` paints exactly that composite back, so the generator's
 * measure is the still as it will be seen.
 */

export type TRgb = readonly [number, number, number];

/** One drawing of the look and the colours its roles had while it drew. */
export interface IStateRender {
  /** RGBA, unpremultiplied, as `getImageData` hands it. */
  pixels: Uint8ClampedArray;
  /** Each role's colour, 0..255, as the drawing was handed it. */
  roles: Readonly<Record<string, TRgb>>;
}

export interface IStillFit {
  width: number;
  height: number;
  /**
   * The role each layer is painted in, in the order of `masks`: a role laid
   * on more than once, where its light adds past one, is named each time.
   */
  roles: readonly string[];
  /** Per layer, per pixel, how much of its role lands there: 0..255. */
  masks: readonly Uint8Array[];
  /** What is left, per pixel, as RGBA unpremultiplied: 0..255. */
  rest: Uint8Array;
  /**
   * The largest change in coverage between two drawings, 0..255: above a
   * few steps, a colour decided what was drawn and not only its colour.
   */
  coverageDrift: number;
  /** What each role explained as it was taken, squared error over the still. */
  gains: readonly number[];
}

/**
 * The squared error one more unknown takes up from each drawn pixel by
 * fitting the 8-bit rounding of the drawings and nothing else: a rounding
 * error is uniform over one step, so its variance is a twelfth of a step
 * squared.
 */
const ROUNDING_VARIANCE = 1 / (255 * 255 * 12);
/**
 * How many times the rounding a role has to explain to be taken. Over a
 * whole still a role the look never paints in explains about one rounding
 * a pixel; one that paints even a hairline explains hundreds.
 */
const NOISE_MARGIN = 20;
/**
 * What is left over of this many steps or fewer is the drawings' rounding,
 * not paint: kept, it speckles the layer, and a speckled layer took several
 * times the bytes of a clean one. What it could carry is a step of colour.
 */
const SPECK = 1;
/**
 * The levels a mask is kept in: 64, a step of four in 255, half of which
 * is the most it is off - two steps of a colour at full strength, under
 * what the eye tells apart on a tile. The two bits under it are the
 * drawings' rounding, and they were a third of every mask's bytes.
 */
const MASK_LEVELS = 63;
/** A role laid on at most this many times; past it, white anyway. */
const MOST_LAYERS = 4;
/** A drawing's channel this full, at full coverage, was clipped at white. */
const CLIPPED = 254.5 / 255;
/**
 * Light the roles put past this in at least one of a pixel's full drawings
 * was clipped there; a pixel none of whose full drawings reach it was a
 * colour at its brightest. A few steps over white, for the rounding.
 */
const PAST_WHITE = 1.02;

/**
 * Every pixel's drawings, premultiplied, one row of state x channel each,
 * and which pixels were clipped at white in any of them.
 */
const observe = (renders: readonly IStateRender[], count: number) => {
  const size = renders.length * 3;
  const observed = new Float64Array(count * size);
  const clipped = new Uint8Array(count);
  renders.forEach((render, state) => {
    for (let pixel = 0; pixel < count; pixel += 1) {
      const at = pixel * 4;
      const alpha = render.pixels[at + 3] / 255;
      for (let channel = 0; channel < 3; channel += 1) {
        const value = (render.pixels[at + channel] / 255) * alpha;
        observed[pixel * size + state * 3 + channel] = value;
        if (value >= CLIPPED) {
          clipped[pixel] = 1;
        }
      }
    }
  });
  return { observed, size, clipped };
};

/**
 * Every pixel's unknowns, `columns.length` each: from the one shared answer
 * where no drawing clipped, from the unclipped drawings alone where any did.
 */
const solveWeights = (
  columns: readonly Float64Array[],
  observed: Float64Array,
  size: number,
  count: number,
  clipped: Uint8Array,
): Float64Array => {
  const unknowns = columns.length;
  const solver = leastSquares(columns);
  const solved = new Float64Array(count * unknowns);
  const one = new Float64Array(unknowns);
  for (let pixel = 0; pixel < count; pixel += 1) {
    const base = pixel * size;
    if (clipped[pixel]) {
      solveRows(
        columns,
        observed,
        base,
        (row) => observed[base + row] < CLIPPED,
        one,
      );
      // A channel clipped in every drawing is white whatever the colours:
      // its fixed ink is, the last three unknowns.
      for (let channel = 0; channel < 3; channel += 1) {
        let always = true;
        for (let row = channel; row < size; row += 3) {
          always = always && observed[base + row] >= CLIPPED;
        }
        if (always) {
          const bias = unknowns - 3 + channel;
          one[bias] = Math.max(one[bias], 1);
        }
      }
      solved.set(one, pixel * unknowns);
    } else {
      for (let unknown = 0; unknown < unknowns; unknown += 1) {
        const line = solver[unknown];
        let sum = 0;
        for (let index = 0; index < size; index += 1) {
          sum += line[index] * observed[base + index];
        }
        solved[pixel * unknowns + unknown] = sum;
      }
    }
  }
  return solved;
};

/** A weight as a mask's step: one of `MASK_LEVELS` + 1, as a byte. */
const maskByte = (weight: number) =>
  Math.round(
    (Math.round(Math.max(0, Math.min(1, weight)) * MASK_LEVELS) * 255) /
      MASK_LEVELS,
  );

/**
 * Splits `renders` (every one the same size, the same music) into masks for
 * the `candidates` that every render names, keeping those that are painted.
 */
export const fitStill = (
  renders: readonly IStateRender[],
  candidates: readonly string[],
  width: number,
  height: number,
): IStillFit => {
  const count = width * height;
  const named = candidates.filter((role) =>
    renders.every((render) => render.roles[role] !== undefined),
  );
  const { observed, size, clipped } = observe(renders, count);
  let drawn = 0;
  for (let pixel = 0; pixel < count; pixel += 1) {
    if (renders.some((render) => render.pixels[pixel * 4 + 3] > 0)) {
      drawn += 1;
    }
  }
  const minGain = NOISE_MARGIN * drawn * ROUNDING_VARIANCE;
  const columnsFor = (roles: readonly string[]) => [
    ...roles.map((role) => columnOf(renders, role)),
    ...[0, 1, 2].map((channel) => biasColumn(renders, channel)),
  ];
  // A full channel is light added past white, or a role's own colour at its
  // brightest (a Spectrogram's hottest step, near white). Chosen first from
  // the pixels with none, the roles say which: a pixel their answer puts
  // past white in none of its full drawings was colour all along, and joins
  // the second choice whole. Left out, its roles were never taken.
  const first = chooseRoles(
    renders,
    named,
    scatterOf(observed, size, count, clipped),
    minGain,
  );
  const firstColumns = columnsFor(first.roles);
  const firstSolved = solveWeights(
    firstColumns,
    observed,
    size,
    count,
    clipped,
  );
  for (let pixel = 0; pixel < count; pixel += 1) {
    const base = pixel * size;
    let brightest = 0;
    for (let row = 0; row < size && clipped[pixel]; row += 1) {
      if (observed[base + row] >= CLIPPED) {
        let predicted = 0;
        firstColumns.forEach((column, unknown) => {
          predicted +=
            column[row] * firstSolved[pixel * firstColumns.length + unknown];
        });
        brightest = Math.max(brightest, predicted);
      }
    }
    if (clipped[pixel] && brightest < PAST_WHITE) {
      clipped[pixel] = 0;
    }
  }
  const { roles: used, gains } = chooseRoles(
    renders,
    named,
    scatterOf(observed, size, count, clipped),
    minGain,
  );
  const columns = columnsFor(used);
  const unknowns = columns.length;
  const solved = solveWeights(columns, observed, size, count, clipped);
  // A role whose light adds past one is laid on as many times as it needs;
  // one that lands nowhere once the clipped drawings are set aside, never.
  const layers = used.flatMap((role, index) => {
    let most = 0;
    for (let pixel = 0; pixel < count; pixel += 1) {
      most = Math.max(most, solved[pixel * unknowns + index]);
    }
    const times = Math.max(
      0,
      Math.min(MOST_LAYERS, Math.ceil(most - 0.5 / MASK_LEVELS)),
    );
    return Array.from({ length: times }, (_, time) => ({ role, index, time }));
  });
  const masks = layers.map(() => new Uint8Array(count));
  const rest = new Uint8Array(count * 4);
  let coverageDrift = 0;
  for (let pixel = 0; pixel < count; pixel += 1) {
    let coverage = 0;
    let lowest = 255;
    let highest = 0;
    renders.forEach((render) => {
      const alpha = render.pixels[pixel * 4 + 3];
      coverage += alpha;
      lowest = Math.min(lowest, alpha);
      highest = Math.max(highest, alpha);
    });
    coverageDrift = Math.max(coverageDrift, highest - lowest);
    coverage /= renders.length * 255;
    let painted = 0;
    layers.forEach(({ index, time }, layer) => {
      masks[layer][pixel] = maskByte(solved[pixel * unknowns + index] - time);
      painted += masks[layer][pixel] / 255;
    });
    // What the fixed inks add, premultiplied, under the coverage the roles
    // leave; never under its own colour, or it could not be stored.
    const fixed = [0, 1, 2].map((channel) => {
      const value = solved[pixel * unknowns + used.length + channel];
      return value * 255 > SPECK ? value : 0;
    });
    const restAlpha = Math.min(
      1,
      Math.max(coverage - painted, ...fixed.map((value) => Math.min(1, value))),
    );
    const restRounded = Math.round(restAlpha * 255);
    const restByte = restRounded > SPECK ? restRounded : 0;
    rest[pixel * 4 + 3] = restByte;
    if (restByte > 0) {
      fixed.forEach((value, channel) => {
        rest[pixel * 4 + channel] = Math.round(
          Math.min(1, value / (restByte / 255)) * 255,
        );
      });
    }
  }
  return {
    width,
    height,
    roles: layers.map(({ role }) => role),
    masks,
    rest,
    coverageDrift,
    // Each role laid on, once, in the order taken.
    gains: used.flatMap((role, index) =>
      layers.some((layer) => layer.role === role) ? [gains[index]] : [],
    ),
  };
};

/**
 * The still as the window composites it (`ShippedLookStill`), premultiplied
 * RGBA in 0..1: the rest, then each layer's colour through its mask, added,
 * clipped at white as `plus-lighter` clips.
 */
export const reconstruct = (
  fit: IStillFit,
  roles: Readonly<Record<string, TRgb>>,
): Float64Array => {
  const count = fit.width * fit.height;
  const out = new Float64Array(count * 4);
  for (let pixel = 0; pixel < count; pixel += 1) {
    const restAlpha = fit.rest[pixel * 4 + 3] / 255;
    const sums = [0, 1, 2].map(
      (channel) => (fit.rest[pixel * 4 + channel] / 255) * restAlpha,
    );
    let alpha = restAlpha;
    fit.roles.forEach((role, index) => {
      const weight = fit.masks[index][pixel] / 255;
      const colour = roles[role];
      alpha += weight;
      sums[0] += (weight * colour[0]) / 255;
      sums[1] += (weight * colour[1]) / 255;
      sums[2] += (weight * colour[2]) / 255;
    });
    out[pixel * 4] = Math.min(1, sums[0]);
    out[pixel * 4 + 1] = Math.min(1, sums[1]);
    out[pixel * 4 + 2] = Math.min(1, sums[2]);
    out[pixel * 4 + 3] = Math.min(1, alpha);
  }
  return out;
};

export interface IStillError {
  /** Mean difference over the plate, per channel, in steps of 255. */
  mean: number;
  /** The difference 99% of the drawn pixels stay within. */
  p99: number;
  /** The largest difference anywhere. */
  max: number;
}

/**
 * How far `fit` in `render`'s colours is from `render` itself, both laid on
 * `ground` (the window's floor) as the plate shows them: what the eye would
 * see differ, in steps of 255.
 */
export const stillError = (
  fit: IStillFit,
  render: IStateRender,
  ground: TRgb,
): IStillError => {
  const rebuilt = reconstruct(fit, render.roles);
  const count = fit.width * fit.height;
  const differences: number[] = [];
  let total = 0;
  let largest = 0;
  for (let pixel = 0; pixel < count; pixel += 1) {
    const realAlpha = render.pixels[pixel * 4 + 3] / 255;
    const rebuiltAlpha = rebuilt[pixel * 4 + 3];
    // Measured where something is drawn, in the look or in the still: the
    // bare plate would hide a bad still under its own agreement.
    if (realAlpha > 0 || rebuiltAlpha > 0) {
      let worst = 0;
      for (let channel = 0; channel < 3; channel += 1) {
        const real =
          (render.pixels[pixel * 4 + channel] / 255) * realAlpha +
          (ground[channel] / 255) * (1 - realAlpha);
        const made =
          rebuilt[pixel * 4 + channel] +
          (ground[channel] / 255) * (1 - rebuiltAlpha);
        const difference = Math.abs(real - made) * 255;
        total += difference / 3;
        worst = Math.max(worst, difference);
      }
      differences.push(worst);
      largest = Math.max(largest, worst);
    }
  }
  differences.sort((left, right) => left - right);
  const p99 =
    differences.length > 0
      ? differences[Math.floor((differences.length - 1) * 0.99)]
      : 0;
  return {
    mean: differences.length > 0 ? total / differences.length : 0,
    p99,
    max: largest,
  };
};
