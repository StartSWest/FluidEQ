/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

// The made-up songs the parity fixtures were read from, built here by the
// same formulas as `src/common/soundHopsFixture.ts` and
// `src/common/sceneEnergyFixture.ts`: the samples are the TypeScript's, so a
// difference in what is heard is a difference in the hearing.

#include <cmath>
#include <cstdint>
#include <numbers>

namespace feq::scene::fixture {

/** `fixtureNoise`: white noise, -1 to 1, from an integer hash of `n`. */
inline double fixture_noise(std::int64_t n) {
  auto x = static_cast<std::uint32_t>(n);
  x = (x ^ (x >> 16U)) * 0x45d9f3bU;
  x = (x ^ (x >> 16U)) * 0x45d9f3bU;
  x = x ^ (x >> 16U);
  return (static_cast<double>(x) / 4294967296.0) * 2.0 - 1.0;
}

/** `soundHopsFixtureSample`: the groove. */
inline void groove_sample(std::int64_t n, double rate, double& left,
                          double& right) {
  const double t = static_cast<double>(n) / rate;
  const double pi = std::numbers::pi;
  const double beat = std::fmod(t, 0.5);
  const double kick =
      beat < 0.12 ? std::sin(2 * pi * 55 * t) * std::exp(-beat * 30) : 0.0;
  const double hat_at = std::fmod(t + 0.25, 0.5);
  const double hat =
      hat_at < 0.03 ? 0.2 * fixture_noise(n) * std::exp(-hat_at * 120) : 0.0;
  const double chord =
      0.08 * (std::sin(2 * pi * 220 * t) + std::sin(2 * pi * 277.18 * t) +
              std::sin(2 * pi * 329.63 * t));
  const double voice =
      0.15 * std::sin(2 * pi * 330 * t + 6 * std::sin(2 * pi * 5 * t));
  left = 0.6 * kick + hat + chord + voice;
  right = 0.6 * kick - 0.5 * hat + 0.7 * chord + voice;
}

/** `sceneEnergyFixtureSample`: the groove, a break, a build and a drop. */
inline void shaped_sample(std::int64_t n, double rate, double& left,
                          double& right) {
  const double t = static_cast<double>(n) / rate;
  const double pi = std::numbers::pi;
  double groove_left = 0.0;
  double groove_right = 0.0;
  groove_sample(n, rate, groove_left, groove_right);
  if (t < 7.5) {
    left = groove_left;
    right = groove_right;
    return;
  }
  if (t < 8) {
    left = 0.3 * groove_left;
    right = 0.3 * groove_right;
    return;
  }
  const double chord =
      0.06 * (std::sin(2 * pi * 220 * t) + std::sin(2 * pi * 329.63 * t));
  if (t < 14) {
    const double rise = std::pow(10.0, (-36 + 6 * (t - 8)) / 20);
    const double bright = rise * (fixture_noise(n) - fixture_noise(n - 1));
    left = chord + bright;
    right = chord + 0.8 * bright;
    return;
  }
  const double jump = t >= 18 ? 0.17 : 0.0;
  const double beat = std::fmod(std::fmod(t - 14.3 - jump, 0.5) + 0.5, 0.5);
  const double kick =
      beat < 0.15 ? std::sin(2 * pi * 50 * t) * std::exp(-beat * 20) : 0.0;
  const double flam =
      beat >= 0.11 && beat < 0.21
          ? 0.6 * std::sin(2 * pi * 50 * t) * std::exp(-(beat - 0.11) * 25)
          : 0.0;
  left = kick + flam + 1.2 * groove_left;
  right = kick + flam + 1.2 * groove_right;
}

}  // namespace feq::scene::fixture
