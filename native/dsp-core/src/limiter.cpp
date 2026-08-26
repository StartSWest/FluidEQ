/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/limiter.h"

#include <cmath>

namespace {

/** Positive modulo over a capacity, for the ring indices. */
inline int64_t slot(int64_t value, uint32_t capacity) {
  const int64_t span = static_cast<int64_t>(capacity);
  const int64_t rest = value % span;
  return rest < 0 ? rest + span : rest;
}

}  // namespace

extern "C" {

void feq_limiter_init(FeqLimiter* state,
                      float* delay,
                      float* magnitude,
                      int64_t* window,
                      uint32_t capacity,
                      uint32_t true_peak_factor) {
  if (state == nullptr || delay == nullptr || magnitude == nullptr ||
      window == nullptr || capacity == 0) {
    return;
  }
  feq_true_peak_init(&state->true_peak, true_peak_factor);
  state->delay = delay;
  state->magnitude = magnitude;
  state->window = window;
  state->capacity = capacity;
  state->head = 0;
  state->tail = 0;
  state->position = 0;
  state->gain = 1.0;
  for (uint32_t at = 0; at < capacity; ++at) {
    delay[at] = 0.0f;
    magnitude[at] = 0.0f;
    window[at] = 0;
  }
}

double feq_limiter_required_gain(double peak, double ceiling, double knee_db) {
  if (!(peak > 0.0) || !(ceiling > 0.0) || !std::isfinite(ceiling)) {
    return 1.0;
  }
  const double knee = knee_db > 0.0 ? knee_db : 0.0;
  if (knee == 0.0) {
    return peak > ceiling ? ceiling / peak : 1.0;
  }
  const double half_knee = knee * 0.5;
  const double lower = ceiling * std::pow(10.0, -half_knee / 20.0);
  if (peak <= lower) {
    return 1.0;
  }
  const double upper = ceiling * std::pow(10.0, half_knee / 20.0);
  if (peak >= upper) {
    return ceiling / peak;
  }
  const double relative_db = 20.0 * std::log10(peak / ceiling);
  const double knee_position = relative_db + half_knee;
  const double reduction_db = -(knee_position * knee_position) / (2.0 * knee);
  return std::pow(10.0, reduction_db / 20.0);
}

void feq_limiter_process(FeqLimiter* state,
                         const float* input,
                         float* output,
                         uint32_t frames,
                         const FeqLimiterOptions* options) {
  if (state == nullptr || input == nullptr || output == nullptr ||
      options == nullptr || state->capacity == 0) {
    return;
  }
  const uint32_t capacity = state->capacity;
  const int64_t look_ahead = static_cast<int64_t>(capacity) - 1;

  for (uint32_t at = 0; at < frames; ++at) {
    const int64_t position = state->position;
    const double incoming = static_cast<double>(input[at]);
    /**
     * The inter-sample magnitude, not |incoming|.
     *
     * A signal can sit below the ceiling in every sample it has and still
     * reconstruct above it in the gaps between them — and the gaps are what a
     * converter, a resampler and every streaming service's meter see. A
     * limiter answering only to the samples it was handed lets that through
     * and reports a ceiling it is not holding.
     */
    const double incoming_magnitude =
        feq_true_peak_sample(&state->true_peak, incoming);

    // The sample that has just fallen out of the window, if it was the peak.
    if (state->head < state->tail &&
        state->window[slot(state->head, capacity)] ==
            position - static_cast<int64_t>(capacity)) {
      state->head += 1;
    }

    // Anything quieter than the incoming sample can never be the window's
    // maximum again, because it also leaves the window earlier.
    while (state->tail > state->head &&
           static_cast<double>(
               state->magnitude[slot(
                   state->window[slot(state->tail - 1, capacity)],
                   capacity)]) <= incoming_magnitude) {
      state->tail -= 1;
    }
    state->window[slot(state->tail, capacity)] = position;
    state->tail += 1;

    // Read the outgoing sample before its slot is reused. It sits one step
    // ahead of the write cursor, which is `position - look_ahead`.
    const double emitted =
        look_ahead == 0
            ? incoming
            : static_cast<double>(state->delay[slot(position + 1, capacity)]);
    state->delay[slot(position, capacity)] = static_cast<float>(incoming);
    state->magnitude[slot(position, capacity)] =
        static_cast<float>(incoming_magnitude);
    state->position = position + 1;

    const double peak = static_cast<double>(
        state->magnitude[slot(state->window[slot(state->head, capacity)],
                              capacity)]);
    const double required =
        peak >= options->activation_threshold
            ? feq_limiter_required_gain(peak, options->ceiling,
                                        options->knee_db)
            : 1.0;
    // `<=` and not `<`: with strict less-than a steady tone alternates between
    // reducing and releasing every other sample, because equality falls
    // through to the release branch.
    state->gain =
        required <= state->gain
            ? required
            : state->gain +
                  (required - state->gain) *
                      (1.0 - (required < 1.0
                                  ? options->limiting_release_coefficient
                                  : options->release_coefficient));

    output[at] = static_cast<float>(emitted * state->gain);
  }
}

}  // extern "C"
