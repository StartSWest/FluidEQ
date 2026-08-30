/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/harmonics.h"

#include <cmath>

namespace {

/**
 * Fast enough to find a note, slow enough not to ride out its decay.
 *
 * The level follower is what makes the harmonic ratio constant, so its release
 * is the one number that decides whether a fade-out keeps its character. At
 * 180 ms a decaying note stays excited as it falls; much faster and the
 * follower chases the note's own envelope, which puts the effect back where it
 * started.
 */
constexpr double kLevelAttackMs = 10.0;
constexpr double kLevelReleaseMs = 180.0;

/**
 * Below this the effect fades out rather than amplifying the noise floor.
 *
 * Dividing by a measured level is division by something that reaches zero. The
 * floor is not a gate: the level is clamped, not the signal, so the ratio falls
 * away smoothly under -60 dBFS instead of switching off at a threshold.
 */
constexpr double kQuietFloor = 0.001;

/**
 * The fit tracks the shaper's linear gain, not the waveform.
 *
 * It has to be far slower than the lowest note in the lowest band or it starts
 * removing the harmonics as well: at 20 Hz one cycle is 50 ms, so the window
 * has to be several of those. What it is measuring barely moves, so the lag
 * costs nothing.
 */
constexpr double kFitTrackMs = 250.0;

/** Below this there is no signal to fit, and the ratio would be noise. */
constexpr double kFitFloor = 1e-9;

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

void feq_harmonic_init(FeqHarmonicState* state) {
  if (state == nullptr) {
    return;
  }
  state->mean_square = 0.0;
  state->cross = 0.0;
  state->energy = 0.0;
  state->sample_rate = 0.0;
  state->level_attack = 0.0;
  state->level_release = 0.0;
  state->fit = 0.0;
}

void feq_harmonic_reset(FeqHarmonicState* state) {
  if (state == nullptr) {
    return;
  }
  state->mean_square = 0.0;
  state->cross = 0.0;
  state->energy = 0.0;
}

double feq_harmonic_sample(FeqHarmonicState* state, double sample, double depth,
                           double even_weight, double sample_rate) {
  if (state == nullptr) {
    return 0.0;
  }
  // Three exponentials to rebuild the constants; only when the rate moves.
  if (state->sample_rate != sample_rate) {
    state->sample_rate = sample_rate;
    state->level_attack = time_coefficient(kLevelAttackMs, sample_rate);
    state->level_release = time_coefficient(kLevelReleaseMs, sample_rate);
    state->fit = time_coefficient(kFitTrackMs, sample_rate);
  }

  const double square = sample * sample;
  const double level_coefficient = square > state->mean_square
                                       ? state->level_attack
                                       : state->level_release;
  state->mean_square += (square - state->mean_square) * level_coefficient;
  // Mean square rather than a peak follower: a peak follower on a 40 Hz note
  // ripples at the note's own rate, and dividing by a rippling level is
  // amplitude modulation. The factor of two makes this the peak of a sine, so
  // a tone normalises to unity and `depth` reads as a plain ratio.
  const double measured = std::sqrt(2.0 * state->mean_square);
  const double level = measured > kQuietFloor ? measured : kQuietFloor;

  // Bounded before the polynomials, which is not optional: T3 grows as the
  // cube, so a transient sitting three times over the level would come back
  // twenty-six times its own size. The tangent is nearly linear over the range
  // the follower normalises to, so it costs almost no harmonics of its own.
  const double normalised = std::tanh(sample / level);
  const double square_normalised = normalised * normalised;
  /**
   * T2 = 2x^2 - 1 and T3 = 4x^3 - 3x, at exactly 2f and 3f — except that the
   * second order is used WITHOUT Chebyshev's -1.
   *
   * That constant centres a full-scale sine, and the signal here is not one. It
   * is only right while a note is sounding at the level the follower holds, and
   * the follower holds for 180 ms after the note goes — so -1 times that level
   * keeps being painted over the silence. Measured on the low band after a
   * gated note, that left a tail which PLATEAUED rather than decayed: -40.6 dB
   * at 20-60 ms, -44.6 at 60-150, still -47.0 at 150-400. The same windows read
   * -36.2, -79.6 and nothing once the constant went.
   *
   * `2x^2` reaches zero when the signal does, so the offset follows the
   * programme instead of the follower. It carries the same energy at 2f — every
   * harmonic figure measured across all three bands was unchanged to 0.1 dB —
   * and what it carries at DC is what the block filter downstream is for.
   */
  const double second = 2.0 * square_normalised;
  const double third = normalised * (4.0 * square_normalised - 3.0);
  const double weight = clamp01(even_weight);
  const double shaped = third + (second - third) * weight;

  /**
   * Subtract whatever of the input the shaper handed back.
   *
   * A running least-squares fit of `shaped` onto `normalised`: the ratio of
   * their product to the input's own energy is exactly the linear gain the
   * shape has, and removing that much of the input leaves only what the shape
   * ADDED. Without it the third-order path returns most of a fundamental of its
   * own — measured at 0.98 of the input for a normalised sine, which turns the
   * Texture control into a 2 dB cut.
   */
  state->cross += (shaped * normalised - state->cross) * state->fit;
  state->energy += (square_normalised - state->energy) * state->fit;
  const double projection =
      state->energy > kFitFloor ? state->cross / state->energy : 0.0;
  const double harmonics = shaped - projection * normalised;

  return harmonics * depth * level;
}

}  // extern "C"
