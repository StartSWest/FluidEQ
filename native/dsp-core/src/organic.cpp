/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/organic.h"

#include <cmath>

namespace {

constexpr double kParameterSmoothingMs = 18.0;
constexpr double kOrganicLevel = 0.65;
constexpr double kOrganicFoundationMix = 0.8;
constexpr double kOrganicHarmonicGain = 2.4;
constexpr double kOrganicTransientHarmonicLift = 0.35;

}  // namespace

extern "C" {

void feq_organic_init(FeqOrganic* state, float* wide, float* wide_dry) {
  if (state == nullptr) {
    return;
  }
  feq_oversampler_reset(&state->oversampler);
  state->wide = wide;
  state->wide_dry = wide_dry;
  state->drive = 0.0;
  state->asymmetry = 0.0;
  feq_exciter_transient_init(&state->transient);
}

void feq_organic_reset_transient(FeqOrganic* state) {
  if (state != nullptr) {
    feq_exciter_transient_reset(&state->transient);
  }
}

double feq_organic_drive(double amount) { return 0.8 + amount * 2.2; }

double feq_organic_asymmetry(double amount) { return 0.78 + amount * 0.17; }

double feq_organic_foundation_gain(void) {
  return kOrganicLevel * kOrganicFoundationMix;
}

double feq_organic_sample(double sample,
                          double drive,
                          double asymmetry,
                          double harmonic_gain) {
  const double character =
      (1.0 - asymmetry) * FEQ_ANALOG_DIODE_MAX_CHARACTER;
  const double foundation = sample * kOrganicLevel;
  const double complete = feq_analog_diode_excited_sample(
      sample, drive, character, kOrganicLevel,
      harmonic_gain * kOrganicHarmonicGain);
  return feq_limit_exciter_current(foundation * kOrganicFoundationMix +
                                   (complete - foundation));
}

double feq_organic_block(FeqOrganic* state,
                         float* target,
                         uint32_t frames,
                         double amount,
                         double sample_rate,
                         float* middle) {
  if (state == nullptr || target == nullptr || state->wide == nullptr ||
      state->wide_dry == nullptr || frames == 0) {
    return 0.0;
  }
  const uint32_t oversample =
      feq_oversample_factor_for_sample_rate(sample_rate);
  const uint32_t wide_frames = frames * oversample;

  feq_oversample_up(&state->oversampler, target, state->wide_dry, frames,
                    oversample, middle);

  // Smoothed at the OVERSAMPLED rate. At 4x that is four times as many steps
  // per block, so a port that used the session rate would glide four times too
  // fast and the dial would feel different at 44.1 and at 192.
  const double wide_rate = sample_rate * static_cast<double>(oversample);
  const double smooth =
      1.0 - std::exp(-1.0 / ((kParameterSmoothingMs / 1000.0) * wide_rate));
  const double target_drive = feq_organic_drive(amount);
  const double target_asymmetry = feq_organic_asymmetry(amount);

  // A first block starts where it is asked to rather than gliding up from
  // zero, which would be an audible swell every time the stage is switched on.
  if (state->drive == 0.0) {
    state->drive = target_drive;
    state->asymmetry = target_asymmetry;
  }

  const double foundation_gain = feq_organic_foundation_gain();
  for (uint32_t at = 0; at < wide_frames; ++at) {
    state->drive += (target_drive - state->drive) * smooth;
    state->asymmetry += (target_asymmetry - state->asymmetry) * smooth;
    const double dry = static_cast<double>(state->wide_dry[at]);
    const double transient =
        feq_exciter_transient_sample(&state->transient, dry, wide_rate);
    const double excited = feq_organic_sample(
        dry, state->drive, state->asymmetry,
        1.0 + transient * kOrganicTransientHarmonicLift);
    // Only the difference leaves this stage: it is summed in parallel, so
    // returning the foundation too would add a second copy of the signal.
    state->wide[at] = static_cast<float>(excited - dry * foundation_gain);
  }

  feq_oversample_down(&state->oversampler, state->wide, target, frames,
                      oversample, middle);
  return state->drive;
}

}  // extern "C"
