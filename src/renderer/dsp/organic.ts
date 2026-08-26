/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IOversamplerState,
  createOversampler,
  downsample,
  oversampleFactorForSampleRate,
  upsample,
} from './oversample';
import {
  ANALOG_DIODE_MAX_CHARACTER,
  IExciterTransientState,
  analogDiodeExcitedSample,
  createExciterTransientState,
  exciterTransientSample,
  limitExciterCurrent,
  resetExciterTransientState,
} from './analogDiode';

/**
 * Material voicing for a clean, metallic presentation.
 *
 * Its even-dominant body makes a titanium-style driver feel warmer and more
 * cellulose-like without removing the original detail. It is not a second
 * High exciter, a broadband saturator, or a random LFO.
 */
const MAX_OVERSAMPLE = 4;
const PARAMETER_SMOOTHING_MS = 18;
const ORGANIC_LEVEL = 0.65;
/** Keep enough carrier to bind the return to the note, without duplicating it. */
const ORGANIC_FOUNDATION_MIX = 0.8;
export const ORGANIC_FOUNDATION_GAIN = ORGANIC_LEVEL * ORGANIC_FOUNDATION_MIX;
const ORGANIC_HARMONIC_GAIN = 2.4;
const ORGANIC_TRANSIENT_HARMONIC_LIFT = 0.35;

export interface IOrganicState {
  oversampler: IOversamplerState;
  wide: Float32Array;
  wideDry: Float32Array;
  drive: number;
  asymmetry: number;
  transient: IExciterTransientState;
}

export const createOrganicState = (blockSize: number): IOrganicState => ({
  oversampler: createOversampler(blockSize),
  wide: new Float32Array(blockSize * MAX_OVERSAMPLE),
  wideDry: new Float32Array(blockSize * MAX_OVERSAMPLE),
  drive: 0,
  asymmetry: 0,
  transient: createExciterTransientState(),
});

/** The amount dial reaches a broad useful range without becoming fuzz. */
export const organicDrive = (amount: number): number => 0.8 + amount * 2.2;

/** Organic stays even-dominant; the upper travel only adds a little density. */
export const organicAsymmetry = (amount: number): number =>
  0.78 + amount * 0.17;

/**
 * The same soft-diode current used by the approved Low/Mid/High bands.
 *
 * Organic keeps the curve strongly even-dominant for body. Its focused,
 * phase-shaped fundamental supplies the continuous foundation and its curvature
 * supplies density. Its transient detector only leans on that curvature; there
 * is no hard gate, random drift, block-rate gain, or hidden carrier.
 */
export const organicSample = (
  sample: number,
  drive: number,
  asymmetry: number,
  harmonicGain = 1,
): number => {
  const character = (1 - asymmetry) * ANALOG_DIODE_MAX_CHARACTER;
  const foundation = sample * ORGANIC_LEVEL;
  const complete = analogDiodeExcitedSample(
    sample,
    drive,
    character,
    ORGANIC_LEVEL,
    harmonicGain * ORGANIC_HARMONIC_GAIN,
  );
  return limitExciterCurrent(
    foundation * ORGANIC_FOUNDATION_MIX + (complete - foundation),
  );
};

export const resetOrganicTransient = (state: IOrganicState): void =>
  resetExciterTransientState(state.transient);

/**
 * Replace a band with only its generated harmonic residue.
 *
 * User controls and the bounded transient emphasis both move per sample. There
 * is no random drift, waveform replacement, block energy match, or block-rate
 * gain. Processing targets a 176.4/192 kHz ceiling: 4x at 44.1/48, 2x at
 * 88.2/96, and no redundant interpolation once the session itself is higher.
 * The caller restores the known linear foundation after downsampling, so that
 * carrier stays time-aligned with dry instead of comb-filtering the final mix.
 */
export const organicBlock = (
  state: IOrganicState,
  target: Float32Array,
  amount: number,
  sampleRate: number,
): number => {
  const oversample = oversampleFactorForSampleRate(sampleRate);
  const wideLength = target.length * oversample;
  const maximumLength = target.length * MAX_OVERSAMPLE;
  if (state.wide.length !== maximumLength) {
    state.wide = new Float32Array(maximumLength);
    state.wideDry = new Float32Array(maximumLength);
  }

  upsample(state.oversampler, target, state.wideDry, oversample);

  const wideRate = sampleRate * oversample;
  const smooth =
    1 - Math.exp(-1 / ((PARAMETER_SMOOTHING_MS / 1_000) * wideRate));
  const targetDrive = organicDrive(amount);
  const targetAsymmetry = organicAsymmetry(amount);

  if (state.drive === 0) {
    state.drive = targetDrive;
    state.asymmetry = targetAsymmetry;
  }

  for (let i = 0; i < wideLength; i += 1) {
    state.drive += (targetDrive - state.drive) * smooth;
    state.asymmetry += (targetAsymmetry - state.asymmetry) * smooth;
    const transient = exciterTransientSample(
      state.transient,
      state.wideDry[i],
      wideRate,
    );
    const dry = state.wideDry[i];
    state.wide[i] =
      organicSample(
        dry,
        state.drive,
        state.asymmetry,
        1 + transient * ORGANIC_TRANSIENT_HARMONIC_LIFT,
      ) -
      dry * ORGANIC_FOUNDATION_GAIN;
  }

  downsample(state.oversampler, state.wide, target, oversample);
  return state.drive;
};
