/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The filters and curves Environment and Dialogue share (`game_parts.h`). */
#include <algorithm>
#include <cmath>

#include "game_parts.h"

namespace feq_footsteps_detail {
namespace {

constexpr double kPi = 3.14159265358979323846;

/** Never at or past Nyquist: a corner the rate cannot hold sits under it. */
double omega(double rate, double hz) {
  return 2.0 * kPi * std::min(hz, 0.45 * rate) / rate;
}

}  // namespace

Biquad butterworth_high_pass(double rate, double hz) {
  const double w = omega(rate, hz);
  const double alpha = std::sin(w) / (2.0 * std::sqrt(0.5));
  const double cw = std::cos(w);
  const double a0 = 1.0 + alpha;
  Biquad k;
  k.b0 = (1.0 + cw) / 2.0 / a0;
  k.b1 = -(1.0 + cw) / a0;
  k.b2 = k.b0;
  k.a1 = -2.0 * cw / a0;
  k.a2 = (1.0 - alpha) / a0;
  return k;
}

Biquad butterworth_low_pass(double rate, double hz) {
  const double w = omega(rate, hz);
  const double alpha = std::sin(w) / (2.0 * std::sqrt(0.5));
  const double cw = std::cos(w);
  const double a0 = 1.0 + alpha;
  Biquad k;
  k.b0 = (1.0 - cw) / 2.0 / a0;
  k.b1 = (1.0 - cw) / a0;
  k.b2 = k.b0;
  k.a1 = -2.0 * cw / a0;
  k.a2 = (1.0 - alpha) / a0;
  return k;
}

Biquad band_pass(double rate, double hz, double q) {
  const double w = omega(rate, hz);
  const double alpha = std::sin(w) / (2.0 * q);
  const double a0 = 1.0 + alpha;
  Biquad k;
  k.b0 = alpha / a0;
  k.b1 = 0.0;
  k.b2 = -alpha / a0;
  k.a1 = -2.0 * std::cos(w) / a0;
  k.a2 = (1.0 - alpha) / a0;
  return k;
}

double split_coefficient(double rate, double hz) {
  const double t = std::tan(0.5 * omega(rate, hz));
  return (t - 1.0) / (t + 1.0);
}

double pole_of(double rate, double ms) {
  return 1.0 - std::exp(-1.0 / (ms * 0.001 * rate));
}

void glide_gain(double& gain, double& per_sample, double db, double samples) {
  if (db == 0.0 && std::fabs(gain - 1.0) < 1e-9) {
    gain = 1.0;
    per_sample = 0.0;
    return;
  }
  per_sample = (std::exp(db * (2.302585092994046 / 20.0)) - gain) / samples;
}

double smooth_step(double low, double high, double value) {
  const double t = std::clamp((value - low) / (high - low), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

}  // namespace feq_footsteps_detail
