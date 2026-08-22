/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export interface ILimiterState {
  /** Circular audio delay line, `lookAhead + 1` long. See `processLimiter`. */
  delay: Float32Array;
  /** |sample| for each slot of `delay`, indexed the same way. */
  magnitude: Float32Array;
  /**
   * Absolute sample positions whose magnitudes are strictly decreasing.
   *
   * The front is the loudest sample in the current window, which is what the
   * gain must answer to. A monotonic deque keeps that answer O(1) amortised;
   * rescanning the window per sample would be up to 960 comparisons each at
   * the 20ms maximum look-ahead, inside the audio thread.
   */
  window: Int32Array;
  head: number;
  tail: number;
  /** Absolute index of the next incoming sample. */
  position: number;
  /** Current gain reduction, 0-1. Held across process blocks. */
  gain: number;
}

export interface ILimiterOptions {
  /** Linear amplitude, not dB. */
  ceiling: number;
  /** Per-sample gain recovery, 0-1. Closer to 1 releases more slowly. */
  releaseCoefficient: number;
}

export const createLimiterState = (lookAheadSamples: number): ILimiterState => {
  const capacity = Math.max(1, Math.floor(lookAheadSamples)) + 1;
  return {
    delay: new Float32Array(capacity),
    magnitude: new Float32Array(capacity),
    window: new Int32Array(capacity),
    head: 0,
    tail: 0,
    position: 0,
    gain: 1,
  };
};

/**
 * Limit `input` into `output`, delayed by the look-ahead.
 *
 * The delay is the entire point and it is not an implementation detail: the
 * gain has to be down BEFORE the peak is heard, and the only way to know a
 * peak is coming is to be listening ahead of what you are emitting.
 *
 * Two things this gets wrong if written the obvious way, both of which cost a
 * measured overshoot rather than an error:
 *
 *  - **The gain must answer to the loudest sample in the whole window, not to
 *    the newest one.** Computing it from the incoming sample alone lets the
 *    release start the moment the peak is past the input, so by the time that
 *    peak reaches the OUTPUT the gain has already recovered. Measured on an
 *    isolated full-scale spike with a 64-sample look-ahead and a 20ms release:
 *    0.531 against a 0.5 ceiling, a 6.2% overshoot from exactly that recovery.
 *  - **Release must not run while the required gain is unchanged.** With
 *    `required < gain` a steady tone alternates between reducing and
 *    releasing every other sample, because equality falls through to release.
 *    Measured: 0.5004 against a 0.5 ceiling. `<=` is the fix and it is not a
 *    rounding tweak — it is the difference between holding a gain and
 *    dithering around it.
 *
 * The window spans `lookAhead + 1` samples so that the sample being emitted is
 * still inside it. A window of exactly `lookAhead` would exclude the very
 * sample whose level it is meant to be controlling.
 *
 * `input` and `output` may be the same array.
 */
export const processLimiter = (
  state: ILimiterState,
  input: Float32Array,
  output: Float32Array,
  { ceiling, releaseCoefficient }: ILimiterOptions,
): void => {
  const { delay, magnitude, window } = state;
  const capacity = delay.length;
  const lookAhead = capacity - 1;

  for (let i = 0; i < input.length; i += 1) {
    const { position } = state;
    const incoming = input[i];
    const incomingMagnitude = Math.abs(incoming);

    // The sample that has just fallen out of the window, if it was the peak.
    if (
      state.head < state.tail &&
      window[state.head % capacity] === position - capacity
    ) {
      state.head += 1;
    }

    // Anything quieter than the incoming sample can never be the window's
    // maximum again, because it also leaves the window earlier.
    while (
      state.tail > state.head &&
      magnitude[window[(state.tail - 1) % capacity] % capacity] <=
        incomingMagnitude
    ) {
      state.tail -= 1;
    }
    window[state.tail % capacity] = position;
    state.tail += 1;

    // Read the outgoing sample before its slot is reused. It sits one step
    // ahead of the write cursor, which is `position - lookAhead`.
    const emitted =
      lookAhead === 0 ? incoming : delay[(position + 1) % capacity];
    delay[position % capacity] = incoming;
    magnitude[position % capacity] = incomingMagnitude;
    state.position = position + 1;

    const peak = magnitude[window[state.head % capacity] % capacity];
    const required = peak > ceiling ? ceiling / peak : 1;
    state.gain =
      required <= state.gain
        ? required
        : state.gain + (1 - state.gain) * (1 - releaseCoefficient);

    output[i] = emitted * state.gain;
  }
};
