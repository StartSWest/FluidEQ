/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/limiter.h"

#include <cmath>
#include <limits>

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

void feq_linked_limiter_init(FeqLinkedLimiter* state,
                             FeqTruePeak* detectors,
                             float** delay,
                             float* gain_reduction_db,
                             uint32_t channels,
                             uint32_t capacity,
                             uint32_t true_peak_factor) {
  if (state == nullptr || detectors == nullptr || delay == nullptr ||
      gain_reduction_db == nullptr || channels == 0 || capacity == 0) {
    return;
  }
  state->true_peak = detectors;
  state->delay = delay;
  state->gain_reduction_db = gain_reduction_db;
  state->channels = channels;
  state->capacity = capacity;
  state->position = 0;
  state->detector_gain = 1.0;
  state->gain = 1.0;
  state->release_hold_remaining = 0;
  state->block_peak = 0.0;
  for (uint32_t channel = 0; channel < channels; ++channel) {
    feq_true_peak_init(&detectors[channel], true_peak_factor);
    for (uint32_t at = 0; at < capacity; ++at) {
      delay[channel][at] = 0.0f;
    }
  }
  for (uint32_t at = 0; at < capacity; ++at) {
    gain_reduction_db[at] = 0.0f;
  }
}

void feq_linked_limiter_reset_control(FeqLinkedLimiter* state) {
  if (state == nullptr) {
    return;
  }
  state->detector_gain = 1.0;
  state->gain = 1.0;
  state->release_hold_remaining = 0;
  for (uint32_t at = 0; at < state->capacity; ++at) {
    state->gain_reduction_db[at] = 0.0f;
  }
}

void feq_linked_limiter_process(FeqLinkedLimiter* state,
                                float* const* channels,
                                uint32_t frames,
                                const FeqLimiterOptions* options) {
  if (state == nullptr || channels == nullptr || options == nullptr ||
      frames == 0 || state->capacity == 0) {
    return;
  }
  const uint32_t capacity = state->capacity;
  const int64_t look_ahead = static_cast<int64_t>(capacity) - 1;
  const int64_t detector_latency =
      state->true_peak[0].factor == 1 ? 0 : FEQ_TRUE_PEAK_LATENCY;
  const int64_t attack_samples =
      look_ahead - detector_latency > 0 ? look_ahead - detector_latency : 0;
  state->block_peak = 0.0;

  const bool uses_slow_attack = options->attack_slew_db_per_second > 0.0;
  const double processing_rate =
      options->sample_rate > 0.0 ? options->sample_rate : 48000.0;
  const double attack_step_db =
      uses_slow_attack ? options->attack_slew_db_per_second / processing_rate
                       : std::numeric_limits<double>::infinity();
  const int64_t hold_samples =
      options->release_hold_samples > 0.0
          ? static_cast<int64_t>(options->release_hold_samples)
          : 0;
  const double snap_ratio =
      options->release_snap_ratio > 0.0 ? options->release_snap_ratio : 0.0;

  for (uint32_t at = 0; at < frames; ++at) {
    const int64_t position = state->position;
    double incoming_magnitude = 0.0;
    for (uint32_t channel = 0; channel < state->channels; ++channel) {
      const double detected = feq_true_peak_sample(
          &state->true_peak[channel],
          static_cast<double>(channels[channel][at]));
      if (detected > incoming_magnitude) {
        incoming_magnitude = detected;
      }
    }
    if (incoming_magnitude > state->block_peak) {
      state->block_peak = incoming_magnitude;
    }

    const double required =
        incoming_magnitude >= options->activation_threshold
            ? feq_limiter_required_gain(incoming_magnitude, options->ceiling,
                                        options->knee_db)
            : 1.0;

    const int64_t write_at = slot(position, capacity);
    const int64_t read_at =
        look_ahead == 0 ? write_at : slot(position + 1, capacity);

    if (uses_slow_attack) {
      // Detection is immediate, a large gain move is not. A fixed dB/s slew
      // means a 1 dB correction completes sooner than a 5 dB one, instead of
      // every peak causing the same abrupt dip. The target is held through the
      // look-ahead so it is still in force when the peak that chose it lands.
      if (required < state->detector_gain) {
        state->detector_gain = required;
        state->release_hold_remaining = look_ahead + hold_samples;
      } else if (state->release_hold_remaining > 0) {
        state->release_hold_remaining -= 1;
      } else {
        state->detector_gain = required;
      }

      const double current_db =
          state->gain > 0.0 ? 20.0 * std::log10(state->gain) : -120.0;
      const double target_db =
          state->detector_gain > 0.0
              ? 20.0 * std::log10(state->detector_gain)
              : -120.0;
      if (target_db < current_db) {
        const double floor_db = current_db - attack_step_db;
        state->gain =
            std::pow(10.0, (target_db > floor_db ? target_db : floor_db) / 20.0);
      } else {
        const double recovery = state->detector_gain < 1.0
                                    ? options->limiting_release_coefficient
                                    : options->release_coefficient;
        state->gain += (state->detector_gain - state->gain) * (1.0 - recovery);
        if (state->detector_gain > state->gain &&
            state->detector_gain - state->gain <=
                state->detector_gain * snap_ratio) {
          state->gain = state->detector_gain;
        }
      }
    } else {
      if (required <= state->detector_gain) {
        state->detector_gain = required;
        state->release_hold_remaining = hold_samples;
      } else if (state->release_hold_remaining > 0) {
        state->release_hold_remaining -= 1;
      } else {
        // Follow the gain the CURRENT peak needs, not unity. A controller at
        // -10 dB rises toward -5 while +5 dB peaks remain, and continues to
        // unity only once nothing asks for reduction. Releasing blindly
        // toward one makes a sawtooth: overshoot, snap down on the next peak,
        // repeat.
        const double recovery = required < 1.0
                                    ? options->limiting_release_coefficient
                                    : options->release_coefficient;
        state->detector_gain +=
            (required - state->detector_gain) * (1.0 - recovery);
        if (required > state->detector_gain &&
            required - state->detector_gain <= required * snap_ratio) {
          state->detector_gain = required;
        }
      }

      const double reduction_db =
          state->detector_gain > 0.0
              ? 20.0 * std::log10(state->detector_gain)
              : -120.0;
      const int64_t control_position = position - detector_latency;
      state->gain_reduction_db[slot(control_position, capacity)] =
          static_cast<float>(reduction_db);

      // Back-fill a linear-in-dB fade that reaches the exact reduction at the
      // peak. A deeper existing ramp wins, so overlapping peaks stay covered.
      if (attack_samples > 0 && reduction_db < 0.0) {
        const double step_db = -reduction_db / static_cast<double>(attack_samples);
        double ramp_db = reduction_db + step_db;
        for (int64_t back = 1; back <= attack_samples; ++back) {
          const int64_t index = slot(control_position - back, capacity);
          if (static_cast<double>(state->gain_reduction_db[index]) <= ramp_db) {
            break;
          }
          state->gain_reduction_db[index] = static_cast<float>(ramp_db);
          ramp_db += step_db;
        }
      }

      state->gain = std::pow(
          10.0, static_cast<double>(state->gain_reduction_db[read_at]) / 20.0);
    }

    for (uint32_t channel = 0; channel < state->channels; ++channel) {
      float* line = state->delay[channel];
      const double emitted = look_ahead == 0
                                 ? static_cast<double>(channels[channel][at])
                                 : static_cast<double>(line[read_at]);
      line[write_at] = channels[channel][at];
      channels[channel][at] = static_cast<float>(emitted * state->gain);
    }
    state->position = position + 1;
  }
}

}  // extern "C"
