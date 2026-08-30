/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/analog_diode.h"

#include <cmath>

namespace {

/**
 * Two followers at four speeds, plus a third pair smoothing the answer.
 *
 * A fast envelope minus a slow one is large at an attack and near zero on
 * sustained material, which is the discrimination. The control pair then
 * smooths that ratio so the amount moves like a control voltage rather than
 * flickering sample to sample.
 */
constexpr double kFastAttackMs = 1.5;
constexpr double kFastReleaseMs = 35.0;
constexpr double kSlowAttackMs = 20.0;
constexpr double kSlowReleaseMs = 250.0;
constexpr double kControlAttackMs = 2.0;
constexpr double kControlReleaseMs = 55.0;
constexpr double kTransientFloor = 0.002;
constexpr double kTransientNormaliser = 0.025;

double time_coefficient(double milliseconds, double sample_rate) {
  return 1.0 - std::exp(-1.0 / ((milliseconds / 1000.0) * sample_rate));
}

double clamp01(double value) {
  if (value < 0.0) {
    return 0.0;
  }
  return value > 1.0 ? 1.0 : value;
}

}  // namespace

extern "C" {

void feq_exciter_transient_init(FeqExciterTransient* state) {
  if (state == nullptr) {
    return;
  }
  state->fast_envelope = 0.0;
  state->slow_envelope = 0.0;
  state->amount = 0.0;
  state->sample_rate = 0.0;
  state->fast_attack = 0.0;
  state->fast_release = 0.0;
  state->slow_attack = 0.0;
  state->slow_release = 0.0;
  state->control_attack = 0.0;
  state->control_release = 0.0;
}

void feq_exciter_transient_reset(FeqExciterTransient* state) {
  if (state == nullptr) {
    return;
  }
  state->fast_envelope = 0.0;
  state->slow_envelope = 0.0;
  state->amount = 0.0;
}

double feq_exciter_transient_sample(FeqExciterTransient* state,
                                    double sample,
                                    double sample_rate) {
  if (state == nullptr) {
    return 0.0;
  }
  // Recomputed only when the rate actually changes: six exponentials per
  // sample to rebuild constants would dominate this whole stage.
  if (state->sample_rate != sample_rate) {
    state->sample_rate = sample_rate;
    state->fast_attack = time_coefficient(kFastAttackMs, sample_rate);
    state->fast_release = time_coefficient(kFastReleaseMs, sample_rate);
    state->slow_attack = time_coefficient(kSlowAttackMs, sample_rate);
    state->slow_release = time_coefficient(kSlowReleaseMs, sample_rate);
    state->control_attack = time_coefficient(kControlAttackMs, sample_rate);
    state->control_release = time_coefficient(kControlReleaseMs, sample_rate);
  }

  const double magnitude = std::fabs(sample);
  const double fast_coefficient = magnitude > state->fast_envelope
                                      ? state->fast_attack
                                      : state->fast_release;
  const double slow_coefficient = magnitude > state->slow_envelope
                                      ? state->slow_attack
                                      : state->slow_release;
  state->fast_envelope += (magnitude - state->fast_envelope) * fast_coefficient;
  state->slow_envelope += (magnitude - state->slow_envelope) * slow_coefficient;

  const double normaliser = state->fast_envelope > kTransientNormaliser
                                ? state->fast_envelope
                                : kTransientNormaliser;
  const double target =
      state->fast_envelope > kTransientFloor
          ? clamp01((state->fast_envelope - state->slow_envelope) / normaliser)
          : 0.0;
  const double control_coefficient = target > state->amount
                                         ? state->control_attack
                                         : state->control_release;
  state->amount += (target - state->amount) * control_coefficient;
  return state->amount;
}

}  // extern "C"
