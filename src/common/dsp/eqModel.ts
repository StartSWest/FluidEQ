/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum, NO_GAIN_FILTER_TYPES } from '../constants';
import type { TEqModel } from './chain';

/**
 * The Q a band of the rack's EQ is built with, under its model — the law of
 * `feq_biquad_coefficients_modelled` in `biquad.cpp`, which the native EQ
 * runs, the DSP page draws (`renderer/dsp/biquad.ts`) and a preset's curve is
 * written to the main EQ with (`presetVoicing.ts`). One law in each language:
 * a curve fitted through a model and then played without it is another
 * curve, and that is exactly what a preset's tone did in the main EQ from
 * 2026-09-21 to 09-23 — every Wide preset played bands twice as narrow as
 * the ones its gains were fitted to, a row of bumps where a tilt was drawn.
 */

/**
 * How much the Q tightens as a band is driven harder.
 *
 * At full boost the band ends up about twice as narrow as its dial says. That
 * is the behaviour of the classic wide-and-punchy console equalisers: a small
 * move is broad and gentle, a large one focuses on the frequency it was aimed
 * at instead of dragging its neighbours with it. It is the same curve at 1 dB
 * and a different instrument at 12.
 *
 * It is the main equaliser's own law (`shapeEqFilters` in `eqShape.ts`)
 * rather than a second one. Both pages offer the same character under the
 * same name, so they have to mean the same thing by it: the two used to
 * differ by half again at 12 dB — ×1.8 here against ×1.41 there — which is a
 * band sounding one way on the EQ page and another in the rack with both
 * dials reading the same.
 */
const narrowing = (gainDb: number): number =>
  Math.sqrt(1 + Math.min(20, Math.abs(gainDb)) / 12);

interface IModelledBand {
  type: FilterTypeEnum;
  gainDb: number;
  quality: number;
}

const proportionalQuality = (
  { gainDb, quality }: IModelledBand,
  amount: number,
): number => Math.min(18, quality * (1 + amount * (narrowing(gainDb) - 1)));

/**
 * Cuts narrow, boosts widen — the mastering engineer's habit, as a character.
 *
 * A cut is usually aimed at something specific and wants to take as little
 * else with it as it can; a boost is usually a tone move and wants to be
 * broad enough not to read as a resonance. Which is exactly the opposite
 * treatment for the same dial, and why this cannot be proportional with a
 * sign flipped in the amount.
 */
const asymmetricQuality = (
  { gainDb, quality }: IModelledBand,
  amount: number,
): number => {
  const factor = 1 + amount * (narrowing(gainDb) - 1);
  return gainDb > 0
    ? Math.max(0.25, quality / factor)
    : Math.min(18, quality * factor);
};

/**
 * Broad and overlapping, the way a passive tone stack behaves.
 *
 * The opposite character to proportional: instead of focusing as it is driven,
 * a band here always reaches well past its own centre, so neighbouring bands
 * blend into one another and the result is a tilt rather than a set of bumps.
 * It is the gentler, rounder sound, and it is the one that flatters a whole
 * mix where a narrow band would sound like a repair.
 *
 * Shelves get it worse than bells on purpose: a shallow shelf is most of what
 * makes that style of equaliser sound like itself.
 */
const wideQuality = (
  { type, quality }: IModelledBand,
  amount: number,
): number => {
  const isShelf = type === FilterTypeEnum.LSC || type === FilterTypeEnum.HSC;
  const full = isShelf ? 0.4 : 0.45;
  // Interpolated from 1 (untouched) toward the character's own factor, so the
  // amount dial reaches the cookbook at zero rather than an arbitrary middle.
  return Math.max(0.25, quality * (1 - amount * (1 - full)));
};

/**
 * The Q a band is built with. Its own where there is nothing to model: the
 * clean model, an amount of zero, no gain — every design collapses to the
 * same filter there — or a type with no gain to shape.
 */
const modelledQuality = (
  band: IModelledBand,
  model: TEqModel,
  /** 0 collapses every character to the cookbook, which is the off position. */
  amount: number,
): number => {
  if (
    model === 'clean' ||
    amount <= 0 ||
    band.gainDb === 0 ||
    NO_GAIN_FILTER_TYPES.includes(band.type)
  ) {
    return band.quality;
  }
  if (model === 'proportional') {
    return proportionalQuality(band, amount);
  }
  if (model === 'asymmetric') {
    return asymmetricQuality(band, amount);
  }
  return wideQuality(band, amount);
};

export default modelledQuality;
