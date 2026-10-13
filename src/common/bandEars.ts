/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TBandChannel, TBandSide } from './constants';

/**
 * A band plays on both ears, or as a pair: one on the left and one on the
 * right at the same frequency, each moved on its own (Ivan, 2026-10-13: "lets
 * do both and left + right if user choose left + right for that band then
 * they can control same freq individual", "if they choose both then it joins
 * the mid"). Choosing an ear alone is not offered: three lines of left, right
 * and both read as confusing, and a band on one ear only is a pair whose
 * other half sits flat.
 *
 * Left + right on a band on both ears keeps it on the left and adds the same
 * band — shape, frequency, gain, width, switch — on the right. Both ears on
 * either half joins them in the middle: the frequency halfway on a log scale,
 * the gain and the width their average, and the other half goes.
 *
 * A pair is not stored as a link: a band's twin is the band on the other ear,
 * of the same shape, nearest in frequency (on a log scale, as the graph draws
 * it), and each band is claimed once. Both EQs run this one rule — the main
 * EQ's bands and the DSP rack's — so a pair splits and joins the same in
 * either.
 */

/** What the band menu offers: one band on both ears, or a pair. */
export type TEarChoice = 'both' | 'split';

export const EAR_CHOICES: readonly TEarChoice[] = ['both', 'split'];

/** What the rule needs of a band, whichever EQ it belongs to. */
export interface IEarBand {
  key: string;
  frequency: number;
  gain: number;
  quality: number;
  type: string;
  ear?: TBandChannel;
}

/** Where a pair is joined: the values the joined band takes. */
export interface IEarMiddle {
  frequency: number;
  gain: number;
  quality: number;
}

export interface IEarPlan {
  /** Bands whose ear changes, to `ear` (`both` takes the ear away). */
  ears: { key: string; ear: TBandSide; middle?: IEarMiddle }[];
  /** New twins: a copy of `from` on `ear`. */
  copies: { from: string; ear: TBandChannel }[];
  /** Twins joined back into the band asked. */
  removed: string[];
}

export const otherEar = (ear: TBandChannel): TBandChannel =>
  ear === 'left' ? 'right' : 'left';

/** What a band's menu shows ticked: both ears, a pair, or nothing when mixed. */
export const earChoiceOf = (
  bands: readonly { channel?: TBandChannel }[],
): TEarChoice | undefined => {
  if (bands.every((band) => band.channel === undefined)) {
    return 'both';
  }
  return bands.every((band) => band.channel !== undefined)
    ? 'split'
    : undefined;
};

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
 * The middle of a pair: halfway in frequency as the ear hears it (the
 * geometric mean), and the average gain and width — rounded to the steps the
 * editor shows, a whole hertz, a tenth of a decibel, a hundredth of Q.
 */
const middleOf = (a: IEarBand, b: IEarBand): IEarMiddle => ({
  frequency: Math.round(Math.sqrt(a.frequency * b.frequency)),
  gain: Math.round(((a.gain + b.gain) / 2) * 10) / 10,
  quality: Math.round(((a.quality + b.quality) / 2) * 100) / 100,
});

/**
 * What choosing `choice` for `targets` does to the EQ. `room` is how many
 * bands it can still take: a band with no room for its twin stays on both
 * ears, because half of a pair alone would silence that band on one ear.
 */
export const planEarChange = (
  bands: readonly IEarBand[],
  targets: readonly string[],
  choice: TEarChoice,
  room: number,
): IEarPlan => {
  const plan: IEarPlan = { ears: [], copies: [], removed: [] };
  // Every band already joined or split here, so none is handled twice: a
  // selection holding both halves of a pair joins it once.
  const handled = new Set<string>();
  let left = room;
  targets.forEach((key) => {
    const band = bands.find((one) => one.key === key);
    if (band === undefined || handled.has(key)) {
      return;
    }
    handled.add(key);
    if (choice === 'split') {
      if (band.ear !== undefined || left === 0) {
        return;
      }
      left -= 1;
      plan.ears.push({ key, ear: 'left' });
      plan.copies.push({ from: key, ear: 'right' });
      return;
    }
    if (band.ear === undefined) {
      return;
    }
    const twin = twinOf(bands, band, handled);
    if (twin === undefined) {
      plan.ears.push({ key, ear: 'both' });
      return;
    }
    handled.add(twin.key);
    plan.ears.push({ key, ear: 'both', middle: middleOf(band, twin) });
    plan.removed.push(twin.key);
  });
  return plan;
};
