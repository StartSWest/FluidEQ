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
  IExciterTransientState,
  createExciterTransientState,
  exciterTransientSample,
  resetExciterTransientState,
} from './analogDiode';
import {
  IHarmonicState,
  createHarmonicState,
  harmonicSample,
  resetHarmonicState,
} from './harmonics';

/**
 * Material voicing for a clean, metallic presentation.
 *
 * Its even-dominant body makes a titanium-style driver feel warmer and more
 * cellulose-like without removing the original detail. It is not a second
 * High exciter, a broadband saturator, or a random LFO.
 */
const MAX_OVERSAMPLE = 4;
const PARAMETER_SMOOTHING_MS = 18;
/**
 * The same quiet carrier the three bands use, and for the same reason.
 *
 * It was 0.52 — a return that was half a copy of its own focused band, against
 * the bands' 0.18. That made Organic the loudest thing in several profiles and
 * its Amount dial a level control: measured alone at its focus, the MINIMUM
 * amount already added +1.23 dB and the whole dial only reached +3.18, so
 * turning it down could not take the lift away. It reads +0.46 to +2.27 now,
 * and what the dial moves is harmonic density.
 */
export const ORGANIC_FOUNDATION_GAIN = 0.18;
const ORGANIC_TRANSIENT_HARMONIC_LIFT = 0.35;

export interface IOrganicState {
  oversampler: IOversamplerState;
  wide: Float32Array;
  wideDry: Float32Array;
  depth: number;
  evenWeight: number;
  transient: IExciterTransientState;
  harmonics: IHarmonicState;
}

export const createOrganicState = (blockSize: number): IOrganicState => ({
  oversampler: createOversampler(blockSize),
  wide: new Float32Array(blockSize * MAX_OVERSAMPLE),
  wideDry: new Float32Array(blockSize * MAX_OVERSAMPLE),
  depth: 0,
  evenWeight: 0,
  transient: createExciterTransientState(),
  harmonics: createHarmonicState(),
});

/**
 * How much harmonic content the dial asks for, as a ratio of the focused band.
 *
 * The same figure the three bands call Depth, and it means the same thing here:
 * what survives to the output as harmonic amplitude, at any playback level. The
 * curve is chosen so the default 0.35 measures where the old soft-diode curve
 * measured on a -6 dBFS tone — the character is kept, the level-following is
 * not.
 */
export const organicDepth = (amount: number): number => 0.15 + amount * 0.85;

/**
 * Organic stays even-dominant; the upper travel only adds a little density.
 *
 * Neither end crosses over to odd. That is the whole identity of the stage —
 * body rather than edge — and it is the one thing about it that must not move.
 */
export const organicEvenWeight = (amount: number): number =>
  0.9 - amount * 0.12;

export const resetOrganicTransient = (state: IOrganicState): void => {
  resetExciterTransientState(state.transient);
  // The level follower too, or the stage comes back holding the level of
  // whatever was playing when it was switched off.
  resetHarmonicState(state.harmonics);
};

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
  const targetDepth = organicDepth(amount);
  const targetEvenWeight = organicEvenWeight(amount);

  if (state.depth === 0) {
    state.depth = targetDepth;
    state.evenWeight = targetEvenWeight;
  }

  for (let i = 0; i < wideLength; i += 1) {
    state.depth += (targetDepth - state.depth) * smooth;
    state.evenWeight += (targetEvenWeight - state.evenWeight) * smooth;
    const dry = state.wideDry[i];
    const transient = exciterTransientSample(state.transient, dry, wideRate);
    // Harmonics only, as the doc comment above says: the caller restores the
    // foundation after downsampling so the carrier stays aligned with dry.
    state.wide[i] = harmonicSample(
      state.harmonics,
      dry,
      state.depth * (1 + transient * ORGANIC_TRANSIENT_HARMONIC_LIFT),
      state.evenWeight,
      wideRate,
    );
  }

  downsample(state.oversampler, state.wide, target, oversample);
  return state.depth;
};
