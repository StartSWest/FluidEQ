/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A travel that stands one value at its middle, whatever the range around it.
 *
 * The preamp runs from -60 dB to +20 and rests at 0. On an even travel that
 * rest sat three quarters of the way round the side panel's dial and three
 * quarters up the player's fader, where a level doing nothing reads as one
 * turned most of the way up (Ivan, 2026-09-24: "center 0 on top not to the
 * side, make 60 some how compress"). Here each side of the centre gets half
 * the travel: the short side evenly, the long side compressed — as fine as
 * the short side where it leaves the centre, so the first decibels below 0
 * take the same hand as the first ones above, and coarser towards its far
 * end, where nobody places a tenth of a decibel. On the preamp, -10 dB sits
 * 18% of the travel below the centre where +10 sits 25% above it, -20 at
 * 28%, and -40 at 41%.
 *
 * The long side is `ln(1 + k·x) / ln(1 + k)` of its share, with `k` chosen so
 * its slope at the centre is the short side's. With the two sides equal that
 * is the even travel, so a range that straddles its centre evenly — every
 * band fader, ±20 dB — moves exactly as it always did.
 */
export interface ISweep {
  /** Where a value stands, 0 at the low end to 1 at the high end. */
  toPosition: (value: number) => number;
  /** The value at a position: the inverse of `toPosition`. */
  toValue: (position: number) => number;
}

/** Below this ratio of the two sides the compression is the even travel. */
const EVEN = 1 + 1e-9;

/**
 * The `k` whose curve leaves the centre `ratio` times steeper than an even
 * one: `k / ln(1 + k) = ratio`. That quotient climbs from 1 without bound as
 * `k` grows, so halving the bracket finds the one answer.
 */
const steepness = (ratio: number): number => {
  const slope = (k: number) => k / Math.log1p(k);
  let low = 0;
  let high = 1;
  while (slope(high) < ratio) {
    high *= 2;
  }
  for (let step = 0; step < 80; step += 1) {
    const middle = (low + high) / 2;
    if (slope(middle) < ratio) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
};

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

const centredSweep = (min: number, centre: number, max: number): ISweep => {
  const below = centre - min;
  const above = max - centre;
  if (!(below > 0 && above > 0)) {
    // A centre at or past an end is no centre: the travel is the even one.
    const span = max - min;
    return {
      toPosition: (value) =>
        span > 0 ? (clamp(value, min, max) - min) / span : 0,
      toValue: (position) => min + clamp(position, 0, 1) * span,
    };
  }
  const ratio = Math.max(below, above) / Math.min(below, above);
  const isEven = ratio < EVEN;
  const k = isEven ? 0 : steepness(ratio);
  const squeeze = (share: number) =>
    isEven ? share : Math.log1p(k * share) / Math.log1p(k);
  const unsqueeze = (share: number) =>
    isEven ? share : Math.expm1(share * Math.log1p(k)) / k;
  const belowIsLong = below > above;
  const aboveIsLong = above > below;

  return {
    toPosition: (value) => {
      const clamped = clamp(value, min, max);
      if (clamped >= centre) {
        const share = (clamped - centre) / above;
        return 0.5 + 0.5 * (aboveIsLong ? squeeze(share) : share);
      }
      const share = (centre - clamped) / below;
      return 0.5 - 0.5 * (belowIsLong ? squeeze(share) : share);
    },
    toValue: (position) => {
      const clamped = clamp(position, 0, 1);
      if (clamped >= 0.5) {
        const share = (clamped - 0.5) * 2;
        return centre + above * (aboveIsLong ? unsqueeze(share) : share);
      }
      const share = (0.5 - clamped) * 2;
      return centre - below * (belowIsLong ? unsqueeze(share) : share);
    },
  };
};

export default centredSweep;
