/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TBandChannel, TBandSide } from './constants';

/**
 * A band kept to one ear leaves its twin on the other (Ivan, 2026-10-13: "if
 * they wanna move x band on the left we still need same band for the right
 * to be available").
 *
 * Picking Left ear only on a band on both ears keeps it on the left and adds
 * the same band — shape, frequency, gain, width, switch — on the right, so
 * each ear can then be moved on its own and neither loses what it had.
 * Picking Both ears on either of the two joins them again: the band asked
 * becomes both-eared and its twin goes. Moving a one-ear band to the other
 * ear moves its twin the other way, so the pair stays a pair.
 *
 * A twin is not stored as a link: it is the band on the other ear, of the
 * same shape, nearest in frequency (on a log scale, as the graph draws it),
 * and each band is claimed once. Both EQs run this one rule — the main EQ's
 * bands and the DSP rack's — so a pair splits and joins the same in either.
 */

/** What the rule needs of a band, whichever EQ it belongs to. */
export interface IEarBand {
  key: string;
  frequency: number;
  type: string;
  ear?: TBandChannel;
}

export interface IEarPlan {
  /** Bands whose ear changes, to `ear` (`both` takes the ear away). */
  ears: { key: string; ear: TBandSide }[];
  /** New twins: a copy of `from` on `ear`. */
  copies: { from: string; ear: TBandChannel }[];
  /** Twins joined back into the band asked. */
  removed: string[];
}

export const otherEar = (ear: TBandChannel): TBandChannel =>
  ear === 'left' ? 'right' : 'left';

/**
 * The twin of `band`: on the other ear, the same shape, nearest in
 * frequency, not one of `excluded`.
 */
const twinOf = (
  bands: readonly IEarBand[],
  band: IEarBand,
  excluded: ReadonlySet<string>,
): IEarBand | undefined => {
  if (band.ear === undefined) {
    return undefined;
  }
  const wanted = otherEar(band.ear);
  let best: IEarBand | undefined;
  let bestDistance = Infinity;
  bands.forEach((one) => {
    if (
      one.key === band.key ||
      one.ear !== wanted ||
      one.type !== band.type ||
      excluded.has(one.key)
    ) {
      return;
    }
    const distance = Math.abs(Math.log2(one.frequency / band.frequency));
    if (distance < bestDistance) {
      best = one;
      bestDistance = distance;
    }
  });
  return best;
};

/**
 * What putting `targets` on `side` does to the rack. `room` is how many
 * bands the rack can still take: past it a band is kept to its ear without
 * a twin, which is what it did before twins existed.
 */
export const planEarChange = (
  bands: readonly IEarBand[],
  targets: readonly string[],
  side: TBandSide,
  room: number,
): IEarPlan => {
  const plan: IEarPlan = { ears: [], copies: [], removed: [] };
  // The bands asked are never one another's twin, and no twin serves twice.
  const claimed = new Set(targets);
  let left = room;
  targets.forEach((key) => {
    const band = bands.find((one) => one.key === key);
    if (band === undefined || (band.ear ?? 'both') === side) {
      return;
    }
    if (side === 'both') {
      // Joined: the twin's work is this band's now, on both ears.
      plan.ears.push({ key, ear: 'both' });
      const twin = twinOf(bands, band, claimed);
      if (twin) {
        claimed.add(twin.key);
        plan.removed.push(twin.key);
      }
      return;
    }
    if (band.ear === undefined) {
      plan.ears.push({ key, ear: side });
      if (left > 0) {
        left -= 1;
        plan.copies.push({ from: key, ear: otherEar(side) });
      }
      return;
    }
    // From one ear to the other: the twin crosses the other way.
    plan.ears.push({ key, ear: side });
    const twin = twinOf(bands, band, claimed);
    if (twin) {
      claimed.add(twin.key);
      plan.ears.push({ key: twin.key, ear: otherEar(side) });
    }
  });
  return plan;
};
