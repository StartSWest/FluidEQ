/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IOversamplerState,
  createOversampler,
  downsample2x,
  upsample2x,
} from './oversample';

/**
 * The harmonic colour an analogue equaliser adds and a digital one does not.
 *
 * This is the difference people mean when they say two equalisers with the same
 * curve sound different. A transformer and an op-amp are not linear: they add
 * harmonics that were not in the signal, quietly and everywhere, and that is
 * the character. Filters alone cannot produce it — no arrangement of biquads
 * invents a frequency that was not already there.
 *
 * Asymmetric on purpose. A symmetric curve produces only ODD harmonics, which
 * read as edge or grit; the offset here produces EVEN ones too, which read as
 * warmth and are most of what "analogue" means to a listener. Subtracting the
 * curve's value at the offset keeps DC out, because a non-linearity fed silence
 * must return silence rather than a constant.
 */
const OFFSET = 0.18;
const OFFSET_OUTPUT = Math.tanh(OFFSET);

export const saturateSample = (sample: number, drive: number): number =>
  (Math.tanh(sample * drive + OFFSET) - OFFSET_OUTPUT) / drive;

export interface ISaturatorState {
  oversampler: IOversamplerState;
  /** Doubled-rate scratch, sized on first use and reused after. */
  doubled: Float32Array;
}

export const createSaturator = (blockSize: number): ISaturatorState => ({
  oversampler: createOversampler(),
  doubled: new Float32Array(blockSize * 2),
});

/**
 * Saturate a block in place, at twice the rate.
 *
 * The oversampling is not optional and not a refinement. A non-linearity run at
 * the session rate folds every harmonic above Nyquist back down as inharmonic
 * content that does not move with the music — which is the sound this feature
 * is supposed to be an alternative to, not an example of.
 */
export const saturateBlock = (
  state: ISaturatorState,
  target: Float32Array,
  drive: number,
): void => {
  const doubled = target.length * 2;
  if (state.doubled.length !== doubled) {
    state.doubled = new Float32Array(doubled);
  }
  upsample2x(state.oversampler, target, state.doubled);
  for (let i = 0; i < doubled; i += 1) {
    state.doubled[i] = saturateSample(state.doubled[i], drive);
  }
  downsample2x(state.oversampler, state.doubled, target);
};
