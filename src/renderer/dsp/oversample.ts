/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Oversampling, at two times or four.
 *
 * Four is built as two halvings rather than as one filter with a quarter-rate
 * cutoff, which is how it is normally done and is cheaper as well as simpler:
 * each stage only ever has to reject the octave immediately above it, so the
 * same 63-tap half-band filter serves both. A single 4x filter would need a far
 * longer kernel for the same stopband.
 *
 * `WaveShaperNode` has this built in and the exciter uses it, but there is no
 * native node inside an `AudioWorkletProcessor`, so the worklet needs its own.
 * The roadmap's block 1 wants this machinery for the true-peak limiter too.
 */

/** Odd, so the filter has an exact centre tap and a whole-sample delay. */
const TAPS = 63;

/** Two halvings is the most any supported factor needs. */
const STAGES = 2;

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
  /** One history per halving, per direction. */
  up: Float64Array[];
  down: Float64Array[];
  /** The intermediate buffer a 4x pass needs, at twice the block length. */
  middle: Float32Array;
}

export const createOversampler = (blockSize = 128): IOversamplerState => ({
  up: Array.from({ length: STAGES }, () => new Float64Array(TAPS)),
  down: Array.from({ length: STAGES }, () => new Float64Array(TAPS)),
  middle: new Float32Array(blockSize * 2),
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
 * One halving, doubled: N samples in, 2N out.
 *
 * Zero-stuffing then filtering, which is what interpolation is. The x2 restores
 * the level the inserted zeros halve.
 */
const upOnce = (
  history: Float64Array,
  input: Float32Array,
  output: Float32Array,
  length: number,
): void => {
  for (let i = 0; i < length; i += 1) {
    output[i * 2] = push(history, input[i]) * 2;
    output[i * 2 + 1] = push(history, 0) * 2;
  }
};

/**
 * One halving, back down: 2N in, N out.
 *
 * Filtered before decimating, never after: dropping every other sample of an
 * unfiltered signal is exactly the aliasing this exists to prevent.
 */
const downOnce = (
  history: Float64Array,
  input: Float32Array,
  output: Float32Array,
  length: number,
): void => {
  for (let i = 0; i < length; i += 1) {
    const kept = push(history, input[i * 2]);
    push(history, input[i * 2 + 1]);
    output[i] = kept;
  }
};

const ensureMiddle = (state: IOversamplerState, length: number): void => {
  if (state.middle.length !== length) {
    state.middle = new Float32Array(length);
  }
};

/**
 * `input` at N samples becomes `output` at N x factor.
 *
 * `factor` is 2 or 4; anything else is a copy, because a caller asking for 1x
 * wants the signal untouched rather than an error.
 */
export const upsample = (
  state: IOversamplerState,
  input: Float32Array,
  output: Float32Array,
  factor: number,
): void => {
  const { length } = input;
  if (factor === 2) {
    upOnce(state.up[0], input, output, length);
    return;
  }
  ensureMiddle(state, length * 2);
  upOnce(state.up[0], input, state.middle, length);
  upOnce(state.up[1], state.middle, output, length * 2);
};

/** `input` at N x factor becomes `output` at N. */
export const downsample = (
  state: IOversamplerState,
  input: Float32Array,
  output: Float32Array,
  factor: number,
): void => {
  const { length } = output;
  if (factor === 2) {
    downOnce(state.down[0], input, output, length);
    return;
  }
  ensureMiddle(state, length * 2);
  // Unwound in the reverse order to the way up, so each stage sees the rate it
  // was designed for.
  downOnce(state.down[1], input, state.middle, length * 2);
  downOnce(state.down[0], state.middle, output, length);
};
