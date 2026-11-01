/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/footsteps.h"

#include <algorithm>
#include <atomic>
#include <cmath>
#include <new>

namespace {

constexpr double kPi = 3.14159265358979323846;
constexpr double kFloorDb = -120.0;

struct BandDesign {
  double hz;
  double q;
  /** The most this band is ever lifted, dB, at a Lift of one. */
  double max_db;
};

/**
 * Weight, steps and detail. Footsteps have no one frequency — a boot on
 * gravel and on wood share little — so the middle band is nearly two octaves
 * wide (1.3 to 4.5 kHz at its -3 dB points), where the scuff, the crunch and
 * a reload all are, and the other two are smaller: the weight of a step tells
 * distance, the detail band carries the pinna's 6-9 kHz notch, which a bell
 * this wide scales without filling.
 */
constexpr BandDesign kBands[FEQ_FOOTSTEPS_BANDS] = {
    {300.0, 1.0, 4.0},
    {2400.0, 0.75, 10.0},
    {7000.0, 0.9, 6.0},
};
constexpr int kStepsBand = 1;

/** A band is lifted toward this level and never past it. */
constexpr double kTargetDb = -24.0;
/** An upward ratio of 2.5: a step 20 dB under the target comes up 12 dB. */
constexpr double kSlope = 1.0 - 1.0 / 2.5;

/**
 * The band's power follower: half a millisecond to catch a step's front, and
 * ten to let go — at least three cycles of the weight band, which would
 * otherwise read its own carrier as a string of onsets.
 */
constexpr double kPowerAttackMs = 0.5;
constexpr double kPowerReleaseMs = 10.0;
/**
 * The level the decisions read. Five milliseconds of attack is what keeps a
 * raindrop from being a step: a 2 ms click reaches a third of its height.
 */
constexpr double kLevelAttackMs = 5.0;
constexpr double kLevelReleaseMs = 25.0;
/** What "arriving" is measured against: the level, 30 ms behind. */
constexpr double kSlowMs = 30.0;
/**
 * The bed rises slowly and falls quickly, so it sits on the troughs of rain
 * and wind and a step barely moves it (an 80 ms step 15 dB up lifts it 2 dB).
 * For the first 0.4 s of sound it is learnt quickly and nothing is lifted:
 * before the bed exists, everything stands above it.
 */
constexpr double kBedRiseMs = 600.0;
constexpr double kBedFallMs = 120.0;
constexpr double kBedLearnMs = 60.0;
constexpr double kLearnSeconds = 0.4;
/** A lift starts within two milliseconds and lets go over seventy. */
constexpr double kGainAttackMs = 2.0;
constexpr double kGainReleaseMs = 70.0;
/** The whole signal, for "is anything around it loud". */
constexpr double kWholeReleaseMs = 60.0;
/** Quieter than this, it is silence: no bed is learnt from it. */
constexpr double kSilenceDb = -80.0;

/** The rumble Calm listens to and turns down. */
constexpr double kCalmCornerHz = 250.0;
constexpr double kCalmPowerReleaseMs = 30.0;
constexpr double kCalmLevelAttackMs = 3.0;
constexpr double kCalmLevelReleaseMs = 40.0;
constexpr double kCalmTargetDb = -16.0;
constexpr double kCalmSlope = 2.0 / 3.0;
constexpr double kCalmMaxDb = 9.0;
constexpr double kCutAttackMs = 2.0;
/** "Let go within a tenth of a second." */
constexpr double kCutReleaseMs = 110.0;

/**
 * How often the decisions are taken: every quarter millisecond. The power
 * followers and the gains run per sample; the logarithms and the curves
 * between them do not need to, and at 384 kHz five logarithms a sample would
 * be most of the stage's cost.
 */
constexpr double kControlHz = 4000.0;
/**
 * A lift or a cut this small, in dB, is taken the rest of the way to unity
 * in a straight line over one decision, so the stage returns to the input to
 * the bit rather than approaching it for ever; and asked for, it is not asked
 * for at all. A hundredth of a decibel on the band moves it by 0.1%: under a
 * band at -30 dBFS, a step there would sit 90 dB down, and there is none.
 */
constexpr double kSettledDb = 0.01;

double db_of(double power) { return 10.0 * std::log10(power + 1e-24); }

double gain_of(double db) {
  return std::exp(db * (2.302585092994046 / 20.0));
}

double smoothstep(double low, double high, double value) {
  const double t = std::clamp((value - low) / (high - low), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

double pole(double rate, double ms) {
  return 1.0 - std::exp(-1.0 / (ms * 0.001 * rate));
}

/**
 * A band-pass with a peak of exactly 0 dB (RBJ's constant-peak form), so
 * `x + (g - 1) * bandpass(x)` is a bell of gain `g` at its centre. Its b1 is
 * zero and its b2 is minus its b0.
 */
struct BandPass {
  double b0 = 0.0;
  double a1 = 0.0;
  double a2 = 0.0;
};

BandPass design_band(double rate, double hz, double q) {
  const double w = 2.0 * kPi * std::min(hz, 0.45 * rate) / rate;
  const double alpha = std::sin(w) / (2.0 * q);
  const double a0 = 1.0 + alpha;
  return {alpha / a0, -2.0 * std::cos(w) / a0, (1.0 - alpha) / a0};
}

struct History {
  double z1 = 0.0;
  double z2 = 0.0;
};

double run_band(const BandPass& k, History& h, double x) {
  const double y = k.b0 * x + h.z1;
  h.z1 = -k.a1 * y + h.z2;
  h.z2 = -k.b0 * x - k.a2 * y;
  return y;
}

/** Everything that runs with the sound, and moves to a prepared chain. */
struct State {
  bool running = false;
  /** Samples left before the next decision. */
  uint32_t until_control = 0;
  /** Samples of sound heard since the bed began, up to the learning time. */
  uint32_t heard = 0;
  History band_history[FEQ_FOOTSTEPS_BANDS][FEQ_FOOTSTEPS_MAX_CHANNELS];
  double shelf_x1[FEQ_FOOTSTEPS_MAX_CHANNELS] = {};
  double shelf_y1[FEQ_FOOTSTEPS_MAX_CHANNELS] = {};
  double band_power[FEQ_FOOTSTEPS_BANDS] = {};
  double band_level[FEQ_FOOTSTEPS_BANDS] = {kFloorDb, kFloorDb, kFloorDb};
  double band_slow[FEQ_FOOTSTEPS_BANDS] = {kFloorDb, kFloorDb, kFloorDb};
  double band_bed[FEQ_FOOTSTEPS_BANDS] = {kFloorDb, kFloorDb, kFloorDb};
  double band_gain_db[FEQ_FOOTSTEPS_BANDS] = {};
  /** Linear gains, stepped a sample at a time toward each decision. */
  double band_gain[FEQ_FOOTSTEPS_BANDS] = {1.0, 1.0, 1.0};
  double band_step[FEQ_FOOTSTEPS_BANDS] = {};
  double whole_power = 0.0;
  double calm_power = 0.0;
  double calm_level = kFloorDb;
  double calm_cut_db = 0.0;
  double calm_gain = 1.0;
  double calm_step = 0.0;
};

}  // namespace

struct FeqFootsteps {
  double sample_rate = 48000.0;
  uint32_t channels = 2;
  uint32_t control_step = 12;
  uint32_t learn_frames = 19200;
  double target_power = 0.0;

  std::atomic<int> enabled{0};
  std::atomic<int> isolate{0};
  std::atomic<double> lift{0.0};
  std::atomic<double> calm{0.0};
  std::atomic<int> lfe{-1};

  BandPass band[FEQ_FOOTSTEPS_BANDS];
  double shelf_c = 0.0;
  // Per sample.
  double a_power_attack = 0.0;
  double a_power_release = 0.0;
  double a_whole_release = 0.0;
  double a_calm_power_release = 0.0;
  // Per decision.
  double a_level_attack = 0.0;
  double a_level_release = 0.0;
  double a_slow = 0.0;
  double a_bed_rise = 0.0;
  double a_bed_fall = 0.0;
  double a_bed_learn = 0.0;
  double a_gain_attack = 0.0;
  double a_gain_release = 0.0;
  double a_calm_level_attack = 0.0;
  double a_calm_level_release = 0.0;
  double a_cut_attack = 0.0;
  double a_cut_release = 0.0;

  State state;
  FeqFootstepsReport report{};
};

namespace {

void clear_report(FeqFootstepsReport& report) {
  report = FeqFootstepsReport{};
  report.level_db = static_cast<float>(kFloorDb);
  report.cue_db = static_cast<float>(kFloorDb);
  report.bed_db = static_cast<float>(kFloorDb);
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

/**
 * One decision: where each band's lift and the rumble's cut are going over
 * the next control step, given everything the followers heard up to now.
 */
void decide(FeqFootsteps& f, bool enabled, double lift, double calm) {
  State& s = f.state;
  const double step = static_cast<double>(f.control_step);
  const double whole_db = db_of(s.whole_power);
  if (whole_db > kSilenceDb) {
    s.heard = std::min(f.learn_frames, s.heard + f.control_step);
  }
  const bool learning = s.heard < f.learn_frames;
  const double quiet_around = 1.0 - smoothstep(-22.0, -12.0, whole_db);
  const double lift_amount = enabled && !learning ? lift : 0.0;
  FeqFootstepsReport& report = f.report;
  report.level_db = std::max(report.level_db, static_cast<float>(whole_db));

  for (int b = 0; b < FEQ_FOOTSTEPS_BANDS; ++b) {
    const double inst = db_of(s.band_power[b]);
    double& level = s.band_level[b];
    level += (inst > level ? f.a_level_attack : f.a_level_release) *
             (inst - level);
    s.band_slow[b] += f.a_slow * (level - s.band_slow[b]);
    const double rise = learning ? f.a_bed_learn : f.a_bed_rise;
    s.band_bed[b] += (level > s.band_bed[b] ? rise : f.a_bed_fall) *
                     (level - s.band_bed[b]);
    double want =
        std::clamp((kTargetDb - level) * kSlope, 0.0, kBands[b].max_db) *
        smoothstep(3.0, 8.0, level - s.band_bed[b]) *
        smoothstep(1.0, 4.0, level - s.band_slow[b]) *
        smoothstep(-80.0, -68.0, level) * quiet_around * lift_amount;
    if (want < kSettledDb) want = 0.0;
    double& gain_db = s.band_gain_db[b];
    gain_db += (want > gain_db ? f.a_gain_attack : f.a_gain_release) *
               (want - gain_db);
    // The ceiling as it stands now, so the glide never aims past it and the
    // reported lift is the one applied; the per-sample ceiling in the loop
    // catches what arrives between decisions.
    gain_db = std::min(gain_db, std::max(0.0, kTargetDb - inst));
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
      std::clamp((s.calm_level - kCalmTargetDb) * kCalmSlope, 0.0, kCalmMaxDb) *
      (enabled ? calm : 0.0);
  if (cut_want < kSettledDb) cut_want = 0.0;
  s.calm_cut_db += (cut_want > s.calm_cut_db ? f.a_cut_attack : f.a_cut_release) *
                   (cut_want - s.calm_cut_db);
  if (cut_want == 0.0 && s.calm_cut_db < kSettledDb) s.calm_cut_db = 0.0;
  glide(s.calm_gain, s.calm_step, -s.calm_cut_db, step);
  report.calm_db = std::min(report.calm_db, static_cast<float>(-s.calm_cut_db));
}

/**
 * Switched off and every gain at unity, the last step to it taken: nothing
 * left to do. The linear gains have walked one decision's worth of steps to
 * unity, so what is left of them is rounding.
 */
bool settled(const State& s) {
  for (int b = 0; b < FEQ_FOOTSTEPS_BANDS; ++b) {
    if (s.band_gain_db[b] != 0.0 || s.band_gain[b] != 1.0) return false;
  }
  return s.calm_cut_db == 0.0 && s.calm_gain == 1.0;
}

}  // namespace

extern "C" {

void feq_footsteps_settings_defaults(FeqFootstepsSettings* settings) {
  if (settings == nullptr) return;
  *settings = FeqFootstepsSettings{};
  settings->lift = 0.85;
  settings->calm = 0.5;
}

FeqFootsteps* feq_footsteps_create(double sample_rate, uint32_t channels) {
  if (!(sample_rate > 0.0) || channels == 0 ||
      channels > FEQ_FOOTSTEPS_MAX_CHANNELS) {
    return nullptr;
  }
  auto* f = new (std::nothrow) FeqFootsteps();
  if (f == nullptr) return nullptr;
  f->sample_rate = sample_rate;
  f->channels = channels;
  f->control_step = std::max<uint32_t>(
      1u, static_cast<uint32_t>(std::lround(sample_rate / kControlHz)));
  f->learn_frames = static_cast<uint32_t>(std::lround(kLearnSeconds * sample_rate));
  f->target_power = std::pow(10.0, kTargetDb / 10.0);
  for (int b = 0; b < FEQ_FOOTSTEPS_BANDS; ++b) {
    f->band[b] = design_band(sample_rate, kBands[b].hz, kBands[b].q);
  }
  const double t = std::tan(kPi * kCalmCornerHz / sample_rate);
  f->shelf_c = (t - 1.0) / (t + 1.0);
  const double control_rate = sample_rate / f->control_step;
  f->a_power_attack = pole(sample_rate, kPowerAttackMs);
  f->a_power_release = pole(sample_rate, kPowerReleaseMs);
  f->a_whole_release = pole(sample_rate, kWholeReleaseMs);
  f->a_calm_power_release = pole(sample_rate, kCalmPowerReleaseMs);
  f->a_level_attack = pole(control_rate, kLevelAttackMs);
  f->a_level_release = pole(control_rate, kLevelReleaseMs);
  f->a_slow = pole(control_rate, kSlowMs);
  f->a_bed_rise = pole(control_rate, kBedRiseMs);
  f->a_bed_fall = pole(control_rate, kBedFallMs);
  f->a_bed_learn = pole(control_rate, kBedLearnMs);
  f->a_gain_attack = pole(control_rate, kGainAttackMs);
  f->a_gain_release = pole(control_rate, kGainReleaseMs);
  f->a_calm_level_attack = pole(control_rate, kCalmLevelAttackMs);
  f->a_calm_level_release = pole(control_rate, kCalmLevelReleaseMs);
  f->a_cut_attack = pole(control_rate, kCutAttackMs);
  f->a_cut_release = pole(control_rate, kCutReleaseMs);
  clear_report(f->report);
  FeqFootstepsSettings defaults{};
  feq_footsteps_settings_defaults(&defaults);
  feq_footsteps_configure(f, &defaults);
  return f;
}

void feq_footsteps_destroy(FeqFootsteps* footsteps) { delete footsteps; }

void feq_footsteps_configure(FeqFootsteps* footsteps,
                             const FeqFootstepsSettings* settings) {
  if (footsteps == nullptr || settings == nullptr) return;
  footsteps->enabled.store(settings->enabled != 0 ? 1 : 0,
                           std::memory_order_relaxed);
  footsteps->isolate.store(settings->isolate != 0 ? 1 : 0,
                           std::memory_order_relaxed);
  const auto unit = [](double value) {
    return std::isfinite(value) ? std::clamp(value, 0.0, 1.0) : 0.0;
  };
  footsteps->lift.store(unit(settings->lift), std::memory_order_relaxed);
  footsteps->calm.store(unit(settings->calm), std::memory_order_relaxed);
}

void feq_footsteps_set_lfe(FeqFootsteps* footsteps, int lfe_channel) {
  if (footsteps == nullptr) return;
  footsteps->lfe.store(
      lfe_channel >= 0 &&
              static_cast<uint32_t>(lfe_channel) < footsteps->channels
          ? lfe_channel
          : -1,
      std::memory_order_relaxed);
}

void feq_footsteps_process(FeqFootsteps* footsteps, float* const* channels,
                           uint32_t frames) {
  if (footsteps == nullptr || channels == nullptr) return;
  FeqFootsteps& f = *footsteps;
  State& s = f.state;
  clear_report(f.report);
  const bool enabled = f.enabled.load(std::memory_order_relaxed) != 0;
  if (!s.running) {
    if (!enabled) return;
    s.running = true;
  }
  const bool isolate =
      enabled && f.isolate.load(std::memory_order_relaxed) != 0;
  const double lift = f.lift.load(std::memory_order_relaxed);
  const double calm = f.calm.load(std::memory_order_relaxed);
  const int lfe = f.lfe.load(std::memory_order_relaxed);
  const uint32_t count = f.channels;

  for (uint32_t i = 0; i < frames; ++i) {
    if (s.until_control == 0) {
      decide(f, enabled, lift, calm);
      s.until_control = f.control_step;
    }
    --s.until_control;

    double x[FEQ_FOOTSTEPS_MAX_CHANNELS];
    double added[FEQ_FOOTSTEPS_MAX_CHANNELS] = {};
    double whole_peak = 0.0;
    for (uint32_t c = 0; c < count; ++c) {
      x[c] = channels[c][i];
      if (static_cast<int>(c) != lfe) whole_peak = std::max(whole_peak, x[c] * x[c]);
    }
    s.whole_power += (whole_peak > s.whole_power ? f.a_power_attack
                                                 : f.a_whole_release) *
                     (whole_peak - s.whole_power);

    for (int b = 0; b < FEQ_FOOTSTEPS_BANDS; ++b) {
      double y[FEQ_FOOTSTEPS_MAX_CHANNELS];
      double peak = 0.0;
      for (uint32_t c = 0; c < count; ++c) {
        if (static_cast<int>(c) == lfe) continue;
        y[c] = run_band(f.band[b], s.band_history[b][c], x[c]);
        peak = std::max(peak, y[c] * y[c]);
      }
      double& power = s.band_power[b];
      power += (peak > power ? f.a_power_attack : f.a_power_release) *
               (peak - power);
      double& gain = s.band_gain[b];
      gain += s.band_step[b];
      // Never past the target, on the sample it would be: a shot landing in
      // a step's lift must not wait for the next decision to lose it.
      if (gain > 1.0 && gain * gain * power > f.target_power) {
        gain = std::max(1.0, std::sqrt(f.target_power / power));
        s.band_step[b] = 0.0;
        s.band_gain_db[b] = std::min(s.band_gain_db[b], 20.0 * std::log10(gain));
      }
      const double k = gain - 1.0;
      for (uint32_t c = 0; c < count; ++c) {
        if (static_cast<int>(c) != lfe) added[c] += k * y[c];
      }
    }

    double calm_peak = 0.0;
    double low[FEQ_FOOTSTEPS_MAX_CHANNELS];
    for (uint32_t c = 0; c < count; ++c) {
      if (static_cast<int>(c) == lfe) continue;
      const double allpass = f.shelf_c * x[c] + s.shelf_x1[c] - f.shelf_c * s.shelf_y1[c];
      s.shelf_x1[c] = x[c];
      s.shelf_y1[c] = allpass;
      low[c] = 0.5 * (x[c] + allpass);
      calm_peak = std::max(calm_peak, low[c] * low[c]);
    }
    s.calm_power += (calm_peak > s.calm_power ? f.a_power_attack
                                              : f.a_calm_power_release) *
                    (calm_peak - s.calm_power);
    s.calm_gain += s.calm_step;
    const double kc = s.calm_gain - 1.0;

    for (uint32_t c = 0; c < count; ++c) {
      if (static_cast<int>(c) == lfe) {
        if (isolate) channels[c][i] = 0.0f;
        continue;
      }
      const double delta = added[c] + kc * low[c];
      channels[c][i] = static_cast<float>(isolate ? delta : x[c] + delta);
    }
  }

  if (!enabled && settled(s)) {
    // Every gain is at unity: the next block is the input, untouched, and
    // the next switch-on learns the bed afresh.
    s = State{};
  }
}

void feq_footsteps_transfer(FeqFootsteps* prepared, FeqFootsteps* previous) {
  if (prepared == nullptr || previous == nullptr || prepared == previous) return;
  prepared->state = previous->state;
}

void feq_footsteps_reset(FeqFootsteps* footsteps) {
  if (footsteps == nullptr) return;
  footsteps->state = State{};
  clear_report(footsteps->report);
}

void feq_footsteps_block_report(const FeqFootsteps* footsteps,
                                FeqFootstepsReport* out) {
  if (out == nullptr) return;
  if (footsteps == nullptr) {
    clear_report(*out);
    return;
  }
  *out = footsteps->report;
}

}  // extern "C"
