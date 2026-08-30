/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/analog_diode.h"

#include <cmath>

namespace {

constexpr double kWarmBias = 0.58;
constexpr double kAirBias = 0.12;
constexpr double kCurrentCeiling = 0.45;

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

double feq_analog_diode_excited_sample(double sample,
                                       double drive,
                                       double character,
                                       double level,
                                       double harmonic_gain) {
  const double driven = sample * drive;
  const double character_mix =
      clamp01(character / FEQ_ANALOG_DIODE_MAX_CHARACTER);
  const double bias = kWarmBias + (kAirBias - kWarmBias) * character_mix;
  const double bias_output = std::tanh(bias);
  const double tangent_gain = 1.0 - bias_output * bias_output;
  const double shaped = std::tanh(driven + bias) - bias_output;
  const double safe_drive = drive > 0.001 ? drive : 0.001;
  const double complete = (shaped * level) / (safe_drive * tangent_gain);
  const double foundation = sample * level;
  return foundation + (complete - foundation) * harmonic_gain;
}

double feq_analog_diode_octave_sample(double sample,
                                      double drive,
                                      double character,
                                      double level,
                                      double harmonic_gain,
                                      double even_weight) {
  const double driven = sample * drive;
  const double character_mix =
      clamp01(character / FEQ_ANALOG_DIODE_MAX_CHARACTER);
  const double bias = kWarmBias + (kAirBias - kWarmBias) * character_mix;
  const double bias_output = std::tanh(bias);
  const double tangent_gain = 1.0 - bias_output * bias_output;
  const double odd = std::tanh(driven + bias) - bias_output;
  /**
   * The octave, made by squaring the shape rather than biasing it harder.
   *
   * `tanh` is an odd function, so on its own it produces third and fifth
   * orders: on a 60 Hz note that is 180 and 300 Hz, a twelfth and a
   * seventeenth above the root. Dissonant intervals, heard as hardness. The
   * bias adds even orders, but drive is what makes harmonics loud and drive
   * pushes the odd content up faster than the bias can answer — measured on the
   * low band, the third order came out 5 dB ABOVE the second.
   *
   * Squaring an odd shape is even-symmetric, so it produces the second and
   * fourth orders and nothing else: the octave and two octaves, which is the
   * interval a small speaker uses to imply a fundamental it cannot reproduce.
   * The doubling restores unity — `sin(x)^2` puts half its amplitude at 2f and
   * half at DC — and the DC is removed downstream by the block filter the
   * exciter already runs.
   */
  const double even = 2.0 * odd * odd;
  const double safe_drive = drive > 0.001 ? drive : 0.001;
  const double scale = level / (safe_drive * tangent_gain);
  const double foundation = sample * level;

  /**
   * The blend is between the two sets of HARMONICS, not between two signals.
   *
   * The odd shape carries the fundamental through it; the squared shape does
   * not carry one at all. Blending the shapes and then subtracting the
   * foundation therefore subtracts a fundamental that the even half never
   * contributed, and the note being excited comes out quieter — measured at
   * -4.2 dB on the first attempt at this, which is an exciter acting as a
   * volume control.
   *
   * Taking each path's residue first and blending those leaves the foundation
   * untouched by construction, whatever the weight is set to.
   */
  const double odd_residue = odd * scale - foundation;
  const double even_residue = even * scale;
  const double residue =
      odd_residue + (even_residue - odd_residue) * clamp01(even_weight);
  return foundation + residue * harmonic_gain;
}

double feq_limit_exciter_current(double current) {
  return std::tanh(current / kCurrentCeiling) * kCurrentCeiling;
}

}  // extern "C"
