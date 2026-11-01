/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Footsteps' decisions, every quarter millisecond: what each band's lift and
 * the rumble's cut go to, from what the followers heard (`footsteps.cpp`
 * keeps the followers and plays the gains a sample at a time).
 */
#include <algorithm>
#include <cmath>

#include "footsteps_internal.h"

namespace feq_footsteps_detail {
namespace {

/**
 * Everything is judged against the programme: how loud the mix has been over
 * the last few seconds (the whole signal's level, rising over two seconds
 * and falling over four). The first version judged against fixed levels —
 * lift toward -24 dB, nothing while the mix was over -22 dBFS — and a game,
 * or a video of one, sits over -22 dBFS most of the time: on real matches of
 * six games a distant step's band came up 0.4 dB on average (2026-11-01,
 * recorded from the browser, replayed through this stage). A band is lifted
 * toward the programme's level and never past it, nor ever toward less than
 * -24 dB, so a quiet scene keeps the lift the old target gave it.
 */
constexpr double kTargetOverProgrammeDb = 0.0;
constexpr double kTargetFloorDb = -24.0;
/** An upward ratio of 2.5: a step 20 dB under the target comes up 12 dB. */
constexpr double kSlope = 1.0 - 1.0 / 2.5;
/**
 * A loud event is the whole signal over the programme by this much AND loud
 * in itself: a shot or a blast stands out of the mix around it, and nothing
 * is lifted then. Standing out alone is not enough — in a quiet scene the
 * step itself stands 15 dB over the programme, and judged by that alone not
 * one step of the synthetic match was lifted.
 */
constexpr double kLoudFromDb = 3.0;
constexpr double kLoudToDb = 9.0;
constexpr double kLoudLevelFromDb = -30.0;
constexpr double kLoudLevelToDb = -20.0;
/**
 * The rumble is cut where it stands over the programme by this much: a blast
 * jumps out of the mix, a bass-heavy game does not, and a fixed -16 dB held
 * the bass of every loud mix down all the time.
 */
constexpr double kCalmOverProgrammeDb = 3.0;
constexpr double kCalmSlope = 2.0 / 3.0;
constexpr double kCalmMaxDb = 9.0;

double db_of(double power) { return 10.0 * std::log10(power + 1e-24); }

double gain_of(double db) {
  return std::exp(db * (2.302585092994046 / 20.0));
}

double smoothstep(double low, double high, double value) {
  const double t = std::clamp((value - low) / (high - low), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

/**
 * A gain's walk over the next decision's samples, toward `db`. At unity and
 * already there but for rounding, it is set to exactly one, so the stage at
 * rest adds exactly nothing.
 */
void glide(double& gain, double& per_sample, double db, double samples) {
  if (db == 0.0 && std::fabs(gain - 1.0) < 1e-9) {
    gain = 1.0;
    per_sample = 0.0;
    return;
  }
  per_sample = (gain_of(db) - gain) / samples;
}

}  // namespace

void decide(FeqFootsteps& f, bool enabled, double lift, double calm) {
  State& s = f.state;
  const double step = static_cast<double>(f.control_step);
  const double whole_db = db_of(s.whole_power);
  // Silence teaches nothing: a bed or a programme learnt from a paused
  // video sat at -240 dB, and everything after the pause stood over it.
  const bool sounding = whole_db > kSilenceDb;
  if (sounding) {
    s.heard = std::min(f.learn_frames, s.heard + f.control_step);
  }
  const bool learning = s.heard < f.learn_frames;
  if (sounding) {
    const double rate = learning                    ? f.a_bed_learn
                        : whole_db > s.programme_db ? f.a_programme_rise
                                                    : f.a_programme_fall;
    s.programme_db += rate * (whole_db - s.programme_db);
  }
  const double programme = s.programme_db;
  const double target_db =
      std::max(programme + kTargetOverProgrammeDb, kTargetFloorDb);
  s.target_power = std::pow(10.0, target_db / 10.0);
  const double quiet_around =
      1.0 - smoothstep(programme + kLoudFromDb, programme + kLoudToDb, whole_db) *
                smoothstep(kLoudLevelFromDb, kLoudLevelToDb, whole_db);
  const double lift_amount = enabled && !learning ? lift : 0.0;
  FeqFootstepsReport& report = f.report;
  report.level_db = std::max(report.level_db, static_cast<float>(whole_db));

  for (int b = 0; b < FEQ_FOOTSTEPS_BANDS; ++b) {
    const double inst = db_of(s.band_power[b]);
    double& level = s.band_level[b];
    level += (inst > level ? f.a_level_attack : f.a_level_release) *
             (inst - level);
    s.band_slow[b] += f.a_slow * (level - s.band_slow[b]);
    // The band itself sounding too: the whole signal's follower outlasts a
    // band's by tens of milliseconds into a pause, and in that gap the bed
    // used to follow the band down to -240 dB.
    if (sounding && level > kSilenceDb) {
      const double rise = learning ? f.a_bed_learn : f.a_bed_rise;
      s.band_bed[b] += (level > s.band_bed[b] ? rise : f.a_bed_fall) *
                       (level - s.band_bed[b]);
    }
    // Arriving over its own recent past AND over the bed: sound coming back
    // after a pause, at the level the bed already knows, arrives from
    // nothing over the first and from nothing over the second.
    const double arrival =
        smoothstep(1.0, 4.0, level - std::max(s.band_slow[b], s.band_bed[b]));
    if (arrival >= s.arrival_held[b]) {
      s.arrival_held[b] = arrival;
      s.hold_left[b] = f.hold_decisions;
    } else if (s.hold_left[b] > 0) {
      --s.hold_left[b];
    } else {
      s.arrival_held[b] = arrival;
    }
    double want =
        std::clamp((target_db - level) * kSlope, 0.0, kBands[b].max_db) *
        s.arrival_held[b] * smoothstep(2.0, 6.0, level - s.band_bed[b]) *
        smoothstep(-80.0, -68.0, level) * quiet_around * lift_amount;
    if (want < kSettledDb) want = 0.0;
    double& gain_db = s.band_gain_db[b];
    gain_db += (want > gain_db ? f.a_gain_attack : f.a_gain_release) *
               (want - gain_db);
    // The ceiling as it stands now, so the glide never aims past it and the
    // reported lift is the one applied; the per-sample ceiling in the loop
    // catches what arrives between decisions.
    gain_db = std::min(gain_db, std::max(0.0, target_db - db_of(s.lift_power[b])));
    if (want == 0.0 && gain_db < kSettledDb) gain_db = 0.0;
    glide(s.band_gain[b], s.band_step[b], gain_db, step);
    report.lift_db[b] = std::max(report.lift_db[b], static_cast<float>(gain_db));
  }
  report.cue_db =
      std::max(report.cue_db, static_cast<float>(s.band_level[kStepsBand]));
  report.bed_db = static_cast<float>(s.band_bed[kStepsBand]);

  const double calm_inst = db_of(s.calm_power);
  s.calm_level += (calm_inst > s.calm_level ? f.a_calm_level_attack
                                            : f.a_calm_level_release) *
                  (calm_inst - s.calm_level);
  double cut_want =
      std::clamp((s.calm_level - (programme + kCalmOverProgrammeDb)) * kCalmSlope,
                 0.0, kCalmMaxDb) *
      (enabled && !learning ? calm : 0.0);
  if (cut_want < kSettledDb) cut_want = 0.0;
  s.calm_cut_db += (cut_want > s.calm_cut_db ? f.a_cut_attack : f.a_cut_release) *
                   (cut_want - s.calm_cut_db);
  if (cut_want == 0.0 && s.calm_cut_db < kSettledDb) s.calm_cut_db = 0.0;
  glide(s.calm_gain, s.calm_step, -s.calm_cut_db, step);
  report.calm_db = std::min(report.calm_db, static_cast<float>(-s.calm_cut_db));
}

}  // namespace feq_footsteps_detail
