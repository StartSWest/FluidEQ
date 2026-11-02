/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/scene/energy_levels.h"

#include <algorithm>
#include <cmath>
#include <limits>

namespace feq::scene {
namespace {

constexpr double kBassFromHz = 30.0;
constexpr double kBassToHz = 115.0;
constexpr double kMidFromHz = 200.0;
constexpr double kMidToHz = 4500.0;
constexpr double kTrebleFromHz = 5000.0;
constexpr double kTrebleToHz = 16000.0;
/** Hops the mid's median is taken over. */
constexpr std::size_t kMidHistory = 9;
constexpr double kLevelWindowDb = 24.0;
constexpr double kCeilingReleaseDbS = 4.0;
constexpr double kUsualReads = 0.55;
constexpr double kPartSwingDb = 10.0;
constexpr double kUsualRiseMs = 700.0;
constexpr double kUsualFallMs = 1400.0;
/** Per part: how far under the ceiling it is absent, and fully present. */
constexpr std::array<std::array<double, 2>, 3> kPresenceDb{{
    {25.0, 15.0},
    {40.0, 30.0},
    {40.0, 30.0},
}};
constexpr double kLevelFloorDb = -90.0;
constexpr double kLevelReleaseMs = 120.0;
constexpr std::array<double, 3> kPartReleaseMs{90.0, 150.0, 50.0};

double power_of(float db) {
  return db <= kNothingDb ? 0.0 : std::pow(10.0, static_cast<double>(db) / 10.0);
}

/** Sum of power over the bins from `from_hz` up to under `to_hz`. */
double part_power(const std::vector<float>& bins, double bin_hz,
                  double from_hz, double to_hz) {
  double power = 0.0;
  const auto first =
      static_cast<std::ptrdiff_t>(std::max(1.0, std::ceil(from_hz / bin_hz)));
  const auto last = std::min(static_cast<std::ptrdiff_t>(bins.size()) - 1,
                             static_cast<std::ptrdiff_t>(
                                 std::ceil(to_hz / bin_hz)) -
                                 1);
  for (std::ptrdiff_t bin = first; bin <= last; ++bin) {
    power += power_of(bins[static_cast<std::size_t>(bin)]);
  }
  return power;
}

double bass_power(const std::vector<float>& bins, double bin_hz) {
  double power = 0.0;
  const auto last = std::min(static_cast<std::ptrdiff_t>(bins.size()) - 1,
                             static_cast<std::ptrdiff_t>(
                                 std::ceil(kMidFromHz / bin_hz)) -
                                 1);
  for (std::ptrdiff_t bin = 1; bin <= last; ++bin) {
    if (is_bass_bin(bins, bin_hz, static_cast<std::size_t>(bin))) {
      power += power_of(bins[static_cast<std::size_t>(bin)]);
    }
  }
  return power;
}

/** The median of the mid's bins over the last few hops, summed. */
double lasting_power(LevelState& state, const std::vector<float>& powers) {
  if (state.mid_history.size() != powers.size() * kMidHistory) {
    state.mid_history.assign(powers.size() * kMidHistory, 0.0F);
    state.mid_at = 0;
  }
  std::array<float, kMidHistory> scratch{};
  double total = 0.0;
  for (std::size_t bin = 0; bin < powers.size(); ++bin) {
    const std::size_t base = bin * kMidHistory;
    state.mid_history[base + state.mid_at] = powers[bin];
    std::copy_n(state.mid_history.begin() + static_cast<std::ptrdiff_t>(base),
                kMidHistory, scratch.begin());
    std::sort(scratch.begin(), scratch.end());
    total += static_cast<double>(scratch[kMidHistory / 2]);
  }
  state.mid_at = (state.mid_at + 1) % kMidHistory;
  return total;
}

std::vector<float> mid_powers_of(const SoundHop& hop) {
  const auto first =
      static_cast<std::ptrdiff_t>(std::ceil(kMidFromHz / hop.high_bin_hz));
  const auto last = std::min(static_cast<std::ptrdiff_t>(hop.high.size()) - 1,
                             static_cast<std::ptrdiff_t>(
                                 std::ceil(kMidToHz / hop.high_bin_hz)) -
                                 1);
  std::vector<float> powers(
      static_cast<std::size_t>(std::max<std::ptrdiff_t>(0, last - first + 1)));
  for (std::ptrdiff_t bin = first; bin <= last; ++bin) {
    powers[static_cast<std::size_t>(bin - first)] = static_cast<float>(
        power_of(hop.high[static_cast<std::size_t>(bin)]));
  }
  return powers;
}

double clamp01(double value) { return std::max(0.0, std::min(1.0, value)); }

double db_of(double power) { return 10.0 * std::log10(std::max(1e-12, power)); }

/** Rises at once, falls by the part's release. */
void settle(double& now, double target, double step_ms, double release_ms) {
  now = target >= now ? target
                      : now + (target - now) * ease_factor(step_ms, release_ms);
}

void follow_whole(LevelState& state, double power, double step_ms) {
  const double db = db_of(power);
  const double ceiling = std::max(
      {kLevelFloorDb, db,
       state.ceiling.has_value()
           ? *state.ceiling - (kCeilingReleaseDbS * step_ms) / 1000.0
           : db});
  state.ceiling = ceiling;
  settle(state.level,
         clamp01((db - ceiling + kLevelWindowDb) / kLevelWindowDb), step_ms,
         kLevelReleaseMs);
}

double& part_value(LevelState& state, LevelPart part) {
  switch (part) {
    case LevelPart::kBass:
      return state.bass;
    case LevelPart::kMid:
      return state.mid;
    case LevelPart::kTreble:
      break;
  }
  return state.treble;
}

void follow_part(LevelState& state, LevelPart part, double power,
                 double step_ms) {
  const auto index = static_cast<std::size_t>(part);
  const double db = db_of(power);
  const double absent_db = kPresenceDb[index][0];
  const double full_db = kPresenceDb[index][1];
  const double present =
      power > 0.0
          ? clamp01((db - (state.ceiling.value_or(kLevelFloorDb) - absent_db)) /
                    (absent_db - full_db))
          : 0.0;
  const std::optional<double> previous = state.usual[index];
  double& value = part_value(state, part);
  if (!previous.has_value() && present < 0.5) {
    settle(value, 0.0, step_ms, kPartReleaseMs[index]);
    return;
  }
  double usual = previous.value_or(db);
  if (previous.has_value() && present > 0.0) {
    usual += (db - *previous) *
             ease_factor(step_ms, db > *previous ? kUsualRiseMs : kUsualFallMs);
  }
  state.usual[index] = usual;
  const double target =
      clamp01(kUsualReads + ((db - usual) * (1.0 - kUsualReads)) / kPartSwingDb);
  settle(value, target * present, step_ms, kPartReleaseMs[index]);
}

std::size_t peak_of(const std::vector<float>& bins, std::size_t bin) {
  std::size_t at = bin;
  const float lowest = -std::numeric_limits<float>::infinity();
  for (;;) {
    const float left = at > 0 ? bins[at - 1] : lowest;
    const float right = at < bins.size() - 1 ? bins[at + 1] : lowest;
    if (right > bins[at] && right >= left) {
      ++at;
    } else if (left > bins[at]) {
      --at;
    } else {
      return at;
    }
  }
}

double note_of(const std::vector<float>& bins, std::size_t peak) {
  if (peak == 0 || peak >= bins.size() - 1) {
    return static_cast<double>(peak);
  }
  const double left = bins[peak - 1];
  const double right = bins[peak + 1];
  const double curve = left - 2.0 * static_cast<double>(bins[peak]) + right;
  return curve < 0.0 ? static_cast<double>(peak) + (0.5 * (left - right)) / curve
                     : static_cast<double>(peak);
}

}  // namespace

double ease_factor(double delta_ms, double half_life_ms) {
  if (half_life_ms <= 0.0) {
    return 1.0;
  }
  const double elapsed = std::max(0.0, std::min(delta_ms, half_life_ms * 8.0));
  return 1.0 - std::pow(2.0, -elapsed / half_life_ms);
}

bool is_bass_bin(const std::vector<float>& bins, double bin_hz,
                 std::size_t bin) {
  const double hz = note_of(bins, peak_of(bins, bin)) * bin_hz;
  return hz >= kBassFromHz && hz <= kBassToHz;
}

void follow_levels(LevelState& state, const SoundHop& hop, double step_ms) {
  const double bass = bass_power(hop.low, hop.low_bin_hz);
  const double mid = lasting_power(state, mid_powers_of(hop));
  const double treble =
      part_power(hop.high, hop.high_bin_hz, kTrebleFromHz, kTrebleToHz);
  const double all =
      part_power(hop.low, hop.low_bin_hz, kBassFromHz, kMidFromHz) +
      part_power(hop.high, hop.high_bin_hz, kMidFromHz, kTrebleToHz);
  follow_whole(state, all, step_ms);
  follow_part(state, LevelPart::kBass, bass, step_ms);
  follow_part(state, LevelPart::kMid, mid, step_ms);
  follow_part(state, LevelPart::kTreble, treble, step_ms);
}

}  // namespace feq::scene
