/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/output_safety.h"
#include "fluideq/oversample.h"

#include <cmath>
#include <limits>

namespace {

constexpr double kPi = 3.14159265358979323846;

double amplitude_db(double amplitude) {
  return amplitude > 1e-6 ? 20.0 * std::log10(amplitude) : -120.0;
}

}  // namespace

extern "C" {

uint32_t feq_output_safety_look_ahead(double sample_rate) {
  const double samples = (FEQ_SAFETY_LOOK_AHEAD_MS / 1000.0) * sample_rate;
  const auto rounded = static_cast<uint32_t>(std::llround(samples));
  return rounded < 1 ? 1u : rounded;
}

void feq_output_safety_init(FeqOutputSafety* state,
                            FeqDcBlock* dc,
                            FeqTruePeak* detectors,
                            float** delay,
                            float* gain_reduction_db,
                            uint32_t channels,
                            uint32_t limiter_capacity,
                            double sample_rate) {
  if (state == nullptr || dc == nullptr || channels == 0) {
    return;
  }
  state->dc = dc;
  state->channels = channels;
  state->dc_pole =
      std::exp((-2.0 * kPi * FEQ_SAFETY_DC_CUTOFF_HZ) / sample_rate);
  // Unity at Nyquist for H(z) = g(1 - z^-1) / (1 - p z^-1).
  state->dc_gain = (1.0 + state->dc_pole) * 0.5;
  state->dc_meter_pole =
      std::exp((-2.0 * kPi * FEQ_SAFETY_DC_METER_CUTOFF_HZ) / sample_rate);
  state->true_peak_factor =
      feq_oversample_factor_for_sample_rate(sample_rate);
  state->ceiling = std::pow(10.0, FEQ_SAFETY_CEILING_DB / 20.0);
  /**
   * An infinite release means the coefficient is exactly one: the guard never
   * recovers on its own within a meter interval, which is what "emergency"
   * means here. `exp(-1 / inf)` is 1, and it is written out rather than
   * computed so a platform's `exp` cannot round it to 0.9999999.
   */
  state->release_coefficient = 1.0;
  state->minimum_limiter_gain = 1.0;
  state->input_true_peak = 0.0;
  state->dc_offset_peak = 0.0;
  state->repaired_samples = 0;

  for (uint32_t channel = 0; channel < channels; ++channel) {
    dc[channel].input = 0.0;
    dc[channel].output = 0.0;
    dc[channel].estimate = 0.0;
  }
  feq_linked_limiter_init(&state->limiter, detectors, delay, gain_reduction_db,
                          channels, limiter_capacity,
                          state->true_peak_factor);
}

void feq_output_safety_process(FeqOutputSafety* state,
                               float* const* channels,
                               uint32_t frames,
                               const FeqOutputSafetyOptions* options) {
  if (state == nullptr || channels == nullptr || options == nullptr) {
    return;
  }

  for (uint32_t channel = 0; channel < state->channels; ++channel) {
    float* target = channels[channel];
    FeqDcBlock& dc = state->dc[channel];
    for (uint32_t at = 0; at < frames; ++at) {
      if (!std::isfinite(target[at])) {
        // The history goes too. One NaN left in an IIR's state makes every
        // later sample NaN, so repairing the sample alone repairs nothing.
        state->repaired_samples += 1;
        target[at] = 0.0f;
        dc.input = 0.0;
        dc.output = 0.0;
        dc.estimate = 0.0;
        continue;
      }
      const double input = static_cast<double>(target[at]);
      dc.estimate = input + state->dc_meter_pole * (dc.estimate - input);
      const double magnitude = std::fabs(dc.estimate);
      if (magnitude > state->dc_offset_peak) {
        state->dc_offset_peak = magnitude;
      }
      const double output =
          state->dc_gain * (input - dc.input) + state->dc_pole * dc.output;
      dc.input = input;
      dc.output = std::isfinite(output) ? output : 0.0;
      target[at] = static_cast<float>(dc.output);
    }
  }

  const bool enabled = options->limiter_enabled != 0;
  if (!enabled) {
    // Keep the detector and the two-millisecond delay current so toggling
    // Safety cannot change latency or replay stale audio. Unity gain makes a
    // bypassed guard literal while the same path carries on measuring peaks.
    feq_linked_limiter_reset_control(&state->limiter);
  }

  FeqLimiterOptions limiter{};
  limiter.ceiling =
      enabled ? options->ceiling : std::numeric_limits<double>::infinity();
  limiter.activation_threshold =
      enabled ? options->activation_threshold
              : std::numeric_limits<double>::infinity();
  limiter.release_coefficient =
      enabled ? options->release_coefficient : 0.0;
  limiter.limiting_release_coefficient = limiter.release_coefficient;
  limiter.knee_db = enabled ? options->knee_db : 0.0;
  limiter.release_hold_samples = enabled ? options->release_hold_samples : 0.0;
  limiter.attack_slew_db_per_second = 0.0;
  limiter.release_snap_ratio = 0.0;
  limiter.sample_rate = 0.0;

  feq_linked_limiter_process(&state->limiter, channels, frames, &limiter);

  if (enabled && state->limiter.gain < state->minimum_limiter_gain) {
    state->minimum_limiter_gain = state->limiter.gain;
  }
  if (state->limiter.block_peak > state->input_true_peak) {
    state->input_true_peak = state->limiter.block_peak;
  }
}

FeqOutputSafetyTelemetry feq_output_safety_take_telemetry(
    FeqOutputSafety* state) {
  FeqOutputSafetyTelemetry report{};
  if (state == nullptr) {
    return report;
  }
  report.true_peak_factor = state->true_peak_factor;
  report.gain_reduction_db = amplitude_db(state->minimum_limiter_gain);
  report.input_true_peak_db = amplitude_db(state->input_true_peak);
  // The estimated baseline before the 3 Hz blocker, not the blocker's own
  // sample-by-sample phase difference.
  report.dc_correction_db = amplitude_db(state->dc_offset_peak);
  report.repaired_samples = state->repaired_samples;

  state->minimum_limiter_gain = 1.0;
  state->input_true_peak = 0.0;
  state->dc_offset_peak = 0.0;
  state->repaired_samples = 0;
  return report;
}

}  // extern "C"
