/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Footsteps in the rack: run after the EQ and before Bass Punch and the
 * Room, and reported to the page.
 *
 * After the EQ because the EQ is the listener's own voicing, and what is
 * quiet is decided on the sound as it will be heard. Before the Room because
 * the Room folds a 7.1 game around the head: lifted first, a step behind is
 * lifted on its own speaker, the same on every speaker, and the walls the
 * Room adds are never lifted with it. Before Punch and the Maximizer because
 * those are the level stages, and a lift after the ceiling would be a lift
 * over it.
 */
#include "chain_internal.h"
#include "footsteps_internal.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <complex>
#include <limits>

namespace {

/** The room's speaker that is the centre: FL, FR, then FC (`room.h`). */
constexpr int kCentreSpeaker = 2;

struct PowerPolynomial {
  double a, b, c;
};

// Squared magnitude on the unit circle is quadratic in cos(omega).
PowerPolynomial power_polynomial(double a, double b, double c) {
  return {4 * a * c, 2 * b * (a + c), (a - c) * (a - c) + b * b};
}

template <typename Add>
void add_extrema(const FeqBiquadCoefficients& k, Add add) {
  const auto n = power_polynomial(k.b0, k.b1, k.b2);
  const auto d = power_polynomial(1.0, k.a1, k.a2);
  const double a = n.a * d.b - n.b * d.a;
  const double b = 2 * (n.a * d.c - n.c * d.a);
  const double c = n.b * d.c - n.c * d.b;
  if (a == 0.0) {
    if (b != 0.0) add(-c / b);
    return;
  }
  const double discriminant = b * b - 4 * a * c;
  if (discriminant < 0.0) return;
  const double q = -0.5 * (b + std::copysign(std::sqrt(discriminant), b));
  if (q == 0.0) {
    add(-b / (2 * a));
  } else {
    add(q / a);
    add(c / q);
  }
}

double power_at(const FeqBiquadCoefficients& k, double x) {
  const std::complex<double> z{x, -std::sqrt(std::max(0.0, 1.0 - x * x))};
  const double denominator = std::norm(1.0 + z * (k.a1 + z * k.a2));
  return denominator > 0.0
      ? std::norm(k.b0 + z * (k.b1 + z * k.b2)) / denominator
      : std::numeric_limits<double>::infinity();
}

double preset_boost(const FeqChain* chain) {
  const auto& tone = chain->settings.tone;
  const auto count = std::min(tone.band_count, static_cast<uint32_t>(FEQ_CHAIN_MAX_TONE_BANDS));
  std::array<FeqBiquadCoefficients, FEQ_CHAIN_MAX_TONE_BANDS> filters;
  std::array<double, 99 + 2 * FEQ_CHAIN_MAX_TONE_BANDS> boundaries;
  size_t used = 0;
  boundaries[used++] = -1.0;
  boundaries[used++] = 1.0;
  for (uint32_t i = 0; i < count; ++i) {
    const auto& b = tone.bands[i];
    const auto design = tone.matched ? feq_biquad_coefficients_matched : feq_biquad_coefficients;
    filters[i] = design(b.type, b.frequency, b.gain_db, b.quality, chain->sample_rate);
    add_extrema(filters[i], [&](double x) {
      if (x > -1.0 && x < 1.0) boundaries[used++] = x;
    });
  }
  for (int bin = 0; bin <= 96; ++bin) {
    const double hz = std::min(0.49 * chain->sample_rate, 20 * std::exp2(bin / 9.6));
    boundaries[used++] = std::cos(6.283185307179586 * hz / chain->sample_rate);
  }
  std::sort(boundaries.begin(), boundaries.begin() + used);
  // Each section is monotone in every interval once its extrema are
  // included. The product of the individual maxima bounds the cascade,
  // including a high-Q peak between the ordinary log-spaced samples.
  double peak = 1.0;
  for (size_t at = 1; at < used; ++at) {
    double power = 1.0;
    for (uint32_t i = 0; i < count; ++i) {
      power *= std::max(power_at(filters[i], boundaries[at - 1]),
                        power_at(filters[i], boundaries[at]));
    }
    if (!std::isfinite(power)) return std::numeric_limits<double>::infinity();
    peak = std::max(peak, power);
  }
  return std::sqrt(peak);
}

}  // namespace

void chain_configure_footsteps(FeqChain* chain) {
  if (!chain->footsteps) return;
  feq_footsteps_configure(chain->footsteps, &chain->settings.footsteps);
  // The limiter hears the preset curve after the cues are added. Reserve its
  // boost for the wet signal here, before it can make the limiter ride the mix.
  double ceiling = feq_footsteps_detail::kOverlayCeiling;
  if (chain->settings.footsteps.enabled) {
    const auto& max = chain->settings.maximizer;
    if (max.enabled && std::isfinite(max.ceiling_db) && std::isfinite(max.drive_db)) {
      ceiling = std::min(ceiling, std::pow(10.0, (max.ceiling_db - std::max(0.0, max.drive_db)) / 20));
    }
    if (chain->settings.tone.band_count > 0) ceiling /= preset_boost(chain);
  }
  chain->footsteps->cue_ceiling.store(ceiling, std::memory_order_relaxed);
}

void chain_apply_footsteps_layout(FeqChain* chain) {
  int centre = -1;
  for (uint32_t channel = 0; channel < chain->channels; ++channel) {
    if (chain->room_speakers[channel] == kCentreSpeaker) {
      centre = static_cast<int>(channel);
    }
  }
  feq_footsteps_set_lfe(chain->footsteps, chain->lfe_channel);
  feq_footsteps_set_centre(chain->footsteps, centre);
}

void chain_process_footsteps(FeqChain* chain, float* const* channels,
                             uint32_t frames) {
  if (chain->footsteps == nullptr) {
    return;
  }
  feq_footsteps_process(chain->footsteps, channels, frames);
  if (chain->meters != nullptr) {
    FeqFootstepsReport report{};
    feq_footsteps_block_report(chain->footsteps, &report);
    feq_meters_publish_footsteps(chain->meters, &report);
  }
}
