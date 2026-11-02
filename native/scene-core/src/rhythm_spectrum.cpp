/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// `src/common/rhythmSpectrum.ts`: the drums read from the two windows' bins,
// each region's rise over the frame 25 ms before.

#include <algorithm>
#include <cmath>

#include "fluideq/scene/rhythm.h"

namespace feq::scene {
namespace {

constexpr std::size_t kFramesKept = 12;
constexpr double kRiseLagMs = 25.0;
constexpr double kFloorBelowDb = 50.0;
constexpr double kFloorDb = -90.0;
constexpr std::array<double, 2> kLowRegion{60.0, 234.0};
constexpr std::array<double, 2> kCrackRegion{1100.0, 4000.0};
constexpr std::array<double, 2> kPresenceRegion{4000.0, 8000.0};
constexpr std::array<double, 2> kAirRegion{8000.0, 16000.0};

double floor_of(float db) {
  return std::isfinite(db) ? std::max(-100.0, static_cast<double>(db)) : -100.0;
}

std::array<std::ptrdiff_t, 2> bin_range(const std::array<double, 2>& region,
                                        double bin_hz, std::size_t count) {
  return {static_cast<std::ptrdiff_t>(std::max(1.0, std::ceil(region[0] / bin_hz))),
          std::min(static_cast<std::ptrdiff_t>(count) - 1,
                   static_cast<std::ptrdiff_t>(std::floor(region[1] / bin_hz)))};
}

struct RegionRise {
  double rise;
  double added;
};

RegionRise rise_in(const std::vector<float>& now,
                   const std::vector<float>& before,
                   const std::array<std::ptrdiff_t, 2>& bins, double floor,
                   double loudest_power) {
  double rise = 0.0;
  double added = 0.0;
  for (std::ptrdiff_t bin = bins[0]; bin <= bins[1]; ++bin) {
    const auto at = static_cast<std::size_t>(bin);
    const double is = std::max(floor, floor_of(now[at]));
    const double was = std::max(floor, floor_of(before[at]));
    rise += std::max(0.0, is - was);
    added += std::max(0.0, std::pow(10.0, is / 10.0) - std::pow(10.0, was / 10.0));
  }
  const double count =
      static_cast<double>(std::max<std::ptrdiff_t>(1, bins[1] - bins[0] + 1));
  return {rise / count, added / loudest_power};
}

}  // namespace

std::array<double, 3> read_spectrum_drums(SpectrumDrumState& state,
                                          double at_ms, const SoundHop& hop) {
  auto& frames = state.frames;
  const KeptSpectrum* found = nullptr;
  for (auto at = frames.rbegin(); at != frames.rend(); ++at) {
    if (at_ms - at->at_ms >= kRiseLagMs) {
      found = &*at;
      break;
    }
  }
  if (found == nullptr && !frames.empty()) {
    found = &frames.front();
  }
  // The base is read before the newest frame can push it out.
  std::optional<KeptSpectrum> base;
  if (found != nullptr) {
    base = *found;
  }
  frames.push_back({at_ms, hop.low, hop.high});
  if (frames.size() > kFramesKept) {
    frames.pop_front();
  }
  if (!base || base->low.size() != hop.low.size() ||
      base->high.size() != hop.high.size()) {
    return {0.0, 0.0, 0.0};
  }
  const auto low_bins = bin_range(kLowRegion, hop.low_bin_hz, hop.low.size());
  const auto crack_bins =
      bin_range(kCrackRegion, hop.high_bin_hz, hop.high.size());
  const auto presence_bins =
      bin_range(kPresenceRegion, hop.high_bin_hz, hop.high.size());
  const auto air_bins = bin_range(kAirRegion, hop.high_bin_hz, hop.high.size());
  double loudest = -100.0;
  for (std::ptrdiff_t bin = low_bins[0]; bin <= low_bins[1]; ++bin) {
    const auto at = static_cast<std::size_t>(bin);
    loudest = std::max({loudest, floor_of(hop.low[at]), floor_of(base->low[at])});
  }
  for (auto bin = static_cast<std::ptrdiff_t>(
           std::ceil(kLowRegion[1] / hop.high_bin_hz));
       bin <= air_bins[1]; ++bin) {
    const auto at = static_cast<std::size_t>(bin);
    loudest =
        std::max({loudest, floor_of(hop.high[at]), floor_of(base->high[at])});
  }
  const double floor = std::max(kFloorDb, loudest - kFloorBelowDb);
  const double loudest_power = std::pow(10.0, loudest / 10.0);
  const RegionRise low =
      rise_in(hop.low, base->low, low_bins, floor, loudest_power);
  const RegionRise crack =
      rise_in(hop.high, base->high, crack_bins, floor, loudest_power);
  const RegionRise presence =
      rise_in(hop.high, base->high, presence_bins, floor, loudest_power);
  const RegionRise air =
      rise_in(hop.high, base->high, air_bins, floor, loudest_power);
  const double air_share =
      air.added / std::max(1e-9, crack.added + presence.added + air.added);
  return {low.rise / 100.0, std::min(crack.rise, presence.rise) / 100.0,
          (air_share * air.rise) / 100.0};
}

}  // namespace feq::scene
