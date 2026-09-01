/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Oversampling, at one, two, or four times.
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

export type TOversampleFactor = 1 | 2 | 4;

/**
 * Highest power-of-two factor that keeps nonlinear processing at or below
 * 192 kHz. The session rate itself is never changed or truncated: a 192 kHz
 * context already has the resolution that 48 kHz reaches at 4x, so it needs
 * no additional interpolation.
 *
 * Calculating from the actual rate also handles uncommon device rates without
 * a table whose gaps silently fall back to the wrong factor.
 */
export const oversampleFactorForSampleRate = (
  sampleRate: number,
): TOversampleFactor => {
  const rate =
    Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 48_000;
  if (rate * 4 <= 192_000) {
    return 4;
  }
  return rate * 2 <= 192_000 ? 2 : 1;
};

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
  /** Next write slot in each circular FIR history. */
  upPosition: number[];
  downPosition: number[];
  /** The intermediate buffer a 4x pass needs, at twice the block length. */
  middle: Float32Array;
}

/** One sample through the same FIR without shifting 63 values per sample. */
const push = (
  history: Float64Array,
  positions: number[],
  stage: number,
  sample: number,
): number => {
  const newest = positions[stage];
  history[newest] = sample;
  let sum = 0;
  let tap = 0;
  for (let read = newest; read >= 0; read -= 1) {
    sum += history[read] * HALF_BAND[tap];
    tap += 1;
  }
  for (let read = TAPS - 1; tap < TAPS; read -= 1) {
    sum += history[read] * HALF_BAND[tap];
    tap += 1;
  }
  positions[stage] = newest + 1 === TAPS ? 0 : newest + 1;
  return sum;
};

/**
 * One halving, back down: 2N in, N out.
 *
 * Filtered before decimating, never after: dropping every other sample of an
 * unfiltered signal is exactly the aliasing this exists to prevent.
 */
const downOnce = (
  history: Float64Array,
  positions: number[],
  stage: number,
  input: Float32Array,
  output: Float32Array,
  length: number,
): void => {
  for (let i = 0; i < length; i += 1) {
    const kept = push(history, positions, stage, input[i * 2]);
    push(history, positions, stage, input[i * 2 + 1]);
    output[i] = kept;
  }
};

const ensureMiddle = (state: IOversamplerState, length: number): void => {
  if (state.middle.length !== length) {
    state.middle = new Float32Array(length);
  }
};

/** `input` at N x factor becomes `output` at N. */
export const downsample = (
  state: IOversamplerState,
  input: Float32Array,
  output: Float32Array,
  factor: number,
): void => {
  const { length } = output;
  if (factor !== 2 && factor !== 4) {
    output.set(input.subarray(0, length));
    return;
  }
  if (factor === 2) {
    downOnce(state.down[0], state.downPosition, 0, input, output, length);
    return;
  }
  ensureMiddle(state, length * 2);
  // Unwound in the reverse order to the way up, so each stage sees the rate it
  // was designed for.
  downOnce(
    state.down[1],
    state.downPosition,
    1,
    input,
    state.middle,
    length * 2,
  );
  downOnce(state.down[0], state.downPosition, 0, state.middle, output, length);
};
