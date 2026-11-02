/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// `src/common/rhythmDrums.ts`: the bands' rises, the drums' features in
// them, and the detector that says a feature stood out.

#include <algorithm>
#include <cmath>

#include "fluideq/scene/energy_levels.h"
#include "fluideq/scene/rhythm.h"

namespace feq::scene {
namespace {

constexpr int kCrackFrom = 14;
constexpr int kCrackTo = 18;
constexpr int kHatFrom = 20;
constexpr int kHatTo = 23;
constexpr double kRiseLagMs = 25.0;
constexpr std::size_t kFramesKept = 12;
constexpr double kSmallestHit = 0.01;
constexpr double kPeakHalfLifeMs = 4000.0;
constexpr double kMostShare = 0.95;

double mean_of(const Bands& rises, int from, int to) {
  double sum = 0.0;
  for (int at = from; at <= to; ++at) {
    sum += rises[static_cast<std::size_t>(at)];
  }
  return sum / static_cast<double>(to - from + 1);
}

double kick_of(const Bands& rises) {
  return std::min({mean_of(rises, 0, 2), mean_of(rises, 3, 4),
                   1.3 * mean_of(rises, 5, 6)});
}

}  // namespace

void keep_band_frame(std::deque<BandFrame>& frames, double at_ms,
                     const Bands& bands) {
  frames.push_back({at_ms, bands});
  if (frames.size() > kFramesKept) {
    frames.pop_front();
  }
}

Bands band_rises(const std::deque<BandFrame>& frames, double at_ms,
                 const Bands& bands) {
  const BandFrame* base = nullptr;
  for (auto at = frames.rbegin(); at != frames.rend(); ++at) {
    if (at_ms - at->at_ms >= kRiseLagMs) {
      base = &*at;
      break;
    }
  }
  if (base == nullptr && !frames.empty()) {
    base = &frames.front();
  }
  Bands rises{};
  if (base == nullptr) {
    return rises;
  }
  for (std::size_t at = 0; at < rises.size(); ++at) {
    rises[at] = std::max(0.0, bands[at] - base->bands[at]);
  }
  return rises;
}

void follow_band_tops(std::array<float, kRhythmBandCount>& tops,
                      const Bands& bands, double step_ms) {
  const double fall = (0.03 * step_ms) / 1000.0;
  for (std::size_t at = 0; at < tops.size(); ++at) {
    tops[at] = static_cast<float>(
        std::max(bands[at], static_cast<double>(tops[at]) - fall));
  }
}

Bands gate_rises(const Bands& rises, const Bands& bands,
                 const std::array<float, kRhythmBandCount>& tops) {
  Bands gated{};
  for (std::size_t at = 0; at < rises.size(); ++at) {
    const double under = static_cast<double>(tops[at]) - bands[at];
    gated[at] = rises[at] * std::max(0.0, std::min(1.0, (0.4 - under) / 0.2));
  }
  return gated;
}

Bands step_rises(const std::deque<BandFrame>& frames, const Bands& bands) {
  Bands rises{};
  if (frames.empty()) {
    return rises;
  }
  const BandFrame& last = frames.back();
  for (std::size_t at = 0; at < rises.size(); ++at) {
    rises[at] = std::max(0.0, bands[at] - last.bands[at]);
  }
  return rises;
}

DrumFeatures drum_features(const Bands& rises) {
  const double crack = mean_of(rises, kCrackFrom, kCrackTo);
  const double top = mean_of(rises, kHatFrom, kHatTo);
  DrumFeatures features;
  features.kick = kick_of(rises);
  features.snare = std::max(
      0.0,
      std::min(crack, 0.8 * top) *
              std::max(0.0, std::min(1.0, (crack / std::max(top, 1e-4) - 0.2) /
                                              0.15)) -
          0.15 * mean_of(rises, 0, 6));
  features.hat = std::max(0.0, mean_of(rises, kHatFrom, kHatTo) - 2.5 * crack);
  features.broad = mean_of(rises, 0, kRhythmBandCount - 1);
  return features;
}

double beat_strength(const Bands& rises, double kick_height,
                     double snare_height) {
  const DrumFeatures drums = drum_features(rises);
  const double kick = drums.kick / std::max(0.02, kick_height);
  const double snare = drums.snare / std::max(0.02, snare_height);
  const double broad =
      drums.broad / std::max({0.02, kick_height, snare_height});
  return kick + snare + 0.2 * broad;
}

double tempo_strength(const Bands& rises, const Bands& bands) {
  double loudest = 0.0;
  for (const double level : bands) {
    loudest = std::max(loudest, level);
  }
  double sum = 0.0;
  for (std::size_t at = 0; at < rises.size(); ++at) {
    const double under = loudest - bands[at];
    sum += rises[at] * std::max(0.0, std::min(1.0, (0.4 - under) / 0.1));
  }
  return sum / static_cast<double>(rises.size()) + 0.5 * kick_of(rises);
}

double listen_for(HitDetector& detector, double feature, double step_ms,
                  const HitRule& rule, double bias) {
  const double threshold =
      std::max({detector.floor + bias * rule.margin * detector.spread,
                std::min(kMostShare, bias * rule.share) * detector.peak,
                kSmallestHit});
  const bool was_within = detector.since_ms < rule.refractory_ms;
  detector.since_ms += step_ms;
  if (detector.since_ms < rule.refractory_ms) {
    detector.hit_top = std::max(detector.hit_top, feature);
  } else if (was_within) {
    detector.peak = std::max(detector.peak, detector.hit_top);
  }
  const bool hit = feature > threshold && detector.since_ms >= rule.refractory_ms;
  const double towards =
      ease_factor(step_ms, feature < detector.floor ? 150.0 : 2000.0);
  detector.floor += (feature - detector.floor) * towards;
  detector.spread += (std::abs(feature - detector.floor) - detector.spread) *
                     ease_factor(step_ms, 1200.0);
  detector.peak *= std::pow(2.0, -step_ms / kPeakHalfLifeMs);
  if (hit) {
    detector.since_ms = 0.0;
    detector.hit_top = feature;
  }
  return hit ? feature / threshold : 0.0;
}

}  // namespace feq::scene
