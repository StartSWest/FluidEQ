/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "voice_level.h"

#include <algorithm>
#include <cmath>

namespace {

constexpr double kButterworthQ = 0.7071067811865476;
/** The gate's own band (`voice.cpp`), so the two hear the same voice. */
constexpr double kListenLowHz = 90.0;
constexpr double kListenHighHz = 7000.0;
/**
 * The voice's power over 10 ms, then held: risen to at once, let go over
 * 300 ms. Read over 300 ms both ways, a sentence's first words were heard
 * still rising out of the pause before them, as quieter than they were: the
 * gain chased up, came back down, and a loud voice ended cut by 7 dB of the
 * 10 it needed. And the rise follows the 10 ms power, never the samples:
 * following each squared sample up read a room's noise 9 dB over its own
 * floor, as a voice, and lifted it 24 dB (`voice_level_test.cpp`).
 */
constexpr double kPowerMs = 10.0;
constexpr double kPowerReleaseMs = 300.0;
constexpr double kFloorFallMs = 250.0;
/** Up slowly enough that steady talking is never taken for the room. */
constexpr double kFloorRiseDbPerSecond = 3.0;
constexpr double kVoiceOverRoomDb = 9.0;
/**
 * The room is learnt over a stream's first 300 ms before anything is judged
 * against it. Started from silence and climbing at its 3 dB/s, it read a
 * room's first seconds as a voice standing over it, and lifted the room by
 * the whole 24 dB at 44.1 kHz (`voice_level_test.cpp`).
 */
constexpr double kSettleMs = 300.0;
/**
 * And a sound only steers the gain while it is at its own level: within
 * 3 dB of what is held. A word's tail dying away over 300 ms read as a voice
 * getting quieter, and the gain rose into every pause after it.
 */
constexpr double kFallingDb = 3.0;
/** Under this nothing is a voice, whatever the room: a silent channel. */
constexpr double kQuietestVoiceDb = -65.0;
/**
 * Only syllables move it - two fifths of a talking second - so these are
 * what the voice gets of them: at 8 dB/s up a quiet voice took seven
 * seconds of speech to reach the target; at 18 it takes three.
 */
constexpr double kUpDbPerSecond = 18.0;
constexpr double kDownDbPerSecond = 24.0;
constexpr double kHoldSeconds = 10.0;
constexpr double kReleaseDbPerSecond = 1.5;
constexpr double kMostCutDb = 12.0;
constexpr double kSilenceDb = -150.0;

double follower(double ms, double sample_rate) {
  const double samples = std::max(1.0, ms * 0.001 * sample_rate);
  return std::exp(-1.0 / samples);
}

double clamp(double value, double low, double high) {
  return value < low ? low : (value > high ? high : value);
}

double tick(FeqBiquadState& s, const FeqBiquadCoefficients& c, double x) {
  const double y = c.b0 * x + c.b1 * s.x1 + c.b2 * s.x2 - c.a1 * s.y1 -
                   c.a2 * s.y2;
  s.x2 = s.x1;
  s.x1 = x;
  s.y2 = s.y1;
  s.y1 = y;
  return y;
}

/** One step of `value` toward `target`, at most `up` or `down`. */
double toward(double value, double target, double up, double down) {
  if (target > value) return std::min(target, value + up);
  if (target < value) return std::max(target, value - down);
  return value;
}

}  // namespace

void voice_level_derive(VoiceLevel& level, double sample_rate) {
  level.listen_low = feq_biquad_coefficients(FEQ_FILTER_HPQ, kListenLowHz, 0.0,
                                             kButterworthQ, sample_rate);
  level.listen_high = feq_biquad_coefficients(
      FEQ_FILTER_LPQ, std::min(kListenHighHz, sample_rate * 0.45), 0.0,
      kButterworthQ, sample_rate);
  level.power_short = follower(kPowerMs, sample_rate);
  level.power_release = follower(kPowerReleaseMs, sample_rate);
  level.floor_fall = follower(kFloorFallMs, sample_rate);
  level.floor_rise_db = kFloorRiseDbPerSecond / sample_rate;
  level.up_step_db = kUpDbPerSecond / sample_rate;
  level.down_step_db = kDownDbPerSecond / sample_rate;
  level.release_step_db = kReleaseDbPerSecond / sample_rate;
  level.hold_samples = static_cast<uint32_t>(kHoldSeconds * sample_rate);
  level.settle_samples =
      std::max<uint32_t>(1, static_cast<uint32_t>(kSettleMs * 0.001 * sample_rate));
}

void voice_level_reset(VoiceLevel& level) {
  level.low_state = FeqBiquadState{};
  level.high_state = FeqBiquadState{};
  level.short_power = 0.0;
  level.power = 0.0;
  level.floor_db = kSilenceDb;
  level.floor_known = false;
  level.settled = 0;
  level.gain_db = 0.0;
  level.quiet_samples = 0;
  level.report_level_db = -120.0f;
}

void voice_level_transfer(VoiceLevel& into, const VoiceLevel& from) {
  into.low_state = from.low_state;
  into.high_state = from.high_state;
  into.short_power = from.short_power;
  into.power = from.power;
  into.floor_db = from.floor_db;
  into.floor_known = from.floor_known;
  into.settled = std::min(from.settled, into.settle_samples);
  into.gain_db = from.gain_db;
  into.quiet_samples = from.quiet_samples;
  into.report_level_db = from.report_level_db;
}

void voice_level_process(VoiceLevel& level,
                         const FeqVoiceSettings& settings,
                         float* const* channels,
                         uint32_t count,
                         uint32_t frames) {
  if (settings.enabled == 0 || settings.level_enabled == 0 || count == 0) {
    // Off is off: no lift held for a later switch-on to jump in with.
    level.gain_db = 0.0;
    level.quiet_samples = 0;
    return;
  }
  const double target =
      clamp(settings.level_target_db, FEQ_VOICE_LEVEL_TARGET_MIN_DB,
            FEQ_VOICE_LEVEL_TARGET_MAX_DB);
  const double most_lift =
      clamp(settings.level_max_lift_db, 0.0, FEQ_VOICE_LEVEL_MAX_LIFT_DB);
  double gain_db = level.gain_db;
  double gain = std::pow(10.0, gain_db / 20.0);
  double heard_db = kSilenceDb;
  for (uint32_t i = 0; i < frames; ++i) {
    double sum = 0.0;
    for (uint32_t c = 0; c < count; ++c) {
      sum += channels[c] != nullptr ? channels[c][i] : 0.0;
    }
    double band = sum / static_cast<double>(count);
    band = tick(level.low_state, level.listen_low, band);
    band = tick(level.high_state, level.listen_high, band);
    const double square = band * band;
    level.short_power =
        square + level.power_short * (level.short_power - square);
    level.power = level.short_power > level.power
                      ? level.short_power
                      : level.short_power +
                            level.power_release *
                                (level.power - level.short_power);
    heard_db =
        level.power > 1e-15 ? 10.0 * std::log10(level.power) : kSilenceDb;

    // The room as the gate's look-ahead follows it: down over a quarter
    // second, up slowly, so a word is never mistaken for the room.
    if (!level.floor_known || level.settled < level.settle_samples) {
      level.floor_db = heard_db;
      level.floor_known = true;
      ++level.settled;
    } else if (heard_db < level.floor_db) {
      level.floor_db = heard_db + level.floor_fall * (level.floor_db - heard_db);
    } else {
      level.floor_db = std::min(heard_db, level.floor_db + level.floor_rise_db);
    }

    const double before = gain_db;
    const double short_db = level.short_power > 1e-15
                                ? 10.0 * std::log10(level.short_power)
                                : kSilenceDb;
    const bool voice = level.settled >= level.settle_samples &&
                       heard_db >= level.floor_db + kVoiceOverRoomDb &&
                       heard_db >= kQuietestVoiceDb &&
                       short_db >= heard_db - kFallingDb;
    if (voice) {
      level.quiet_samples = 0;
      const double wanted = clamp(target - heard_db, -kMostCutDb, most_lift);
      gain_db = toward(gain_db, wanted, level.up_step_db, level.down_step_db);
    } else if (level.quiet_samples < level.hold_samples) {
      ++level.quiet_samples;
    } else {
      gain_db = toward(gain_db, 0.0, level.release_step_db,
                       level.release_step_db);
    }
    // A most lift turned down below the gain it holds lands at once.
    gain_db = std::min(gain_db, most_lift);
    if (gain_db != before) gain = std::pow(10.0, gain_db / 20.0);
    if (gain_db != 0.0) {
      for (uint32_t c = 0; c < count; ++c) {
        if (channels[c] != nullptr) {
          channels[c][i] = static_cast<float>(channels[c][i] * gain);
        }
      }
    }
  }
  level.gain_db = gain_db;
  level.report_level_db = static_cast<float>(heard_db);
}
