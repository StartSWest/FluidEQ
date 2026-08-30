/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/organic.h"

#include <cmath>

namespace {

constexpr double kParameterSmoothingMs = 18.0;
/**
 * The same quiet carrier the three bands use, and for the same reason.
 *
 * It was 0.52 — a return that was half a copy of its own focused band, against
 * the bands' 0.18. That made Organic the loudest thing in several profiles and
 * its Amount dial a level control: measured alone at its focus, the MINIMUM
 * amount already added +1.23 dB and the whole dial only reached +3.18, so
 * turning it down could not take the lift away. It reads +0.46 to +2.27 now,
 * and what the dial moves is harmonic density.
 */
constexpr double kOrganicFoundationGain = 0.18;
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
  state->depth = 0.0;
  state->even_weight = 0.0;
  feq_exciter_transient_init(&state->transient);
  feq_harmonic_init(&state->harmonics);
}

void feq_organic_reset_transient(FeqOrganic* state) {
  if (state != nullptr) {
    feq_exciter_transient_reset(&state->transient);
    // The level follower too, or the stage comes back holding the level of
    // whatever was playing when it was switched off.
    feq_harmonic_reset(&state->harmonics);
  }
}

/**
 * How much harmonic content the dial asks for, as a ratio of the focused band.
 *
 * The same figure the three bands call Depth, and it means the same thing here:
 * what survives to the output as harmonic amplitude, at any playback level.
 *
 * It was roughly twice this, chosen so the default matched the old soft-diode
 * curve on a -6 dBFS TONE. That was the wrong place to match. The old curve
 * followed the input level, so on ordinary material near -20 dBFS it produced
 * far less than it did at a peak, while this one produces the same ratio
 * everywhere — matching at the peak put about ten decibels more harmonic
 * content on everything that is not one.
 */
double feq_organic_depth(double amount) { return 0.08 + amount * 0.46; }

/**
 * Organic stays even-dominant; the upper travel only adds a little density.
 *
 * Neither end crosses over to odd. That is the whole identity of the stage —
 * body rather than edge — and it is the one thing about it that must not move.
 */
double feq_organic_even_weight(double amount) { return 0.9 - amount * 0.12; }

double feq_organic_foundation_gain(void) { return kOrganicFoundationGain; }

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
  const double target_depth = feq_organic_depth(amount);
  const double target_even_weight = feq_organic_even_weight(amount);

  // A first block starts where it is asked to rather than gliding up from
  // zero, which would be an audible swell every time the stage is switched on.
  if (state->depth == 0.0) {
    state->depth = target_depth;
    state->even_weight = target_even_weight;
  }

  for (uint32_t at = 0; at < wide_frames; ++at) {
    state->depth += (target_depth - state->depth) * smooth;
    state->even_weight += (target_even_weight - state->even_weight) * smooth;
    const double dry = static_cast<double>(state->wide_dry[at]);
    const double transient =
        feq_exciter_transient_sample(&state->transient, dry, wide_rate);
    // Harmonics only: this stage is summed in parallel, so the caller restores
    // the foundation after downsampling rather than it being returned here.
    state->wide[at] = static_cast<float>(feq_harmonic_sample(
        &state->harmonics, dry,
        state->depth * (1.0 + transient * kOrganicTransientHarmonicLift),
        state->even_weight, wide_rate));
  }

  feq_oversample_down(&state->oversampler, state->wide, target, frames,
                      oversample, middle);
  return state->depth;
}

}  // extern "C"
