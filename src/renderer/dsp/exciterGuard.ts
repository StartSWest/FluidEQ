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
const MAX_RETURN_GAIN = 1;
const RETURN_TAPER = 0.6;
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
 * How much of a band's return reaches the mix, 0 to 1.
 *
 * One curve for all three bands. There were two, because High returned
 * harmonics over a quiet carrier while Low and Mid returned a full copy of
 * their own filtered band — three-quarters of a dial spent keeping that copy
 * from becoming an equaliser. Every band returns harmonics over the same quiet
 * carrier now, so the distinction has nothing left to describe.
 *
 * The old law reached only 70% and used a 0.35 taper, which put 0.1 at 0.31 and
 * 1.0 at 0.70: the whole knob was worth 7 dB, and neither half of its travel
 * changed much. A 0.6 taper over a full-scale top gives it 12 dB and still
 * spends more travel low down, where an audio taper belongs — and zero is still
 * true silence.
 */
export const exciterReturnGain = (amount: number): number => {
  const safeAmount = Math.max(0, Math.min(1, amount));
  return MAX_RETURN_GAIN * safeAmount ** RETURN_TAPER;
};

/** Organic's approved harmonics stay forward without raising its foundation. */
export const organicExciterReturnGain = (amount: number): number => {
  const safeAmount = Math.max(0, Math.min(1, amount));
  return ORGANIC_MAX_RETURN_GAIN * safeAmount ** ORGANIC_RETURN_TAPER;
};

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
