/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Look-ahead true-peak limiting, ported from `limiter.ts`.
 *
 * The delay is the entire point and not an implementation detail: the gain has
 * to be down BEFORE the peak is heard, and the only way to know a peak is
 * coming is to be listening ahead of what you are emitting.
 */
#ifndef FLUIDEQ_LIMITER_H
#define FLUIDEQ_LIMITER_H

#include <stdint.h>

#include "fluideq/primitives.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct FeqLimiter {
  /** The inter-sample detector's own filter history. */
  FeqTruePeak true_peak;
  /** Circular audio delay, `look_ahead + 1` long. Caller-owned. */
  float* delay;
  /** |sample| for each slot of `delay`, indexed the same way. */
  float* magnitude;
  /**
   * Absolute sample positions whose magnitudes are strictly decreasing.
   *
   * The front is the loudest sample in the current window, which is what the
   * gain must answer to. A monotonic deque keeps that O(1) amortised;
   * rescanning the window per sample would be up to 960 comparisons each at
   * the 20 ms maximum look-ahead, inside the audio thread.
   *
   * 64-bit where the reference uses an `Int32Array`. That is a deliberate
   * divergence: the reference truncates after about twelve hours of
   * continuous playback at 48 kHz, and matching a latent overflow to preserve
   * parity on a two-thousand-sample fixture would be preserving the wrong
   * thing.
   */
  int64_t* window;
  uint32_t capacity;
  int64_t head;
  int64_t tail;
  /** Absolute index of the next incoming sample. */
  int64_t position;
  /** Current gain reduction, 0-1. Held across process blocks. */
  double gain;
} FeqLimiter;

typedef struct FeqLimiterOptions {
  /** Linear amplitude, not dB. */
  double ceiling;
  /** Stay at unity below this pathological input level. */
  double activation_threshold;
  /** Per-sample gain recovery, 0-1. Closer to 1 releases more slowly. */
  double release_coefficient;
  /** Faster recovery while the signal still needs some reduction. */
  double limiting_release_coefficient;
  /** Width of the continuous transition into limiting, in dB. */
  double knee_db;
} FeqLimiterOptions;

/**
 * `delay` and `magnitude` hold `look_ahead + 1` floats, `window` the same many
 * int64s. All three are the caller's — the audio thread does not allocate.
 */
void feq_limiter_init(FeqLimiter* state,
                      float* delay,
                      float* magnitude,
                      int64_t* window,
                      uint32_t capacity,
                      uint32_t true_peak_factor);

/**
 * Continuous limiting curve: unity below the knee, exact ceiling above it.
 *
 * The quadratic is the infinite-ratio form of a conventional soft knee, value-
 * and slope-continuous at both edges, so a peak approaching the ceiling does
 * not make the gain law snap from unity to reduction. The upper branch is
 * still an exact ceiling; smoothness must never be bought with overshoot.
 */
double feq_limiter_required_gain(double peak, double ceiling, double knee_db);

/**
 * Limit `input` into `output`, delayed by the look-ahead. They may alias.
 *
 * Two things this gets wrong written the obvious way, both costing a measured
 * overshoot rather than an error:
 *
 * - The gain must answer to the loudest sample in the whole WINDOW, not the
 *   newest one. Computing it from the incoming sample alone lets release start
 *   the moment the peak is past the input, so by the time that peak reaches
 *   the output the gain has recovered. Measured on an isolated full-scale
 *   spike with 64 samples of look-ahead and a 20 ms release: 0.531 against a
 *   0.5 ceiling.
 * - Release must not run while the required gain is unchanged. With
 *   `required < gain` a steady tone alternates between reducing and releasing
 *   every other sample, because equality falls through to release. Measured:
 *   0.5004 against 0.5. `<=` is the fix, and it is the difference between
 *   holding a gain and dithering around it.
 */
void feq_limiter_process(FeqLimiter* state,
                         const float* input,
                         float* output,
                         uint32_t frames,
                         const FeqLimiterOptions* options);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_LIMITER_H */
