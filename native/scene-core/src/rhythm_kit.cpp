/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// `src/common/rhythmPattern.ts` and `src/common/rhythmKit.ts`: where in the
// bar each drum lands, and the kit that shows a drum only where one played.

#include <algorithm>
#include <cmath>
#include <limits>

#include "fluideq/scene/rhythm.h"

namespace feq::scene {
namespace {

constexpr double kSlotsPerBeat = 12.0;
constexpr double kMemoryBars = 6.0;
constexpr double kEvidenceBars = 2.0;
constexpr double kOffPatternBias = 1.8;
constexpr double kOnPatternBias = 0.8;
constexpr double kRegularShare = 0.5;
constexpr double kHeardLateMs = 18.0;
constexpr double kClearHit = 1.3;

constexpr std::array<double, 3> kHalfLifeMs{70.0, 60.0, 40.0};
constexpr std::array<HitRule, 3> kRules{{
    {4.0, 0.7, 120.0},
    {2.5, 0.8, 120.0},
    {2.0, 0.45, 60.0},
}};
/** The bands a kick and a snare are checked dying away in; none for a hat. */
constexpr std::array<std::array<int, 2>, 3> kCheckedBands{{
    {1, 7},
    {14, 21},
    {-1, -1},
}};
constexpr double kCheckAfterMs = 90.0;
constexpr double kPeakWithinMs = 20.0;
constexpr std::array<double, 3> kDiesAwayDb{2.0, 3.0, -1.0};
constexpr std::array<double, 3> kGivesBack{
    std::numeric_limits<double>::infinity(), 0.35,
    std::numeric_limits<double>::infinity()};
constexpr std::size_t kBeforeSteps = 3;
constexpr double kPresenceRate = 0.25;
constexpr double kPresenceStart = 0.35;
constexpr double kPresent = 0.5;

bool is_checked(std::size_t drum) { return kCheckedBands[drum][0] >= 0; }

double rate_at(const DrumPattern& pattern, std::size_t slot) {
  return (static_cast<double>(pattern.hits[slot]) +
          0.5 * (static_cast<double>(pattern.hits[(slot + 1) % kPatternSlots]) +
                 static_cast<double>(
                     pattern.hits[(slot + kPatternSlots - 1) % kPatternSlots]))) /
         pattern.bars;
}

double level_db(const Bands& bands, int from, int to) {
  double power = 0.0;
  for (int at = from; at <= to; ++at) {
    power += std::pow(
        10.0, (bands[static_cast<std::size_t>(at)] * 100.0 - 100.0) / 10.0);
  }
  return 10.0 * std::log10(
                    std::max(1e-12, power / static_cast<double>(to - from + 1)));
}

void follow_checks(KitDrum& drum, std::size_t name, double level,
                   double at_ms) {
  const double fall = kDiesAwayDb[name];
  if (fall < 0.0) {
    return;
  }
  std::vector<DrumCheck> kept;
  kept.reserve(drum.checks.size());
  for (DrumCheck check : drum.checks) {
    const double age = at_ms - check.at_ms;
    if (age <= kPeakWithinMs) {
      check.peak_db = std::max(check.peak_db, level);
    }
    if (age < kCheckAfterMs) {
      kept.push_back(check);
      continue;
    }
    const double fell = check.peak_db - level;
    const double gave_back =
        fell / std::max(0.5, check.peak_db - check.before_db);
    const double died_away =
        fell >= fall || gave_back >= kGivesBack[name] ? 1.0 : 0.0;
    drum.presence += (died_away - drum.presence) * kPresenceRate;
  }
  drum.checks = std::move(kept);
}

KitDrum new_kit_drum(std::size_t drum) {
  KitDrum kit_drum;
  kit_drum.presence = kDiesAwayDb[drum] < 0.0 ? 1.0 : kPresenceStart;
  return kit_drum;
}

}  // namespace

std::size_t slot_of(double beats, double phase, double tempo) {
  const double late = (kHeardLateMs * tempo) / 60000.0;
  const double in_bar =
      js_mod(js_mod(js_mod(beats, 4.0) + 4.0, 4.0) + phase - late + 4.0, 4.0);
  return static_cast<std::size_t>(
      js_mod(js_round(in_bar * kSlotsPerBeat), static_cast<double>(kPatternSlots)));
}

double pattern_bias(const DrumPattern& pattern, std::size_t slot) {
  if (pattern.bars < kEvidenceBars) {
    return 1.0;
  }
  double busiest = 0.0;
  for (std::size_t at = 0; at < kPatternSlots; ++at) {
    busiest = std::max(busiest, rate_at(pattern, at));
  }
  const double known =
      std::max(0.0, std::min(1.0, (busiest - 0.3) / 0.4)) *
      std::min(1.0, (pattern.bars - kEvidenceBars) / kEvidenceBars + 0.5);
  const double regular = std::min(1.0, rate_at(pattern, slot) / kRegularShare);
  const double bias =
      kOffPatternBias + (kOnPatternBias - kOffPatternBias) * regular;
  return 1.0 + (bias - 1.0) * known;
}

void learn_hit(DrumPattern& pattern, std::size_t slot, double stood_over) {
  pattern.hits[slot] = static_cast<float>(
      static_cast<double>(pattern.hits[slot]) +
      std::max(0.0, std::min(1.0, (stood_over - 1.0) / (kClearHit - 1.0))));
}

void follow_pattern(DrumPattern& pattern, double beats) {
  const double keep = std::pow(2.0, -beats / (4.0 * kMemoryBars));
  pattern.bars = pattern.bars * keep + beats / 4.0;
  for (float& hits : pattern.hits) {
    hits = static_cast<float>(static_cast<double>(hits) * keep);
  }
}

DrumKit create_drum_kit() {
  DrumKit kit;
  for (std::size_t drum = 0; drum < 3; ++drum) {
    kit.drums[drum] = new_kit_drum(drum);
  }
  return kit;
}

std::array<bool, 3> hear_kit(DrumKit& kit, const std::array<double, 3>& features,
                             const Bands& bands, double at_ms,
                             const std::optional<KitClock>& clock,
                             double step_ms) {
  const std::size_t slot =
      clock ? slot_of(clock->beats, clock->phase, clock->tempo) : 0;
  std::array<bool, 3> shown{};
  for (std::size_t name = 0; name < 3; ++name) {
    KitDrum& drum = kit.drums[name];
    const bool checked = is_checked(name);
    const double level =
        checked ? level_db(bands, kCheckedBands[name][0], kCheckedBands[name][1])
                : 0.0;
    follow_checks(drum, name, level, at_ms);
    const double stood_over =
        listen_for(drum.detector, features[name], step_ms, kRules[name],
                   clock ? pattern_bias(drum.pattern, slot) : 1.0);
    if (checked) {
      if (stood_over > 0.0) {
        drum.checks.push_back(
            {at_ms, drum.earlier_db.empty() ? level : drum.earlier_db.front(),
             level});
      }
      drum.earlier_db.push_back(level);
      if (drum.earlier_db.size() > kBeforeSteps) {
        drum.earlier_db.pop_front();
      }
    }
    drum.shown_since_ms += step_ms;
    shown[name] = stood_over > 0.0 && drum.presence >= kPresent;
    if (shown[name]) {
      drum.envelope = 1.0;
      drum.shown_since_ms = 0.0;
    } else {
      drum.envelope *= std::pow(2.0, -step_ms / kHalfLifeMs[name]);
    }
    if (clock) {
      if (shown[name]) {
        learn_hit(drum.pattern, slot, stood_over);
      }
      follow_pattern(drum.pattern, (step_ms * clock->tempo) / 60000.0);
    }
  }
  return shown;
}

void quiet_kit(DrumKit& kit, double quiet_ms) {
  for (std::size_t name = 0; name < 3; ++name) {
    KitDrum& drum = kit.drums[name];
    drum.envelope *= std::pow(2.0, -quiet_ms / kHalfLifeMs[name]);
    drum.checks.clear();
    drum.earlier_db.clear();
  }
}

void restart_kit(DrumKit& kit) {
  for (std::size_t name = 0; name < 3; ++name) {
    KitDrum& drum = kit.drums[name];
    drum.pattern = DrumPattern{};
    drum.presence = new_kit_drum(name).presence;
    drum.checks.clear();
    drum.earlier_db.clear();
  }
}

}  // namespace feq::scene
