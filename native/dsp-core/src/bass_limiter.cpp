/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/bass_limiter.h"

#include <cmath>

#include "fluideq/limiter.h"
#include "limiter_internal.h"

namespace {

using feq_limiter::slot;

constexpr double kPi = 3.14159265358979323846;

/**
 * The low band's share of a sample under which it takes none of that
 * sample's excess, and over which it takes all of it; between the two, a
 * share of the excess that rises with it.
 */
constexpr double kShareNone = 0.4;
constexpr double kShareAll = 0.6;

/** Never all the way to zero, where the gain has no decibel value to fade. */
constexpr double kLowestFloor = 1e-3;

/**
 * The one-pole's per-sample gain, in the trapezoidal form `dimension.cpp`
 * splits with: the corner lands where it is asked for at every rate, where
 * the textbook `1 - exp(-2 pi f / fs)` drifts low as the corner nears Nyquist.
 */
double split_gain(double hz, double sample_rate) {
  const double rate =
      std::isfinite(sample_rate) && sample_rate > 0.0 ? sample_rate : 48000.0;
  const double top = rate * 0.45;
  const double corner = !(hz > 10.0) ? 10.0 : (hz > top ? top : hz);
  const double g = std::tan(kPi * corner / rate);
  return g / (1.0 + g);
}

/**
 * The limiter's own law: down at once, held, then back toward the gain that
 * is still asked for rather than toward unity, which would saw between the
 * cycles of one bass note.
 */
void follow(double required,
            double* gain,
            int64_t* hold,
            int64_t hold_samples,
            double release,
            double snap_ratio) {
  if (required <= *gain) {
    *gain = required;
    *hold = hold_samples;
  } else if (*hold > 0) {
    *hold -= 1;
  } else {
    *gain += (required - *gain) * (1.0 - release);
    if (required > *gain && required - *gain <= required * snap_ratio) {
      *gain = required;
    }
  }
}

}  // namespace

extern "C" {

void feq_bass_limiter_init(FeqBassLimiter* state,
                           float** input_delay,
                           float** low_delay,
                           float* gain_db,
                           uint32_t channels,
                           uint32_t capacity) {
  if (state == nullptr || input_delay == nullptr || low_delay == nullptr ||
      gain_db == nullptr || channels == 0 ||
      channels > FEQ_BASS_LIMITER_MAX_CHANNELS || capacity == 0) {
    return;
  }
  state->input_delay = input_delay;
  state->low_delay = low_delay;
  state->gain_db = gain_db;
  state->channels = channels;
  state->capacity = capacity;
  state->look_ahead = capacity - 1;
  feq_bass_limiter_reset(state);
}

void feq_bass_limiter_set_look_ahead(FeqBassLimiter* state,
                                     uint32_t look_ahead) {
  if (state == nullptr || state->capacity == 0) {
    return;
  }
  const uint32_t largest = state->capacity - 1;
  state->look_ahead = look_ahead > largest ? largest : look_ahead;
}

void feq_bass_limiter_reset_control(FeqBassLimiter* state) {
  if (state == nullptr || state->gain_db == nullptr) {
    return;
  }
  state->detector_gain = 1.0;
  state->gain = 1.0;
  state->release_hold_remaining = 0;
  for (uint32_t at = 0; at < state->capacity; ++at) {
    state->gain_db[at] = 0.0f;
  }
}

void feq_bass_limiter_reset(FeqBassLimiter* state) {
  if (state == nullptr || state->input_delay == nullptr ||
      state->low_delay == nullptr) {
    return;
  }
  feq_bass_limiter_reset_control(state);
  state->position = 0;
  for (uint32_t channel = 0; channel < state->channels; ++channel) {
    state->split[channel] = 0.0;
    for (uint32_t at = 0; at < state->capacity; ++at) {
      state->input_delay[channel][at] = 0.0f;
      state->low_delay[channel][at] = 0.0f;
    }
  }
}

void feq_bass_limiter_process(FeqBassLimiter* state,
                              float* const* channels,
                              uint32_t frames,
                              const FeqBassLimiterOptions* options) {
  if (state == nullptr || channels == nullptr || options == nullptr ||
      frames == 0 || state->capacity == 0 || state->input_delay == nullptr ||
      state->low_delay == nullptr || state->gain_db == nullptr) {
    return;
  }
  const uint32_t capacity = state->capacity;
  const int64_t look_ahead = static_cast<int64_t>(
      state->look_ahead < capacity ? state->look_ahead : capacity - 1);
  const double split = split_gain(options->split_hz, options->sample_rate);
  const bool limiting = options->ceiling > 0.0 && std::isfinite(options->ceiling);
  const double knee_db = options->knee_db > 0.0 ? options->knee_db : 0.0;
  // The peak the platform answers for: what rises above it is the low band's
  // to take, what stays under it the limiter's steady reduction already holds
  // without moving. Once a block — the platform follows over half a second.
  const double target =
      limiting ? feq_limiter_peak_for_reduction(
                     options->platform_db < 0.0 ? options->platform_db : 0.0,
                     options->ceiling, knee_db)
               : HUGE_VAL;
  const double floor_gain =
      options->floor_gain > kLowestFloor
          ? (options->floor_gain < 1.0 ? options->floor_gain : 1.0)
          : kLowestFloor;
  const double release =
      options->release_coefficient > 0.0 && options->release_coefficient < 1.0
          ? options->release_coefficient
          : 0.0;
  const int64_t hold_samples =
      options->release_hold_samples > 0.0
          ? static_cast<int64_t>(options->release_hold_samples)
          : 0;
  const double snap_ratio =
      options->release_snap_ratio > 0.0 ? options->release_snap_ratio : 0.0;

  for (uint32_t at = 0; at < frames; ++at) {
    const int64_t position = state->position;
    const int64_t write_at = slot(position, capacity);
    const int64_t read_at =
        look_ahead == 0 ? write_at : slot(position - look_ahead, capacity);

    double required = 1.0;
    for (uint32_t channel = 0; channel < state->channels; ++channel) {
      const double input = static_cast<double>(channels[channel][at]);
      double& integrator = state->split[channel];
      const double step = (input - integrator) * split;
      const double low = step + integrator;
      integrator = low + step;
      state->input_delay[channel][write_at] = static_cast<float>(input);
      state->low_delay[channel][write_at] = static_cast<float>(low);

      const double magnitude = std::fabs(input);
      if (magnitude > target && low * input > 0.0) {
        const double share = std::fabs(low) / magnitude;
        const double taken =
            share >= kShareAll
                ? 1.0
                : (share > kShareNone
                       ? (share - kShareNone) / (kShareAll - kShareNone)
                       : 0.0);
        const double asked =
            1.0 - taken * (magnitude - target) / std::fabs(low);
        if (asked < required) {
          required = asked;
        }
      }
    }
    if (required < floor_gain) {
      required = floor_gain;
    }

    follow(required, &state->detector_gain, &state->release_hold_remaining,
           hold_samples, release, snap_ratio);
    const double reduction_db = state->detector_gain < 1.0
                                    ? 20.0 * std::log10(state->detector_gain)
                                    : 0.0;
    state->gain_db[write_at] = static_cast<float>(reduction_db);
    feq_limiter::back_fill(state->gain_db, capacity, position, look_ahead,
                           reduction_db);

    const float stored = state->gain_db[read_at];
    const double gain =
        stored < 0.0f ? std::pow(10.0, static_cast<double>(stored) / 20.0)
                      : 1.0;
    state->gain = gain;
    for (uint32_t channel = 0; channel < state->channels; ++channel) {
      const double input =
          static_cast<double>(state->input_delay[channel][read_at]);
      const double low = static_cast<double>(state->low_delay[channel][read_at]);
      channels[channel][at] = static_cast<float>(input + (gain - 1.0) * low);
    }
    state->position = position + 1;
  }
}

}  // extern "C"
