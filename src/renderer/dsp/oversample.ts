/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * 2x oversampling, for putting a non-linearity somewhere it cannot alias.
 *
 * A non-linearity manufactures harmonics above its input, and everything past
 * Nyquist folds back down as inharmonic content — tones that were never in the
 * music and do not move with it. That folding is what "fuzzy" actually sounds
 * like, and it is why every commercial saturator oversamples.
 *
 * `WaveShaperNode` has this built in and the exciter uses it, but there is no
 * native node inside an `AudioWorkletProcessor`, so the worklet needs its own.
 * The roadmap's block 1 wants this anyway for the true-peak limiter's detector;
 * this is that machinery, at the modest end.
 *
 * Two times rather than four: it puts the fold-back point at 48 kHz for a
 * 48 kHz session, which is far enough above the audible band that what folds is
 * both tiny and inaudible, and it costs half of what 4x would. The filter is
 * the expensive part, not the rate.
 */

/** Odd, so the filter has an exact centre tap and a whole-sample delay. */
const TAPS = 63;

/**
 * A windowed-sinc low pass at a quarter of the doubled rate.
 *
 * Blackman rather than a rectangular window: the stopband of an unwindowed
 * sinc is about -21 dB whatever its length, which would let a quarter of the
 * folded content straight back through and defeat the point of oversampling.
 */
const designHalfBand = (): Float64Array => {
  const taps = new Float64Array(TAPS);
  const middle = (TAPS - 1) / 2;
  let sum = 0;
  for (let i = 0; i < TAPS; i += 1) {
    const n = i - middle;
    // sinc at cutoff 0.25 of the oversampled rate, which is Nyquist of the
    // original one.
    const ideal = n === 0 ? 0.5 : Math.sin(Math.PI * 0.5 * n) / (Math.PI * n);
    const window =
      0.42 -
      0.5 * Math.cos((2 * Math.PI * i) / (TAPS - 1)) +
      0.08 * Math.cos((4 * Math.PI * i) / (TAPS - 1));
    taps[i] = ideal * window;
    sum += taps[i];
  }
  // Normalised to unity at DC, so oversampling never changes the level.
  for (let i = 0; i < TAPS; i += 1) {
    taps[i] /= sum;
  }
  return taps;
};

const HALF_BAND = designHalfBand();

export interface IOversamplerState {
  /** History for the interpolating filter, in the doubled domain. */
  up: Float64Array;
  /** History for the decimating filter, also doubled. */
  down: Float64Array;
}

export const createOversampler = (): IOversamplerState => ({
  up: new Float64Array(TAPS),
  down: new Float64Array(TAPS),
});

/** One sample through a filter whose history is kept as a shift register. */
const push = (history: Float64Array, sample: number): number => {
  for (let i = TAPS - 1; i > 0; i -= 1) {
    history[i] = history[i - 1];
  }
  history[0] = sample;
  let sum = 0;
  for (let i = 0; i < TAPS; i += 1) {
    sum += history[i] * HALF_BAND[i];
  }
  return sum;
};

/**
 * `input` at N samples becomes `output` at 2N.
 *
 * Zero-stuffing then filtering, which is what interpolation is. The x2 restores
 * the level the inserted zeros halve.
 */
export const upsample2x = (
  state: IOversamplerState,
  input: Float32Array,
  output: Float32Array,
): void => {
  for (let i = 0; i < input.length; i += 1) {
    output[i * 2] = push(state.up, input[i]) * 2;
    output[i * 2 + 1] = push(state.up, 0) * 2;
  }
};

/**
 * `input` at 2N samples becomes `output` at N.
 *
 * Filtered before decimating, never after: dropping every other sample of an
 * unfiltered signal is exactly the aliasing this exists to prevent.
 */
export const downsample2x = (
  state: IOversamplerState,
  input: Float32Array,
  output: Float32Array,
): void => {
  for (let i = 0; i < output.length; i += 1) {
    const kept = push(state.down, input[i * 2]);
    push(state.down, input[i * 2 + 1]);
    output[i] = kept;
  }
};
