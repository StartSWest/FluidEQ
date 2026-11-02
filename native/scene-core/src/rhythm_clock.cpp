/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// `src/common/rhythmClock.ts`: the beat clock, run from the tempo and pulled
// onto the beats it hears, and the bar it counts.

#include <algorithm>
#include <cmath>

#include "fluideq/scene/energy_levels.h"
#include "fluideq/scene/rhythm.h"

namespace feq::scene {
namespace {

constexpr double kTempoEveryMs = 250.0;
constexpr double kPhaseEveryMs = 100.0;
constexpr double kRelatedVotes = 12.0;
constexpr double kOtherVotes = 4.0;
constexpr double kSettleMs = 8000.0;
constexpr double kHeardOffsetMs = 4.0;
constexpr double kSteerMs = 300.0;
constexpr double kSteerMost = 0.2;

double around_beat(double value) { return value - js_round(value); }

std::vector<float> history_of(const OnsetRing& ring) {
  const std::size_t count = std::min(ring.held, kOssLength);
  std::vector<float> out(count);
  for (std::size_t at = 0; at < count; ++at) {
    out[at] = ring.values[(ring.at + kOssLength - count + at) % kOssLength];
  }
  return out;
}

template <typename Add>
void fill_hops(OnsetRing& ring, double step_ms, Add&& add) {
  double remaining = step_ms;
  while (remaining > 0.0) {
    const double take = std::min(remaining, ring.hop_left_ms);
    add(take);
    ring.hop_left_ms -= take;
    remaining -= take;
    if (ring.hop_left_ms <= 0.0) {
      ring.values[ring.at] = static_cast<float>(ring.hop_rise);
      ring.at = (ring.at + 1) % kOssLength;
      ring.held = std::min(kOssLength, ring.held + 1);
      ring.hop_rise = 0.0;
      ring.hop_left_ms = kOssHopMs;
    }
  }
}

void settle_tempo(RhythmClock& clock, double heard, double clarity) {
  if (clock.tempo == 0.0 || clock.fresh) {
    if (clarity > 0.15) {
      clock.tempo = heard;
      clock.fresh = false;
      clock.aligned = false;
      clock.candidate_votes = 0.0;
      clock.held_ms = 0.0;
    }
    return;
  }
  const double ratio = heard / clock.tempo;
  if (std::abs(ratio - 1.0) < 0.04) {
    clock.tempo += (heard - clock.tempo) * 0.35;
    clock.candidate_votes = 0.0;
    return;
  }
  if (std::abs(heard / clock.candidate - 1.0) < 0.04) {
    clock.candidate_votes += 1.0;
  } else {
    clock.candidate = heard;
    clock.candidate_votes = 1.0;
  }
  const bool on_trial = clock.held_ms < kSettleMs;
  const double needed =
      is_related(ratio) && !on_trial ? kRelatedVotes : kOtherVotes;
  if (clock.candidate_votes >= needed) {
    clock.tempo = heard;
    clock.candidate_votes = 0.0;
    clock.held_ms = 0.0;
  }
}

void follow_tempo(RhythmClock& clock) {
  const double lean_on = clock.held_ms >= kSettleMs ? clock.tempo : 0.0;
  const auto heard = estimate_tempo(history_of(clock.tempo_onsets), lean_on);
  if (heard) {
    settle_tempo(clock, heard->tempo, heard->clarity);
  }
  double agreement = 0.0;
  if (heard && clock.tempo > 0.0) {
    const double ratio = heard->tempo / clock.tempo;
    if (std::abs(ratio - 1.0) < 0.04) {
      agreement = 1.0;
    } else if (is_related(ratio)) {
      agreement = 0.6;
    }
  }
  clock.tempo_clarity = heard ? heard->clarity : 0.0;
  clock.tempo_agreement = agreement;
}

void shift_phase(RhythmClock& clock, double by) {
  clock.phase += by;
  while (clock.phase < 0.0) {
    clock.phase += 1.0;
    clock.beats -= 1.0;
  }
  while (clock.phase >= 1.0) {
    clock.phase -= 1.0;
    clock.beats += 1.0;
  }
}

void aim_clock(RhythmClock& clock) {
  const double period_ms = 60000.0 / clock.tempo;
  const double period = period_ms / kOssHopMs;
  const OnsetRing& ring = clock.beat_onsets;
  const double newest_ms = kOssHopMs - ring.hop_left_ms + kOssHopMs / 2.0;
  std::optional<double> keep;
  if (clock.aligned) {
    keep = js_mod(js_mod((clock.phase * period_ms - newest_ms - kHeardOffsetMs) /
                             kOssHopMs,
                         period) +
                      period,
                  period);
  }
  const auto found = estimate_phase(history_of(ring), period, keep);
  if (!found) {
    return;
  }
  const double since_beat_ms =
      newest_ms + found->back * kOssHopMs + kHeardOffsetMs;
  clock.target = js_mod(since_beat_ms / period_ms, 1.0);
  clock.target_age_ms = 0.0;
  clock.has_target = true;
  clock.phase_clarity = found->clarity;
}

void run_clock(RhythmClock& clock, double step_ms) {
  if (clock.tempo <= 0.0) {
    return;
  }
  const double period_ms = 60000.0 / clock.tempo;
  shift_phase(clock, step_ms / period_ms);
  clock.target_age_ms += step_ms;
  if (!clock.has_target) {
    return;
  }
  const double error =
      around_beat(clock.target + clock.target_age_ms / period_ms - clock.phase);
  if (!clock.aligned || clock.confidence < 0.2) {
    shift_phase(clock, error);
    clock.aligned = true;
    return;
  }
  const double most = (kSteerMost * step_ms) / period_ms;
  shift_phase(clock, std::max(-most, std::min(most, error * ease_factor(
                                                            step_ms, kSteerMs))));
}

void count_bar(RhythmClock& clock, double weight, bool was_early) {
  if (clock.phase < 0.25 || clock.phase >= 0.85) {
    clock.beat_weight = std::max(clock.beat_weight, weight);
    return;
  }
  if (was_early) {
    const auto slot =
        static_cast<std::size_t>(js_mod(js_mod(clock.beats, 4.0) + 4.0, 4.0));
    clock.slots[slot] = clock.slots[slot] * 0.85 + clock.beat_weight * 0.15;
    clock.beat_weight = 0.0;
    const auto heaviest = static_cast<std::size_t>(
        std::max_element(clock.slots.begin(), clock.slots.end()) -
        clock.slots.begin());
    if (heaviest != clock.down_slot &&
        clock.slots[heaviest] > clock.slots[clock.down_slot] * 1.25 + 0.01) {
      clock.down_slot = heaviest;
    }
  }
}

}  // namespace

void restart_clock(RhythmClock& clock) {
  clock.tempo_onsets.held = 0;
  clock.beat_onsets.held = 0;
  clock.fresh = true;
  clock.has_target = false;
  clock.aligned = false;
}

void keep_onset(OnsetRing& ring, double strength, double step_ms) {
  fill_hops(ring, step_ms, [&](double take) {
    ring.hop_rise += (strength * take) / step_ms;
  });
}

void hold_onset(OnsetRing& ring, double strength, double step_ms) {
  fill_hops(ring, step_ms, [&](double) {
    ring.hop_rise = std::max(ring.hop_rise, strength);
  });
}

void follow_clock(RhythmClock& clock, double step_ms, double bar_weight) {
  if (clock.tempo > 0.0) {
    clock.held_ms += step_ms;
  }
  clock.since_tempo_ms += step_ms;
  if (clock.since_tempo_ms >= kTempoEveryMs) {
    clock.since_tempo_ms = 0.0;
    follow_tempo(clock);
  }
  clock.since_phase_ms += step_ms;
  if (clock.since_phase_ms >= kPhaseEveryMs && clock.tempo > 0.0) {
    clock.since_phase_ms = 0.0;
    aim_clock(clock);
  }
  const double sure = clock.tempo_clarity * clock.tempo_agreement *
                      (0.4 + 0.6 * (clock.has_target ? clock.phase_clarity : 0.0));
  clock.confidence +=
      (sure - clock.confidence) * ease_factor(step_ms, 1000.0);
  const bool was_early = clock.phase < 0.25;
  run_clock(clock, step_ms);
  count_bar(clock, bar_weight, was_early);
}

}  // namespace feq::scene
