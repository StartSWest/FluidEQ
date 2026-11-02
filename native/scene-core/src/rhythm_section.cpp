/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// `src/common/rhythmSection.ts`: the song's shape — how intense this part
// is against the rest, a build, a drop landing.

#include <algorithm>
#include <cmath>

#include "fluideq/scene/energy_levels.h"
#include "fluideq/scene/rhythm.h"

namespace feq::scene {
namespace {

constexpr double kDropHalfLifeMs = 700.0;
constexpr double kBlockMs = 500.0;
constexpr std::size_t kBlocksKept = 12;
constexpr std::size_t kBuildWindowBlocks = 8;
constexpr int kUpperFromBand = 14;
constexpr double kWarmUpMs = 10000.0;
constexpr double kBuildSlopeDbS = 0.5;
constexpr double kBuildFullDbS = 1.2;
constexpr double kDropReturnDb = 4.0;
constexpr double kDropAfterBuild = 0.5;
constexpr double kDropNearTopDb = 5.0;
constexpr double kDropGapMs = 8000.0;
constexpr double kMinRangeDb = 8.0;
constexpr double kUpMarginDb = 18.0;
constexpr double kDownMarginDb = 9.0;
constexpr double kMarginFadeMs = 30000.0;

double clamp01(double value) { return std::max(0.0, std::min(1.0, value)); }

double power_of(const Bands& bands, int from, int to) {
  double power = 0.0;
  for (int at = from; at <= to; ++at) {
    power += std::pow(
        10.0, (bands[static_cast<std::size_t>(at)] * 100.0 - 100.0) / 10.0);
  }
  return power / static_cast<double>(to - from + 1);
}

double to_db(double power) { return 10.0 * std::log10(std::max(1e-10, power)); }

double slope_of(const std::vector<double>& values) {
  const auto count = static_cast<double>(values.size());
  const double middle = (count - 1.0) / 2.0;
  double top = 0.0;
  double bottom = 0.0;
  double mean = 0.0;
  for (const double value : values) {
    mean += value / count;
  }
  for (std::size_t at = 0; at < values.size(); ++at) {
    const double from_middle = static_cast<double>(at) - middle;
    top += from_middle * (values[at] - mean);
    bottom += from_middle * from_middle;
  }
  return bottom > 0.0 ? top / bottom / (kBlockMs / 1000.0) : 0.0;
}

void keep(std::deque<double>& list, double value, double block_ms) {
  list.push_back(to_db(value / block_ms));
  if (list.size() > kBlocksKept) {
    list.pop_front();
  }
}

}  // namespace

void follow_section(SectionState& state, const Bands& bands, double step_ms,
                    bool audible, bool kicked) {
  const double power = power_of(bands, 0, kRhythmBandCount - 1);
  if (!state.started) {
    if (!audible) {
      return;
    }
    const double loudness = to_db(power);
    state.mid = loudness;
    state.floor = loudness;
    state.ceiling = loudness;
    state.started = true;
  }
  state.mid += (to_db(power) - state.mid) * ease_factor(step_ms, 1500.0);
  state.heard_ms += step_ms;
  const double inward = state.heard_ms < kWarmUpMs ? 2000.0 : 60000.0;
  state.ceiling += (state.mid - state.ceiling) *
                   ease_factor(step_ms, state.mid > state.ceiling ? 1000.0 : inward);
  state.floor += (state.mid - state.floor) *
                 ease_factor(step_ms, state.mid < state.floor ? 1000.0 : inward);
  state.block_upper +=
      power_of(bands, kUpperFromBand, kRhythmBandCount - 1) * step_ms;
  state.block_low += power_of(bands, 0, 6) * step_ms;
  state.block_all += power * step_ms;
  state.block_ms += step_ms;
  bool block_done = false;
  if (state.block_ms >= kBlockMs) {
    keep(state.blocks, state.block_upper, state.block_ms);
    keep(state.low_blocks, state.block_low, state.block_ms);
    keep(state.all_blocks, state.block_all, state.block_ms);
    state.block_upper = 0.0;
    state.block_low = 0.0;
    state.block_all = 0.0;
    state.block_ms = 0.0;
    block_done = true;
  }
  double building = 0.0;
  if (state.blocks.size() >= kBuildWindowBlocks) {
    const auto start = state.blocks.end() -
                       static_cast<std::ptrdiff_t>(kBuildWindowBlocks);
    const std::size_t half = kBuildWindowBlocks / 2;
    const std::vector<double> first(start,
                                    start + static_cast<std::ptrdiff_t>(half));
    const std::vector<double> second(start + static_cast<std::ptrdiff_t>(half),
                                     state.blocks.end());
    const double climb = std::min(slope_of(first), slope_of(second));
    building = clamp01((climb - kBuildSlopeDbS) / (kBuildFullDbS - kBuildSlopeDbS)) *
               (1.0 - state.drop);
  }
  state.build += (building - state.build) * ease_factor(step_ms, 400.0);
  state.build_memory = std::max(
      state.build, state.build_memory * std::pow(2.0, -step_ms / 2000.0));
  state.since_drop_ms += step_ms;
  const auto& lows = state.low_blocks;
  bool arriving = false;
  if (block_done && lows.size() >= 6) {
    // The four blocks before the last two: `lows.slice(-6, -2)`.
    double sum = 0.0;
    for (std::size_t at = lows.size() - 6; at < lows.size() - 2; ++at) {
      sum += std::pow(10.0, lows[at] / 10.0);
    }
    const double last_all =
        state.all_blocks.empty() ? -100.0 : state.all_blocks.back();
    arriving = lows.back() - to_db(sum / 4.0) > kDropReturnDb &&
               last_all > state.ceiling - kDropNearTopDb;
  }
  if (arriving && kicked && state.build_memory > kDropAfterBuild &&
      state.since_drop_ms > kDropGapMs) {
    state.drop = 1.0;
    state.drop_serial = js_mod(state.drop_serial + 1.0, 4096.0);
    state.since_drop_ms = 0.0;
    state.build_memory = 0.0;
  } else {
    state.drop *= std::pow(2.0, -step_ms / kDropHalfLifeMs);
  }
}

void quiet_section(SectionState& state, double quiet_ms, double keep_share) {
  state.build *= keep_share;
  state.drop *= std::pow(2.0, -quiet_ms / kDropHalfLifeMs);
}

double intensity_of(const SectionState& state) {
  if (!state.started) {
    return 0.0;
  }
  const double fade = std::exp(-state.heard_ms / kMarginFadeMs);
  const double ceiling = state.ceiling + kUpMarginDb * fade;
  const double lowest = state.floor - kDownMarginDb * fade;
  const double range = ceiling - lowest;
  const double floor = range >= kMinRangeDb
                           ? lowest
                           : (lowest + ceiling) / 2.0 - kMinRangeDb / 2.0;
  return clamp01((state.mid - floor) / std::max(kMinRangeDb, range));
}

}  // namespace feq::scene
