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

#include "footsteps_internal.h"

namespace {

using feq_footsteps_detail::BandPass;
using feq_footsteps_detail::decide;
using feq_footsteps_detail::dialogue_apply;
using feq_footsteps_detail::dialogue_decide;
using feq_footsteps_detail::dialogue_idle;
using feq_footsteps_detail::dialogue_listen;
using feq_footsteps_detail::environment_apply;
using feq_footsteps_detail::environment_decide;
using feq_footsteps_detail::environment_idle;
using feq_footsteps_detail::environment_listen;
using feq_footsteps_detail::History;
using feq_footsteps_detail::kBands;
using feq_footsteps_detail::kFloorDb;
using feq_footsteps_detail::overlay_headroom;
using feq_footsteps_detail::State;

constexpr double kPi = 3.14159265358979323846;

/**
 * The programme, which every decision is judged against
 * (`footsteps_decide.cpp`): rising over two seconds, falling over four.
 */
constexpr double kProgrammeRiseMs = 2000.0;
constexpr double kProgrammeFallMs = 4000.0;
/**
 * A sound's front is held this long as "arriving" — a step's length — and
 * its band standing over the bed is read as it is now, so the lift covers
 * the whole step and ends with it rather than carrying onto the bed. Without
 * the hold only a step's first 30 ms came up.
 */
constexpr double kHoldMs = 200.0;

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
/** A lift starts within two milliseconds and lets go over forty. */
constexpr double kGainAttackMs = 2.0;
constexpr double kGainReleaseMs = 40.0;
/**
 * Hold through carrier troughs down to 20 Hz, then release the reservation
 * promptly. A decaying peak without a hold modulated a partially limited
 * Environment tone (-53 dBc at 80 Hz), even though it retained hot originals.
 */
constexpr double kHeadroomPeakHoldMs = 32.0;
/** The lowest additive cue band is 300 Hz, rather than full-band ambience. */
constexpr double kCueHeadroomPeakHoldMs = 3.0;
constexpr double kHeadroomPeakReleaseMs = 20.0;
/** The whole signal, for "is anything around it loud". */
constexpr double kWholeReleaseMs = 60.0;

/** The rumble Calm listens to and turns down. */
constexpr double kCalmCornerHz = 250.0;
constexpr double kCalmPowerReleaseMs = 30.0;
constexpr double kCalmLevelAttackMs = 3.0;
constexpr double kCalmLevelReleaseMs = 40.0;
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

double pole(double rate, double ms) {
  return 1.0 - std::exp(-1.0 / (ms * 0.001 * rate));
}

BandPass design_band(double rate, double hz, double q) {
  const double w = 2.0 * kPi * std::min(hz, 0.45 * rate) / rate;
  const double alpha = std::sin(w) / (2.0 * q);
  const double a0 = 1.0 + alpha;
  return {alpha / a0, -2.0 * std::cos(w) / a0, (1.0 - alpha) / a0};
}

double run_band(const BandPass& k, History& h, double x) {
  const double y = k.b0 * x + h.z1;
  h.z1 = -k.a1 * y + h.z2;
  h.z2 = -k.b0 * x - k.a2 * y;
  return y;
}

void clear_report(FeqFootstepsReport& report) {
  report = FeqFootstepsReport{};
  report.level_db = static_cast<float>(kFloorDb);
  report.cue_db = static_cast<float>(kFloorDb);
  report.bed_db = static_cast<float>(kFloorDb);
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
  return s.calm_cut_db == 0.0 && s.calm_gain == 1.0 &&
         environment_idle(s.environment) && dialogue_idle(s.dialogue);
}

}  // namespace

extern "C" {

void feq_footsteps_settings_defaults(FeqFootstepsSettings* settings) {
  if (settings == nullptr) return;
  *settings = FeqFootstepsSettings{};
  settings->lift = 0.85;
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
  if (!feq_footsteps_detail::prepare_bed_history(*f)) {
    delete f;
    return nullptr;
  }
  f->control_step = std::max<uint32_t>(
      1u, static_cast<uint32_t>(std::lround(sample_rate / kControlHz)));
  f->learn_frames = static_cast<uint32_t>(std::lround(kLearnSeconds * sample_rate));
  for (int b = 0; b < FEQ_FOOTSTEPS_BANDS; ++b) {
    f->band[b] = design_band(sample_rate, kBands[b].hz, kBands[b].q);
  }
  const double t = std::tan(kPi * kCalmCornerHz / sample_rate);
  f->shelf_c = (t - 1.0) / (t + 1.0);
  const double control_rate = sample_rate / f->control_step;
  f->a_power_attack = pole(sample_rate, kPowerAttackMs);
  f->a_power_release = pole(sample_rate, kPowerReleaseMs);
  f->a_overlay_release = pole(sample_rate, kGainReleaseMs);
  f->a_headroom_peak_release = pole(sample_rate, kHeadroomPeakReleaseMs);
  f->headroom_hold_frames = static_cast<uint32_t>(
      std::lround(sample_rate * kHeadroomPeakHoldMs * 0.001));
  f->cue_headroom_hold_frames = static_cast<uint32_t>(
      std::lround(sample_rate * kCueHeadroomPeakHoldMs * 0.001));
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
  f->a_programme_rise = pole(control_rate, kProgrammeRiseMs);
  f->a_programme_fall = pole(control_rate, kProgrammeFallMs);
  f->hold_decisions =
      static_cast<uint32_t>(std::lround(kHoldMs * 0.001 * control_rate));
  feq_footsteps_detail::environment_design(f->environment_design, sample_rate,
                                           control_rate);
  feq_footsteps_detail::dialogue_design(f->dialogue_design, sample_rate,
                                        control_rate);
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
  footsteps->heavy.store(settings->heavy != 0 ? 1 : 0, std::memory_order_relaxed);
  footsteps->environment.store(
      std::isfinite(settings->environment)
          ? std::clamp(settings->environment, -1.0, 1.0)
          : 0.0,
      std::memory_order_relaxed);
  footsteps->voices.store(unit(settings->voices), std::memory_order_relaxed);
  footsteps->duck.store(settings->duck != 0 ? 1 : 0, std::memory_order_relaxed);
}

void feq_footsteps_set_centre(FeqFootsteps* footsteps, int centre_channel) {
  if (footsteps == nullptr) return;
  footsteps->centre.store(
      centre_channel >= 0 &&
              static_cast<uint32_t>(centre_channel) < footsteps->channels
          ? centre_channel
          : -1,
      std::memory_order_relaxed);
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
  const bool heavy = f.heavy.load(std::memory_order_relaxed) != 0;
  const double environment = f.environment.load(std::memory_order_relaxed);
  const double voices = f.voices.load(std::memory_order_relaxed);
  const double cue_ceiling = f.cue_ceiling.load(std::memory_order_relaxed);
  const bool duck = f.duck.load(std::memory_order_relaxed) != 0;
  const int lfe = f.lfe.load(std::memory_order_relaxed);
  const int centre = f.centre.load(std::memory_order_relaxed);
  const uint32_t count = f.channels;
  double applied[FEQ_FOOTSTEPS_BANDS] = {};
  double environment_applied = 1.0, voice_applied = 1.0;
  double duck_applied = 1.0, calm_applied = 1.0;

  for (uint32_t i = 0; i < frames; ++i) {
    if (s.until_control == 0) {
      const double step = static_cast<double>(f.control_step);
      decide(f, enabled, lift, calm, heavy);
      const bool moving = enabled && !s.learning;
      environment_decide(f.environment_design, s.environment,
                         moving ? environment : 0.0, s.learning, step,
                         f.report);
      dialogue_decide(f.dialogue_design, s.dialogue, moving ? voices : 0.0,
                      moving && duck, s.programme_db, s.quiet_around, step,
                      f.report);
      s.until_control = f.control_step;
    }
    --s.until_control;

    // `x` is the stage's input, which Environment and Dialogue listen to;
    // the lift listens to, and lifts, what Environment leaves of it.
    double input[FEQ_FOOTSTEPS_MAX_CHANNELS];
    double x[FEQ_FOOTSTEPS_MAX_CHANNELS];
    for (uint32_t c = 0; c < count; ++c) {
      input[c] = channels[c][i];
      x[c] = input[c];
    }
    environment_listen(f.environment_design, s.environment, input, count);
    dialogue_listen(f.dialogue_design, s.dialogue, input, count, centre);
    const bool environment_moving = !environment_idle(s.environment);
    if (environment_moving) {
      environment_apply(f.environment_design, s.environment, x, count, lfe);
      double delta[FEQ_FOOTSTEPS_MAX_CHANNELS];
      for (uint32_t c = 0; c < count; ++c) delta[c] = x[c] - input[c];
      const double gain = overlay_headroom(f, input, delta, count, lfe,
          s.environment_overlay, s.environment.gain[0] > 1 ||
          s.environment.gain[1] > 1 || s.environment.gain[2] > 1,
          f.headroom_hold_frames);
      for (uint32_t c = 0; c < count; ++c) x[c] = input[c] + gain * delta[c];
      for (int b = 0; b < feq_footsteps_detail::kEnvironmentBands; ++b) {
        const double effective = 1 + gain * (s.environment.gain[b] - 1);
        if (std::fabs(effective - 1) > std::fabs(environment_applied - 1)) {
          environment_applied = effective;
        }
      }
    } else {
      s.environment_overlay = {};
    }

    double added[FEQ_FOOTSTEPS_MAX_CHANNELS] = {};
    double whole_peak = 0.0;
    for (uint32_t c = 0; c < count; ++c) {
      if (static_cast<int>(c) != lfe) whole_peak = std::max(whole_peak, x[c] * x[c]);
    }
    s.whole_power += (whole_peak > s.whole_power ? f.a_power_attack
                                                 : f.a_whole_release) *
                     (whole_peak - s.whole_power);

    for (int b = 0; b < FEQ_FOOTSTEPS_BANDS; ++b) {
      double y[FEQ_FOOTSTEPS_MAX_CHANNELS];
      double peak = 0.0;
      double heard_peak = 0.0;
      for (uint32_t c = 0; c < count; ++c) {
        if (static_cast<int>(c) == lfe) continue;
        y[c] = run_band(f.band[b], s.band_history[b][c], x[c]);
        peak = std::max(peak, y[c] * y[c]);
      }
      feq_footsteps_detail::cue_residual(f, b, lfe, y);
      for (uint32_t c = 0; c < count; ++c) {
        if (static_cast<int>(c) == lfe) continue;
        const double heard = run_band(f.band[b], s.detect_history[b][c], y[c]);
        heard_peak = std::max(heard_peak, heard * heard);
      }
      double& heard_power = s.band_power[b];
      heard_power += (heard_peak > heard_power ? f.a_power_attack
                                               : f.a_power_release) *
                     (heard_peak - heard_power);
      double& power = s.lift_power[b];
      power += (peak > power ? f.a_power_attack : f.a_power_release) *
               (peak - power);
      double& gain = s.band_gain[b];
      gain += s.band_step[b];
      // Never past the target, on the sample it would be: a shot landing in
      // a step's lift must not wait for the next decision to lose it.
      if (gain > 1.0 && gain * gain * power > s.target_power) {
        gain = std::max(1.0, std::sqrt(s.target_power / power));
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
    double cue_delta[FEQ_FOOTSTEPS_MAX_CHANNELS] = {};
    for (uint32_t c = 0; c < count; ++c) {
      if (static_cast<int>(c) != lfe) cue_delta[c] = added[c] + kc * low[c];
    }
    const bool adding_cue = s.band_gain[0] > 1 || s.band_gain[1] > 1 || s.band_gain[2] > 1;
    const double overlay = overlay_headroom(f, x, cue_delta, count, lfe,
        s.overlay, adding_cue, f.cue_headroom_hold_frames,
        adding_cue ? cue_ceiling : feq_footsteps_detail::kOverlayCeiling);
    for (uint32_t c = 0; c < count; ++c) cue_delta[c] *= overlay;
    for (int b = 0; b < FEQ_FOOTSTEPS_BANDS; ++b) {
      applied[b] = std::max(applied[b], (s.band_gain[b] - 1.0) * overlay);
    }
    calm_applied = std::min(calm_applied, 1 + kc * overlay);

    const bool dialogue_moving = !dialogue_idle(s.dialogue);
    if (!dialogue_moving) s.dialogue_overlay = {};
    if (!environment_moving && !dialogue_moving) {
      // The lift alone, written as it always was: Isolate is its delta to
      // the bit, not the output less the input.
      for (uint32_t c = 0; c < count; ++c) {
        if (static_cast<int>(c) == lfe) {
          if (isolate) channels[c][i] = 0.0f;
          continue;
        }
        const double delta = cue_delta[c];
        channels[c][i] = static_cast<float>(isolate ? delta : x[c] + delta);
      }
      continue;
    }
    double out[FEQ_FOOTSTEPS_MAX_CHANNELS];
    for (uint32_t c = 0; c < count; ++c) {
      out[c] = x[c] + cue_delta[c];
    }
    if (dialogue_moving) {
      double before[FEQ_FOOTSTEPS_MAX_CHANNELS];
      for (uint32_t c = 0; c < count; ++c) before[c] = out[c];
      dialogue_apply(f.dialogue_design, s.dialogue, out, count, lfe, centre);
      double delta[FEQ_FOOTSTEPS_MAX_CHANNELS];
      for (uint32_t c = 0; c < count; ++c) delta[c] = out[c] - before[c];
      const double gain = overlay_headroom(f, before, delta, count, lfe,
          s.dialogue_overlay, s.dialogue.lift_gain > 1, f.headroom_hold_frames);
      for (uint32_t c = 0; c < count; ++c) out[c] = before[c] + gain * delta[c];
      voice_applied = std::max(voice_applied, 1 + gain * (s.dialogue.lift_gain - 1));
      duck_applied = std::min(duck_applied, 1 + gain * (s.dialogue.duck_gain - 1));
    }
    for (uint32_t c = 0; c < count; ++c) {
      if (static_cast<int>(c) == lfe) {
        if (isolate) channels[c][i] = 0.0f;
        continue;
      }
      channels[c][i] =
          static_cast<float>(isolate ? out[c] - input[c] : out[c]);
    }
  }

  for (int b = 0; b < FEQ_FOOTSTEPS_BANDS; ++b) {
    f.report.lift_db[b] = static_cast<float>(20.0 * std::log10(1.0 + applied[b]));
  }
  f.report.environment_db = static_cast<float>(20 * std::log10(environment_applied));
  f.report.voice_db = static_cast<float>(20 * std::log10(voice_applied));
  f.report.duck_db = static_cast<float>(20 * std::log10(duck_applied));
  f.report.calm_db = static_cast<float>(20 * std::log10(calm_applied));
  if (!enabled && settled(s)) {
    // Every gain is at unity: the next block is the input, untouched, and
    // the next switch-on learns the bed afresh.
    s = State{};
  }
}

void feq_footsteps_transfer(FeqFootsteps* prepared, FeqFootsteps* previous) {
  if (prepared == nullptr || previous == nullptr || prepared == previous) return;
  if (prepared->sample_rate != previous->sample_rate ||
      prepared->channels != previous->channels) return;
  prepared->state = previous->state;
  feq_footsteps_detail::transfer_bed_history(*prepared, *previous);
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
