/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum } from '../../common/constants';
import {
  IBiquadCoefficients,
  IBiquadState,
  biquadCoefficients,
  createBiquadState,
  processBiquad,
} from './biquad';

/**
 * A fixed contour on the Exciter return, never on the original programme.
 *
 * A de-esser listens for sibilants and changes gain with the programme. This
 * deliberately does neither: it prevents the additive sidechain from piling
 * another full-strength layer onto the broad 5-9 kHz consonant region, while
 * recovering above it so the air octave remains available. Custom settings and
 * every profile receive the same protection.
 */
const SIBILANCE_CENTRE_HZ = 7_200;
const SIBILANCE_RETURN_CUT_DB = -5.5;
const SIBILANCE_QUALITY = 1.25;
const PARAMETER_SMOOTHING_MS = 18;
const MAX_RETURN_GAIN = 0.7;
const RETURN_TAPER = 0.35;
const HIGH_MAX_RETURN_GAIN = 0.95;
const HIGH_RETURN_TAPER = 0.45;
const ORGANIC_MAX_RETURN_GAIN = 0.95;
const ORGANIC_RETURN_TAPER = 0.42;

const IDENTITY_COEFFICIENTS: IBiquadCoefficients = {
  b0: 1,
  b1: 0,
  b2: 0,
  a1: 0,
  a2: 0,
};

export interface IExciterGuardState {
  filter: IBiquadState;
  coefficients: IBiquadCoefficients;
  sampleRate: number;
  amount: number;
  filtered: Float32Array;
}

export const createExciterGuard = (): IExciterGuardState => ({
  filter: createBiquadState(),
  coefficients: IDENTITY_COEFFICIENTS,
  sampleRate: 0,
  amount: 0,
  filtered: new Float32Array(128),
});

/**
 * The original Exciter attenuates its complete processed sidechain before it is
 * mixed under dry. With the filtered foundation inside that return, a gain law
 * intended for a harmonic residue would add a second loud copy of each band. A
 * full dial reaches 70%, matching the useful upper region described for the
 * original parallel return. The control uses an audio taper rather than a
 * linear multiplier: authored 4-22% profile values must remain useful beneath
 * mastered programme, while zero must still be true silence. This is the same
 * reason level controls are normally tapered — equal control travel should not
 * be spent on changes that sit below perception.
 */
export const safeExciterReturnGain = (amount: number): number => {
  const safeAmount = Math.max(0, Math.min(1, amount));
  return MAX_RETURN_GAIN * safeAmount ** RETURN_TAPER;
};

/** High keeps more useful travel at the top while preserving its default. */
export const highExciterReturnGain = (amount: number): number => {
  const safeAmount = Math.max(0, Math.min(1, amount));
  return HIGH_MAX_RETURN_GAIN * safeAmount ** HIGH_RETURN_TAPER;
};

/** Organic's approved harmonics stay forward without raising its foundation. */
export const organicExciterReturnGain = (amount: number): number => {
  const safeAmount = Math.max(0, Math.min(1, amount));
  return ORGANIC_MAX_RETURN_GAIN * safeAmount ** ORGANIC_RETURN_TAPER;
};

export const bandExciterReturnGain = (
  amount: number,
  bandIndex: number,
): number =>
  bandIndex === 2
    ? highExciterReturnGain(amount)
    : safeExciterReturnGain(amount);

/** Smoothly enters and leaves the consonant region; there is no hard switch. */
export const organicSibilanceProtection = (focusHz: number): number => {
  if (focusHz <= 4_500 || focusHz >= 11_000) {
    return 0;
  }
  if (focusHz < 5_500) {
    return (focusHz - 4_500) / 1_000;
  }
  if (focusHz > 9_000) {
    return (11_000 - focusHz) / 2_000;
  }
  return 1;
};

export const guardExciterReturn = (
  state: IExciterGuardState,
  target: Float32Array,
  sampleRate: number,
  amount = 1,
): void => {
  if (state.sampleRate !== sampleRate) {
    state.sampleRate = sampleRate;
    state.coefficients = biquadCoefficients(
      {
        type: FilterTypeEnum.PK,
        frequency: SIBILANCE_CENTRE_HZ,
        gainDb: SIBILANCE_RETURN_CUT_DB,
        quality: SIBILANCE_QUALITY,
      },
      sampleRate,
    );
  }
  if (state.filtered.length !== target.length) {
    state.filtered = new Float32Array(target.length);
  }
  state.filtered.set(target);
  processBiquad(state.filter, state.filtered, state.coefficients);
  const targetAmount = Math.max(0, Math.min(1, amount));
  const smooth =
    1 - Math.exp(-1 / ((PARAMETER_SMOOTHING_MS / 1_000) * sampleRate));
  for (let sample = 0; sample < target.length; sample += 1) {
    state.amount += (targetAmount - state.amount) * smooth;
    target[sample] += (state.filtered[sample] - target[sample]) * state.amount;
  }
};
