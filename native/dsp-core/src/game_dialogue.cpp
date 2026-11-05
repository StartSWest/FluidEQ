/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Dialogue: while a voice speaks, its band comes forward, and with "make
 * room" everything else steps back (`footsteps.h` for where it stands).
 *
 * A game puts its dialogue in the centre — the centre channel of a 5.1 or
 * 7.1 stream, the mid of a stereo one — and a voice is told from the rest
 * of the centre by four things, all of them needed at once:
 *
 * - **It is the centre's.** Its band (250 Hz to 3.5 kHz) stands 4 to 12 dB
 *   over the same band in the side (stereo), or -3 to 6 dB over the fronts
 *   (surround, where the fronts carry the score and the effects).
 * - **It moves at the rate of syllables.** The band's level, read fast
 *   (15 ms) and slow (300 ms), parts by 2.5 to 5 dB on average over 0.4 s:
 *   a syllable, then the gap before the next. Rain, wind and a held chord
 *   part by about one.
 * - **It is under 5 kHz.** The band stands 3 to 10 dB over what is above it.
 *   A step, a reload and the player's own boots are mostly scuff and click,
 *   and they are centred too.
 * - **Nothing around it is loud.** The lift's own reading of a blast
 *   (`footsteps_decide.cpp`), and a voice more than 30 dB under the whole
 *   mix is not one the player is following.
 *
 * Found, it is held for 0.4 s and let go over half a second, so the gaps
 * between words do not bring the room back up between them. The voice band
 * is split out of the centre by two first-order all-passes (250 Hz and
 * 5 kHz), so the parts always add back to the centre exactly and nothing but
 * the gains changes the sound. Listened to on the stage's input: nothing the
 * stage lifted or lowered is taken for a voice.
 */
#include <algorithm>
#include <cmath>

#include "game_parts.h"

namespace feq_footsteps_detail {
namespace {

constexpr double kVoiceLowHz = 250.0;
constexpr double kVoiceHighHz = 3500.0;
constexpr double kOverVoiceHz = 5000.0;
constexpr double kSplitLowHz = 250.0;
constexpr double kSplitHighHz = 5000.0;

constexpr double kPowerAttackMs = 5.0;
constexpr double kPowerReleaseMs = 30.0;
constexpr double kFastMs = 15.0;
constexpr double kSlowMs = 300.0;
constexpr double kDepthMs = 400.0;
constexpr double kTiltMs = 150.0;
constexpr double kCentreMs = 150.0;
constexpr double kVoiceAttackMs = 40.0;
constexpr double kVoiceReleaseMs = 500.0;
constexpr double kHoldMs = 400.0;
constexpr double kGainAttackMs = 40.0;
constexpr double kGainReleaseMs = 300.0;

constexpr double kStereoCentreFromDb = 4.0;
constexpr double kStereoCentreToDb = 12.0;
constexpr double kSurroundCentreFromDb = -3.0;
constexpr double kSurroundCentreToDb = 6.0;
/** A mono stream's voice stands over nothing: this far, and no further. */
constexpr double kCentreCapDb = 30.0;
constexpr double kDepthFromDb = 2.5;
constexpr double kDepthToDb = 5.0;
constexpr double kTiltFromDb = 3.0;
constexpr double kTiltToDb = 10.0;
constexpr double kLevelFromDb = -62.0;
constexpr double kLevelToDb = -52.0;
constexpr double kUnderProgrammeFromDb = 36.0;
constexpr double kUnderProgrammeToDb = 30.0;
constexpr double kSettledDb = 0.01;

double db_of(double power) { return 10.0 * std::log10(power + 1e-24); }

void follow(double& power, double value, const DialogueDesign& design) {
  power += (value > power ? design.a_power_attack : design.a_power_release) *
           (value - power);
}

}  // namespace

void dialogue_design(DialogueDesign& design, double rate, double control_rate) {
  design.voice_high_pass = butterworth_high_pass(rate, kVoiceLowHz);
  design.voice_low_pass = butterworth_low_pass(rate, kVoiceHighHz);
  design.over_voice = butterworth_high_pass(rate, kOverVoiceHz);
  design.split_low_c = split_coefficient(rate, kSplitLowHz);
  design.split_high_c = split_coefficient(rate, kSplitHighHz);
  design.a_power_attack = pole_of(rate, kPowerAttackMs);
  design.a_power_release = pole_of(rate, kPowerReleaseMs);
  design.a_fast = pole_of(control_rate, kFastMs);
  design.a_slow = pole_of(control_rate, kSlowMs);
  design.a_depth = pole_of(control_rate, kDepthMs);
  design.a_tilt = pole_of(control_rate, kTiltMs);
  design.a_centre = pole_of(control_rate, kCentreMs);
  design.a_voice_attack = pole_of(control_rate, kVoiceAttackMs);
  design.a_voice_release = pole_of(control_rate, kVoiceReleaseMs);
  design.hold_decisions =
      static_cast<uint32_t>(std::lround(kHoldMs * 0.001 * control_rate));
  design.a_gain_attack = pole_of(control_rate, kGainAttackMs);
  design.a_gain_release = pole_of(control_rate, kGainReleaseMs);
}

void dialogue_listen(const DialogueDesign& design, DialogueState& state,
                     const double* frame, uint32_t channels, int centre) {
  state.surround =
      centre >= 2 && static_cast<uint32_t>(centre) < channels && channels >= 3;
  double voice = 0.0;
  if (state.surround) {
    voice = frame[centre];
    double other = 0.0;
    for (int front = 0; front < 2; ++front) {
      const double band = run_biquad(
          design.voice_low_pass, state.other_lp[front],
          run_biquad(design.voice_high_pass, state.other_hp[front], frame[front]));
      other = std::max(other, band * band);
    }
    follow(state.other_power, other, design);
  } else if (channels >= 2) {
    voice = 0.5 * (frame[0] + frame[1]);
    const double side = 0.5 * (frame[0] - frame[1]);
    const double band = run_biquad(
        design.voice_low_pass, state.other_lp[0],
        run_biquad(design.voice_high_pass, state.other_hp[0], side));
    follow(state.other_power, band * band, design);
  } else {
    voice = frame[0];
    state.other_power = 0.0;
  }
  const double band =
      run_biquad(design.voice_low_pass, state.voice_lp,
                 run_biquad(design.voice_high_pass, state.voice_hp, voice));
  follow(state.voice_power, band * band, design);
  const double over = run_biquad(design.over_voice, state.over_history, voice);
  follow(state.over_power, over * over, design);
}

void dialogue_decide(const DialogueDesign& design, DialogueState& state,
                     double voices, bool duck, double programme_db,
                     double quiet_around, double samples,
                     FeqFootstepsReport& report) {
  const double voice_db = db_of(state.voice_power);
  state.fast_db += design.a_fast * (voice_db - state.fast_db);
  state.slow_db += design.a_slow * (voice_db - state.slow_db);
  state.depth_db +=
      design.a_depth * (std::fabs(state.fast_db - state.slow_db) - state.depth_db);
  state.tilt_db +=
      design.a_tilt * ((voice_db - db_of(state.over_power)) - state.tilt_db);
  const double over_other =
      std::min(voice_db - db_of(state.other_power), kCentreCapDb);
  state.centre_db += design.a_centre * (over_other - state.centre_db);

  const double centred =
      state.surround
          ? smooth_step(kSurroundCentreFromDb, kSurroundCentreToDb, state.centre_db)
          : smooth_step(kStereoCentreFromDb, kStereoCentreToDb, state.centre_db);
  const double heard =
      smooth_step(kLevelFromDb, kLevelToDb, state.slow_db) *
      smooth_step(programme_db - kUnderProgrammeFromDb,
                  programme_db - kUnderProgrammeToDb, state.slow_db);
  const double raw = centred *
                     smooth_step(kDepthFromDb, kDepthToDb, state.depth_db) *
                     smooth_step(kTiltFromDb, kTiltToDb, state.tilt_db) * heard *
                     quiet_around;
  if (raw >= state.voice) {
    state.voice += design.a_voice_attack * (raw - state.voice);
    state.hold_left = design.hold_decisions;
  } else if (state.hold_left > 0) {
    --state.hold_left;
  } else {
    state.voice += design.a_voice_release * (raw - state.voice);
  }

  double lift_want = voices * kVoiceLiftDb * state.voice;
  if (lift_want < kSettledDb) lift_want = 0.0;
  double duck_want =
      duck ? (kDuckLeastDb + (kDuckMostDb - kDuckLeastDb) * voices) * state.voice
           : 0.0;
  if (duck_want < kSettledDb) duck_want = 0.0;
  state.lift_db += (lift_want > state.lift_db ? design.a_gain_attack
                                              : design.a_gain_release) *
                   (lift_want - state.lift_db);
  if (lift_want == 0.0 && state.lift_db < kSettledDb) state.lift_db = 0.0;
  state.duck_db += (duck_want > state.duck_db ? design.a_gain_attack
                                              : design.a_gain_release) *
                   (duck_want - state.duck_db);
  if (duck_want == 0.0 && state.duck_db < kSettledDb) state.duck_db = 0.0;
  glide_gain(state.lift_gain, state.lift_step, state.lift_db, samples);
  glide_gain(state.duck_gain, state.duck_step, -state.duck_db, samples);

  report.voice = std::max(report.voice, static_cast<float>(state.voice));
  report.voice_db = std::max(report.voice_db, static_cast<float>(state.lift_db));
  report.duck_db = std::min(report.duck_db, static_cast<float>(-state.duck_db));
}

bool dialogue_idle(const DialogueState& state) {
  return state.lift_db == 0.0 && state.duck_db == 0.0 &&
         state.lift_gain == 1.0 && state.duck_gain == 1.0 &&
         state.lift_step == 0.0 && state.duck_step == 0.0;
}

void dialogue_apply(const DialogueDesign& design, DialogueState& state,
                    double* frame, uint32_t channels, int lfe, int centre) {
  state.lift_gain += state.lift_step;
  state.duck_gain += state.duck_step;
  const double k_voice = state.lift_gain - 1.0;
  const double k_rest = state.duck_gain - 1.0;
  // The voice's channel split into under, voice and over: the voice band
  // comes forward, the rest of it steps back with everything else.
  const auto centre_delta = [&](double x) {
    const double low = split_low(design.split_low_c, state.split_low, x);
    const double rest = x - low;
    const double voice = split_low(design.split_high_c, state.split_high, rest);
    return k_rest * (low + rest - voice) + k_voice * voice;
  };
  if (state.surround) {
    for (uint32_t c = 0; c < channels; ++c) {
      if (static_cast<int>(c) == lfe) continue;
      const double x = frame[c];
      frame[c] = static_cast<int>(c) == centre ? x + centre_delta(x)
                                               : x + k_rest * x;
    }
    return;
  }
  if (channels < 2) {
    frame[0] += centre_delta(frame[0]);
    return;
  }
  const double left = frame[0];
  const double right = frame[1];
  const double mid_delta = centre_delta(0.5 * (left + right));
  const double side_delta = k_rest * 0.5 * (left - right);
  frame[0] = left + mid_delta + side_delta;
  frame[1] = right + mid_delta - side_delta;
  for (uint32_t c = 2; c < channels; ++c) {
    if (static_cast<int>(c) == lfe) continue;
    frame[c] += k_rest * frame[c];
  }
}

}  // namespace feq_footsteps_detail
