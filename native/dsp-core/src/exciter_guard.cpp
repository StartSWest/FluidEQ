/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/exciter_guard.h"

#include <cmath>

namespace {

constexpr double kSibilanceCentreHz = 7200.0;
constexpr double kSibilanceReturnCutDb = -5.5;
constexpr double kSibilanceQuality = 1.25;
constexpr double kParameterSmoothingMs = 18.0;
constexpr double kMaxReturnGain = 1.0;
constexpr double kReturnTaper = 0.6;
constexpr double kOrganicMaxReturnGain = 0.95;
constexpr double kOrganicReturnTaper = 0.42;

double clamp01(double value) {
  if (value < 0.0) {
    return 0.0;
  }
  return value > 1.0 ? 1.0 : value;
}

}  // namespace

extern "C" {

void feq_exciter_guard_init(FeqExciterGuard* state, float* filtered) {
  if (state == nullptr) {
    return;
  }
  feq_biquad_reset(&state->filter);
  // Identity until a rate is known: b0 of one and nothing else, so a block
  // arriving before the first configure passes through rather than silencing.
  state->coefficients.b0 = 1.0;
  state->coefficients.b1 = 0.0;
  state->coefficients.b2 = 0.0;
  state->coefficients.a1 = 0.0;
  state->coefficients.a2 = 0.0;
  state->sample_rate = 0.0;
  state->amount = 0.0;
  state->filtered = filtered;
}

double feq_exciter_return_gain(double amount) {
  return kMaxReturnGain * std::pow(clamp01(amount), kReturnTaper);
}

double feq_organic_exciter_return_gain(double amount) {
  return kOrganicMaxReturnGain * std::pow(clamp01(amount), kOrganicReturnTaper);
}

double feq_organic_sibilance_protection(double focus_hz) {
  if (focus_hz <= 4500.0 || focus_hz >= 11000.0) {
    return 0.0;
  }
  if (focus_hz < 5500.0) {
    return (focus_hz - 4500.0) / 1000.0;
  }
  if (focus_hz > 9000.0) {
    return (11000.0 - focus_hz) / 2000.0;
  }
  return 1.0;
}

void feq_exciter_guard_process(FeqExciterGuard* state,
                               float* target,
                               uint32_t frames,
                               double sample_rate,
                               double amount) {
  if (state == nullptr || target == nullptr || state->filtered == nullptr) {
    return;
  }
  if (state->sample_rate != sample_rate) {
    state->sample_rate = sample_rate;
    state->coefficients = feq_biquad_coefficients(
        FEQ_FILTER_PK, kSibilanceCentreHz, kSibilanceReturnCutDb,
        kSibilanceQuality, sample_rate);
  }

  for (uint32_t at = 0; at < frames; ++at) {
    state->filtered[at] = target[at];
  }
  feq_biquad_process(&state->filter, state->filtered, frames,
                     &state->coefficients);

  const double target_amount = clamp01(amount);
  const double smooth =
      1.0 - std::exp(-1.0 / ((kParameterSmoothingMs / 1000.0) * sample_rate));
  for (uint32_t at = 0; at < frames; ++at) {
    state->amount += (target_amount - state->amount) * smooth;
    const double difference = static_cast<double>(state->filtered[at]) -
                              static_cast<double>(target[at]);
    target[at] = static_cast<float>(static_cast<double>(target[at]) +
                                    difference * state->amount);
  }
}

}  // extern "C"
