/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Mains hum, as a comb of depth-limited notches.
 *
 * Zero latency and no transform: hum is a handful of known, stationary, very
 * narrow tones, and a spectral subtractor is the wrong instrument for a
 * problem whose frequencies are already known to a tenth of a hertz.
 *
 * Two decisions here are the whole module. The first is that the notches are
 * PEAKING sections at negative gain rather than true notches — a real notch is
 * infinitely deep, and infinitely deep at 50 Hz takes the bass note sharing
 * that frequency with it. Hum does not have to be gone to stop being audible.
 * The second is that only partials the scan actually FOUND are notched: a
 * notch at a harmonic where there is no hum removes music and removes no buzz,
 * and a comb built from "the fundamental times one through ten" is nine of
 * those on most material.
 */

#include <algorithm>
#include <cmath>

#include "denoise_internal.h"

namespace {

/**
 * How far above the local floor a partial has to stand to be worth notching.
 *
 * Six decibels. Below that the scan is looking at the floor itself, and the
 * cost of a notch there is entirely on the music.
 */
constexpr double kHumPartialThresholdDb = 6.0;

/** Nothing above this is mains hum; it is the material. */
constexpr double kHumHighestPartialHz = 2000.0;

double fundamental_for(const FeqDenoise* denoise) {
  switch (denoise->settings.hum.mode) {
    case FEQ_DENOISE_HUM_FIFTY:
      return 50.0;
    case FEQ_DENOISE_HUM_SIXTY:
      return 60.0;
    case FEQ_DENOISE_HUM_AUTO:
    default:
      // Auto means measured, and an unanalyzed track has nothing to measure.
      // Placing a speculative 50 Hz comb because the dial says Auto would be
      // the module inventing a fault; the panel says no hum was found instead.
      return denoise->profile_ready ? denoise->profile.hum_hz : 0.0;
  }
}

}  // namespace

void denoise_hum_configure(FeqDenoise* denoise) {
  denoise->hum_coefficients.clear();

  const auto& settings = denoise->settings.hum;
  if (settings.enabled == 0 || denoise->settings.enabled == 0) {
    denoise->hum.resize(denoise->channels);
    return;
  }

  const double fundamental = fundamental_for(denoise);
  if (!(fundamental > 0.0)) {
    denoise->hum.resize(denoise->channels);
    return;
  }

  const uint32_t wanted = static_cast<uint32_t>(
      std::max(1.0, std::min(static_cast<double>(FEQ_DENOISE_MAX_HUM_PARTIALS),
                             std::floor(settings.harmonics + 0.5))));
  const double nyquist = denoise->sample_rate * 0.5;

  for (uint32_t partial = 1; partial <= wanted; partial += 1) {
    double hz = fundamental * static_cast<double>(partial);

    // A measured partial is used at its measured frequency rather than at an
    // exact multiple. Mains harmonics drift with the supply and with whatever
    // recorded them, and by the eighth partial an assumed multiple can be
    // several hertz out — which for a Q of 30 is entirely outside the notch.
    bool present = !denoise->profile_ready;
    // With no scan there is no measurement, so the dial's depth is all there
    // is to go on. With one, the depth is bounded by what was measured.
    double excess_db = settings.depth_db;
    if (denoise->profile_ready) {
      for (uint32_t i = 0; i < denoise->profile.hum_partial_count; i += 1) {
        const double candidate = denoise->profile.hum_partial_hz[i];
        if (std::fabs(candidate - hz) <= fundamental * 0.25) {
          if (denoise->profile.hum_partial_excess_db[i] >=
              kHumPartialThresholdDb) {
            hz = candidate;
            excess_db = denoise->profile.hum_partial_excess_db[i];
            present = true;
          }
          break;
        }
      }
    }

    if (!present || hz >= kHumHighestPartialHz || hz >= nyquist * 0.95) {
      continue;
    }

    /*
     * Never cut a partial deeper than it actually stands above the floor.
     *
     * One depth for the whole comb treats the tenth partial like the first,
     * and mains partials do not arrive at one level — they fall away with
     * order. So a flat twenty-decibel comb spends most of its notches taking
     * twenty decibels out of a partial that was six decibels tall, and the
     * other fourteen come out of whatever music shares the frequency. They buy
     * nothing: once a partial is at the floor it is inaudible whatever else is
     * done to it.
     *
     * The professional tools offer this as a fixed slope over harmonic order.
     * A measurement per partial is the same idea without the guess, and the
     * scan has already made it.
     */
    const double depth_db = std::min(settings.depth_db, excess_db);

    denoise->hum_coefficients.push_back(feq_biquad_coefficients(
        FEQ_FILTER_PK, hz, -depth_db, settings.quality,
        denoise->sample_rate));
  }

  denoise->hum.resize(denoise->channels);
  for (auto& channel : denoise->hum) {
    if (channel.states.size() != denoise->hum_coefficients.size()) {
      channel.states.assign(denoise->hum_coefficients.size(), FeqBiquadState{});
      for (auto& state : channel.states) {
        feq_biquad_reset(&state);
      }
    }
  }
}

void denoise_hum_reset(FeqDenoise* denoise) {
  for (auto& channel : denoise->hum) {
    for (auto& state : channel.states) {
      feq_biquad_reset(&state);
    }
  }
}

void denoise_hum_process(FeqDenoise* denoise,
                         float* const* channels,
                         uint32_t frames) {
  if (denoise->settings.hum.enabled == 0 ||
      denoise->hum_coefficients.empty()) {
    return;
  }
  const size_t sections = denoise->hum_coefficients.size();
  for (uint32_t c = 0; c < denoise->channels; c += 1) {
    DenoiseHumChannel& channel = denoise->hum[c];
    for (size_t section = 0; section < sections; section += 1) {
      feq_biquad_process(&channel.states[section], channels[c], frames,
                         &denoise->hum_coefficients[section]);
    }
  }
}
