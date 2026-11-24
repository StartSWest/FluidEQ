/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/voice.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <new>
#include <vector>

#include "fluideq/biquad.h"
#include "voice_level.h"

namespace {

constexpr double kButterworthQ = 0.7071067811865476;
/** The gate listens between these, so a hum or a hiss does not open it. */
constexpr double kGateListenLowHz = 90.0;
constexpr double kGateListenHighHz = 7000.0;
/** The gate closes this far under where it opens, so a voice on the
 * threshold does not chatter it open and shut every few milliseconds. */
constexpr double kGateHysteresisDb = 4.0;
constexpr double kSilenceDb = -150.0;
/**
 * The look-ahead opens the gate on a sound this far over the room's own
 * level. A room's level wanders a few dB at most through a 40 ms follower; a
 * first consonant of a word stands well clear of it.
 */
constexpr double kAheadRiseDb = 9.0;
/**
 * And never on a sound this far under the threshold: a tick in a silent room
 * rises over a floor of nothing, and is not a word.
 */
constexpr double kAheadUnderThresholdDb = 12.0;
/**
 * How fast the room's level is followed down, and up. Down over a quarter
 * second, not at once: a room's envelope dips for a few milliseconds all the
 * time, and a floor that followed every dip read the room's next peak as a
 * sound rising out of it (measured at 44.1 kHz on a -58 dBFS room).
 */
constexpr double kAheadFloorFallMs = 250.0;
constexpr double kAheadFloorRiseDbPerSecond = 6.0;
/** The look-ahead's level is the band's power over this long. */
constexpr double kAheadLevelMs = 5.0;
/** A rise has to last this long to be a sound; a room's peak does not. */
constexpr double kAheadRiseMs = 3.0;
/** Under this is digital silence, never a room (a mic's own noise is far up). */
constexpr double kAheadSilenceDb = -110.0;

double to_db(double value) {
  return value > 1e-8 ? 20.0 * std::log10(value) : kSilenceDb;
}

/** The per-sample coefficient of a one-pole follower with this time. */
double follower(double ms, double sample_rate) {
  const double samples = std::max(1.0, ms * 0.001 * sample_rate);
  return std::exp(-1.0 / samples);
}

double clamp(double value, double low, double high) {
  return value < low ? low : (value > high ? high : value);
}

}  // namespace

struct FeqVoice {
  double sample_rate = 48000.0;
  uint32_t channels = 0;
  FeqVoiceSettings settings{};

  FeqBiquadCoefficients low_cut{};
  FeqBiquadCoefficients proximity{};
  FeqBiquadCoefficients plosive_band{};
  /**
   * The pop guard's cut is a crossfade toward the signal through two
   * Butterworth high-passes at the plosive corner (24 dB/oct), not the low
   * band subtracted: a low-pass carries its own phase shift, and taking it
   * away from the signal cancelled under 5 dB at 60 Hz. The high-passed copy
   * is 33 dB down there and within a degree of the input by 1 kHz.
   */
  FeqBiquadCoefficients plosive_high{};
  FeqBiquadCoefficients listen_low{};
  FeqBiquadCoefficients listen_high{};
  bool low_cut_on = false;
  bool proximity_on = false;

  FeqBiquadState low_cut_state[FEQ_VOICE_MAX_CHANNELS]{};
  FeqBiquadState proximity_state[FEQ_VOICE_MAX_CHANNELS]{};
  FeqBiquadState plosive_state[FEQ_VOICE_MAX_CHANNELS]{};
  FeqBiquadState plosive_high_state[FEQ_VOICE_MAX_CHANNELS][2]{};
  FeqBiquadState listen_low_state{};
  FeqBiquadState listen_high_state{};

  // Pop guard: how loud the low band is right now, how loud it has been
  // lately, and how loud the voice above it has been lately. A plosive is a
  // sudden jump of the first over the second that also stands over the third:
  // a voice with a steady low end jumps over nothing, and a loud low note
  // under a louder voice stands over nothing.
  double plosive_fast = 0.0;
  double low_slow = 0.0;
  double voice_slow = 0.0;
  double plosive_cut_db = 0.0;
  double plosive_attack = 0.0;
  double plosive_release = 0.0;
  double fast_attack = 0.0;
  double fast_release = 0.0;
  double slow_coefficient = 0.0;

  // Gate.
  double gate_envelope = 0.0;
  double gate_gain_db = 0.0;
  double gate_open_step_db = 0.0;
  double gate_close_step_db = 0.0;
  double gate_env_attack = 0.0;
  double gate_env_release = 0.0;
  uint32_t gate_hold_left = 0;
  uint32_t gate_hold_samples = 0;

  // The gate's look-ahead: the voice as it enters the cleaner, the cleaner's
  // delay ahead of what the gate turns down. `ahead_floor_db` follows the
  // room's own level - down at once, up slowly - so a sound rising out of
  // the room is told apart from the room. `ahead_open` says, frame by frame
  // of the block the gate is about to run, whether such a sound is there.
  FeqBiquadState ahead_low_state{};
  FeqBiquadState ahead_high_state{};
  /** Mean square over ~5 ms of the look-ahead's band. */
  double ahead_envelope = 0.0;
  double ahead_power_coefficient = 0.0;
  double ahead_floor_db = kSilenceDb;
  bool ahead_floor_known = false;
  double ahead_floor_rise_db = 0.0;
  double ahead_floor_fall = 0.0;
  uint32_t ahead_rise_samples = 1;
  uint32_t ahead_settle_samples = 1;
  uint32_t ahead_settled = 0;
  uint32_t ahead_run = 0;
  std::vector<uint8_t> ahead_open;
  uint32_t ahead_frames = 0;

  // Voice level (`voice_level.h`), after the gate.
  VoiceLevel level;

  // The block's report, written by the audio thread only.
  float report_plosive_cut_db = 0.0f;
};

namespace {

/** One sample of a biquad, sharing the state layout of `feq_biquad_process`. */
inline double tick(FeqBiquadState& s, const FeqBiquadCoefficients& c,
                   double x) {
  const double y = c.b0 * x + c.b1 * s.x1 + c.b2 * s.x2 - c.a1 * s.y1 -
                   c.a2 * s.y2;
  s.x2 = s.x1;
  s.x1 = x;
  s.y2 = s.y1;
  s.y1 = y;
  return y;
}

void derive(FeqVoice& v) {
  const double rate = v.sample_rate;
  const double nyquist_guard = rate * 0.45;
  const FeqVoiceSettings& s = v.settings;
  v.low_cut_on = s.enabled != 0 && s.low_cut_hz >= FEQ_VOICE_LOW_CUT_MIN_HZ;
  if (v.low_cut_on) {
    v.low_cut = feq_biquad_coefficients(
        FEQ_FILTER_HPQ, std::min(s.low_cut_hz, nyquist_guard), 0.0,
        kButterworthQ, rate);
  }
  v.proximity_on = s.enabled != 0 && s.proximity_db > 0.0;
  if (v.proximity_on) {
    v.proximity = feq_biquad_coefficients(
        FEQ_FILTER_LSC, FEQ_VOICE_PROXIMITY_HZ,
        -std::min(s.proximity_db, FEQ_VOICE_PROXIMITY_MAX_DB), kButterworthQ,
        rate);
  }
  v.plosive_band = feq_biquad_coefficients(FEQ_FILTER_LPQ, FEQ_VOICE_PLOSIVE_HZ,
                                           0.0, kButterworthQ, rate);
  v.plosive_high = feq_biquad_coefficients(FEQ_FILTER_HPQ, FEQ_VOICE_PLOSIVE_HZ,
                                           0.0, kButterworthQ, rate);
  v.listen_low = feq_biquad_coefficients(FEQ_FILTER_HPQ, kGateListenLowHz, 0.0,
                                         kButterworthQ, rate);
  v.listen_high = feq_biquad_coefficients(
      FEQ_FILTER_LPQ, std::min(kGateListenHighHz, nyquist_guard), 0.0,
      kButterworthQ, rate);

  // A plosive peaks within a couple of milliseconds and is over in tens.
  v.fast_attack = follower(0.5, rate);
  v.fast_release = follower(30.0, rate);
  v.slow_coefficient = follower(400.0, rate);
  v.plosive_attack = follower(1.0, rate);
  v.plosive_release = follower(80.0, rate);

  const double range = clamp(s.gate_range_db, 0.0, 80.0);
  const double attack_samples =
      std::max(1.0, clamp(s.gate_attack_ms, 0.1, 50.0) * 0.001 * rate);
  const double release_samples =
      std::max(1.0, clamp(s.gate_release_ms, 5.0, 2000.0) * 0.001 * rate);
  v.gate_open_step_db = range / attack_samples;
  v.gate_close_step_db = range / release_samples;
  v.gate_hold_samples = static_cast<uint32_t>(
      clamp(s.gate_hold_ms, 0.0, 1000.0) * 0.001 * rate + 0.5);
  v.gate_env_attack = follower(1.0, rate);
  v.gate_env_release = follower(40.0, rate);
  v.ahead_power_coefficient = follower(kAheadLevelMs, rate);
  v.ahead_floor_fall = follower(kAheadFloorFallMs, rate);
  v.ahead_floor_rise_db = kAheadFloorRiseDbPerSecond / rate;
  // Four of its time constants: the average within 2% of its level.
  v.ahead_settle_samples =
      std::max<uint32_t>(1, static_cast<uint32_t>(4.0 * kAheadLevelMs * 0.001 * rate));
  v.ahead_rise_samples =
      std::max<uint32_t>(1, static_cast<uint32_t>(kAheadRiseMs * 0.001 * rate));
  voice_level_derive(v.level, rate);
}

}  // namespace

extern "C" {

void feq_voice_settings_defaults(FeqVoiceSettings* settings) {
  if (settings == nullptr) return;
  *settings = FeqVoiceSettings{};
  settings->gate_threshold_db = -50.0;
  settings->gate_range_db = 15.0;
  settings->gate_hold_ms = 200.0;
  settings->gate_attack_ms = 2.0;
  settings->gate_release_ms = 150.0;
  settings->level_target_db = -18.0;
  settings->level_max_lift_db = 18.0;
}

FeqVoice* feq_voice_create(double sample_rate, uint32_t channels) {
  if (!(sample_rate > 0.0) || channels == 0 ||
      channels > FEQ_VOICE_MAX_CHANNELS) {
    return nullptr;
  }
  auto* voice = new (std::nothrow) FeqVoice();
  if (voice == nullptr) return nullptr;
  voice->sample_rate = sample_rate;
  voice->channels = channels;
  feq_voice_settings_defaults(&voice->settings);
  derive(*voice);
  return voice;
}

void feq_voice_destroy(FeqVoice* voice) { delete voice; }

void feq_voice_configure(FeqVoice* voice, const FeqVoiceSettings* settings) {
  if (voice == nullptr || settings == nullptr) return;
  voice->settings = *settings;
  derive(*voice);
}

void feq_voice_reset(FeqVoice* voice) {
  if (voice == nullptr) return;
  for (uint32_t c = 0; c < FEQ_VOICE_MAX_CHANNELS; ++c) {
    voice->low_cut_state[c] = FeqBiquadState{};
    voice->proximity_state[c] = FeqBiquadState{};
    voice->plosive_state[c] = FeqBiquadState{};
    voice->plosive_high_state[c][0] = FeqBiquadState{};
    voice->plosive_high_state[c][1] = FeqBiquadState{};
  }
  voice->listen_low_state = FeqBiquadState{};
  voice->listen_high_state = FeqBiquadState{};
  voice->plosive_fast = 0.0;
  voice->low_slow = 0.0;
  voice->voice_slow = 0.0;
  voice->plosive_cut_db = 0.0;
  voice->gate_envelope = 0.0;
  voice->gate_gain_db = 0.0;
  voice->gate_hold_left = 0;
  voice->ahead_low_state = FeqBiquadState{};
  voice->ahead_high_state = FeqBiquadState{};
  voice->ahead_envelope = 0.0;
  voice->ahead_floor_db = kSilenceDb;
  voice->ahead_floor_known = false;
  voice->ahead_run = 0;
  voice->ahead_settled = 0;
  voice->ahead_frames = 0;
  voice_level_reset(voice->level);
  voice->report_plosive_cut_db = 0.0f;
}

void feq_voice_set_max_frames(FeqVoice* voice, uint32_t max_frames) {
  if (voice == nullptr) return;
  voice->ahead_open.assign(max_frames, 0);
  voice->ahead_frames = 0;
}

void feq_voice_transfer(FeqVoice* into, const FeqVoice* from) {
  if (into == nullptr || from == nullptr || into == from ||
      into->sample_rate != from->sample_rate) {
    return;
  }
  const uint32_t shared = std::min(into->channels, from->channels);
  for (uint32_t c = 0; c < shared; ++c) {
    into->low_cut_state[c] = from->low_cut_state[c];
    into->proximity_state[c] = from->proximity_state[c];
    into->plosive_state[c] = from->plosive_state[c];
    into->plosive_high_state[c][0] = from->plosive_high_state[c][0];
    into->plosive_high_state[c][1] = from->plosive_high_state[c][1];
  }
  into->listen_low_state = from->listen_low_state;
  into->listen_high_state = from->listen_high_state;
  into->plosive_fast = from->plosive_fast;
  into->low_slow = from->low_slow;
  into->voice_slow = from->voice_slow;
  into->plosive_cut_db = from->plosive_cut_db;
  into->gate_envelope = from->gate_envelope;
  // The gate keeps where it was, inside the new range: a profile switched
  // mid-word must not snap a closed gate open or an open one shut.
  into->gate_gain_db =
      std::max(from->gate_gain_db, -clamp(into->settings.gate_range_db, 0.0, 80.0));
  into->gate_hold_left = std::min(from->gate_hold_left, into->gate_hold_samples);
  // What the look-ahead knows of the room is the room's, not the chain's.
  into->ahead_low_state = from->ahead_low_state;
  into->ahead_high_state = from->ahead_high_state;
  into->ahead_envelope = from->ahead_envelope;
  into->ahead_floor_db = from->ahead_floor_db;
  into->ahead_floor_known = from->ahead_floor_known;
  into->ahead_run = from->ahead_run;
  into->ahead_settled = from->ahead_settled;
  // A dial moved mid-sentence keeps the lift it had, rather than the voice
  // dropping to its own level and climbing back.
  voice_level_transfer(into->level, from->level);
}

void feq_voice_hear_ahead(FeqVoice* voice, const float* const* channels,
                          uint32_t frames) {
  if (voice == nullptr) return;
  voice->ahead_frames = 0;
  if (channels == nullptr || voice->settings.enabled == 0 ||
      voice->settings.gate_enabled == 0 || frames > voice->ahead_open.size()) {
    return;
  }
  const uint32_t count = voice->channels;
  const double threshold = clamp(voice->settings.gate_threshold_db, -80.0, -10.0);
  for (uint32_t i = 0; i < frames; ++i) {
    double sum = 0.0;
    for (uint32_t c = 0; c < count; ++c) {
      sum += channels[c] != nullptr ? channels[c][i] : 0.0;
    }
    // Heard through the gate's own band, so the two detectors agree on what
    // counts as voice: a hum or a hiss opens neither.
    double listened = sum / static_cast<double>(count);
    listened = tick(voice->ahead_low_state, voice->listen_low, listened);
    listened = tick(voice->ahead_high_state, voice->listen_high, listened);
    // A level over 5 ms, not a peak: a peak follower on a room's noise jumps
    // 10 dB from one stray sample to the next and read the room as words;
    // 5 ms of power holds a room within about a dB and still rises on a
    // first consonant inside the look-ahead.
    const double power = listened * listened;
    voice->ahead_envelope =
        power + voice->ahead_power_coefficient * (voice->ahead_envelope - power);
    const double level =
        voice->ahead_envelope > 1e-16 ? 10.0 * std::log10(voice->ahead_envelope) : kSilenceDb;
    if (level < kAheadSilenceDb) {
      // Digital silence - a stream being primed, a muted mic - is not a room.
      // Let it set the floor and the room that follows reads as a sound
      // rising out of nothing, holding the gate open for as long as the floor
      // takes to climb back (the mic profiles' quiet-room test caught it).
      voice->ahead_run = 0;
      voice->ahead_open[i] = 0;
      continue;
    }
    if (!voice->ahead_floor_known) {
      // The room's level is the first one the 5 ms average has settled on,
      // not its first sample: it starts from nothing and climbs, and its
      // first reading (-100 dB on a -62 dBFS room) taken as the floor read
      // the room as a sound rising 38 dB out of it, gate open for seconds.
      voice->ahead_run = 0;
      voice->ahead_open[i] = 0;
      voice->ahead_settled += 1;
      if (voice->ahead_settled >= voice->ahead_settle_samples) {
        voice->ahead_floor_db = level;
        voice->ahead_floor_known = true;
      }
      continue;
    }
    if (level < voice->ahead_floor_db) {
      voice->ahead_floor_db =
          level + voice->ahead_floor_fall * (voice->ahead_floor_db - level);
    } else {
      voice->ahead_floor_db = std::min(level, voice->ahead_floor_db + voice->ahead_floor_rise_db);
    }
    const bool rising = level >= voice->ahead_floor_db + kAheadRiseDb &&
                        level >= threshold - kAheadUnderThresholdDb;
    voice->ahead_run = rising ? voice->ahead_run + 1 : 0;
    voice->ahead_open[i] = voice->ahead_run >= voice->ahead_rise_samples ? 1 : 0;
  }
  voice->ahead_frames = frames;
}

void feq_voice_process_front(FeqVoice* voice, float* const* channels,
                             uint32_t frames) {
  if (voice == nullptr || channels == nullptr || voice->settings.enabled == 0) {
    if (voice != nullptr) voice->report_plosive_cut_db = 0.0f;
    return;
  }
  const uint32_t count = voice->channels;
  for (uint32_t c = 0; c < count; ++c) {
    float* data = channels[c];
    if (data == nullptr) continue;
    if (voice->low_cut_on) {
      feq_biquad_process(&voice->low_cut_state[c], data, frames, &voice->low_cut);
    }
    if (voice->proximity_on) {
      feq_biquad_process(&voice->proximity_state[c], data, frames,
                         &voice->proximity);
    }
  }

  const double amount = clamp(voice->settings.deplosive, 0.0, 1.0);
  double deepest = 0.0;
  if (amount > 0.0) {
    for (uint32_t i = 0; i < frames; ++i) {
      // The low band of every channel and what is above it, the loudest of
      // each linked across channels: one decision for the whole mic.
      double low[FEQ_VOICE_MAX_CHANNELS];
      double high[FEQ_VOICE_MAX_CHANNELS];
      double low_peak = 0.0;
      double above_peak = 0.0;
      for (uint32_t c = 0; c < count; ++c) {
        const double x = channels[c] != nullptr ? channels[c][i] : 0.0;
        low[c] = tick(voice->plosive_state[c], voice->plosive_band, x);
        // Run every sample, cut or not, so the copy is warm when a pop comes.
        high[c] = tick(voice->plosive_high_state[c][1], voice->plosive_high,
                       tick(voice->plosive_high_state[c][0],
                            voice->plosive_high, x));
        low_peak = std::max(low_peak, std::fabs(low[c]));
        above_peak = std::max(above_peak, std::fabs(x - low[c]));
      }
      const double fast_k =
          low_peak > voice->plosive_fast ? voice->fast_attack : voice->fast_release;
      voice->plosive_fast = low_peak + fast_k * (voice->plosive_fast - low_peak);
      voice->low_slow =
          low_peak + voice->slow_coefficient * (voice->low_slow - low_peak);
      voice->voice_slow =
          above_peak + voice->slow_coefficient * (voice->voice_slow - above_peak);

      // The cut grows with how far the burst stands over both its own recent
      // low end (6 dB of jump allowed) and the voice above it.
      const double low_db = to_db(voice->plosive_fast);
      const double floor_db =
          std::max(to_db(voice->low_slow) + 6.0, to_db(voice->voice_slow));
      double target = 0.0;
      if (low_db > -40.0) {
        const double over = low_db - floor_db;
        target = -amount * clamp(over * 1.5, 0.0, FEQ_VOICE_PLOSIVE_MAX_CUT_DB);
      }
      const double k = target < voice->plosive_cut_db ? voice->plosive_attack
                                                      : voice->plosive_release;
      voice->plosive_cut_db = target + k * (voice->plosive_cut_db - target);
      deepest = std::min(deepest, voice->plosive_cut_db);
      // x + (1 - g)·(high - x): exactly x when nothing is cut, and the low
      // band down by the cut (high is ~0 there) while it lasts.
      const double keep = std::pow(10.0, voice->plosive_cut_db / 20.0);
      for (uint32_t c = 0; c < count; ++c) {
        if (channels[c] == nullptr) continue;
        const double x = channels[c][i];
        channels[c][i] = static_cast<float>(x + (1.0 - keep) * (high[c] - x));
      }
    }
  }
  voice->report_plosive_cut_db = static_cast<float>(deepest);
}

void feq_voice_process_gate(FeqVoice* voice, float* const* channels,
                            uint32_t frames) {
  if (voice == nullptr || channels == nullptr || voice->settings.enabled == 0 ||
      voice->settings.gate_enabled == 0) {
    if (voice != nullptr) voice->gate_gain_db = 0.0;
    return;
  }
  const uint32_t count = voice->channels;
  const double threshold = clamp(voice->settings.gate_threshold_db, -80.0, -10.0);
  const double range = clamp(voice->settings.gate_range_db, 0.0, 80.0);
  double gain_db = voice->gate_gain_db;
  double gain = std::pow(10.0, gain_db / 20.0);
  // Heard ahead for exactly this block, or not at all: flags left from
  // another block's length would open the gate on the wrong samples.
  const bool ahead = voice->ahead_frames == frames;
  voice->ahead_frames = 0;
  for (uint32_t i = 0; i < frames; ++i) {
    double sum = 0.0;
    for (uint32_t c = 0; c < count; ++c) {
      sum += channels[c] != nullptr ? channels[c][i] : 0.0;
    }
    double listened = sum / static_cast<double>(count);
    listened = tick(voice->listen_low_state, voice->listen_low, listened);
    listened = tick(voice->listen_high_state, voice->listen_high, listened);
    const double magnitude = std::fabs(listened);
    const double k = magnitude > voice->gate_envelope ? voice->gate_env_attack
                                                      : voice->gate_env_release;
    voice->gate_envelope = magnitude + k * (voice->gate_envelope - magnitude);
    const double level = to_db(voice->gate_envelope);

    double target = gain_db;
    if (level >= threshold || (ahead && voice->ahead_open[i] != 0)) {
      target = 0.0;
      voice->gate_hold_left = voice->gate_hold_samples;
    } else if (level < threshold - kGateHysteresisDb) {
      if (voice->gate_hold_left > 0) {
        --voice->gate_hold_left;
        target = 0.0;
      } else {
        target = -range;
      }
    }
    const double before = gain_db;
    if (target > gain_db) {
      gain_db = std::min(target, gain_db + voice->gate_open_step_db);
    } else if (target < gain_db) {
      gain_db = std::max(target, gain_db - voice->gate_close_step_db);
    }
    if (gain_db != before) gain = std::pow(10.0, gain_db / 20.0);
    if (gain_db != 0.0) {
      for (uint32_t c = 0; c < count; ++c) {
        if (channels[c] != nullptr) {
          channels[c][i] = static_cast<float>(channels[c][i] * gain);
        }
      }
    }
  }
  voice->gate_gain_db = gain_db;
}

void feq_voice_block_report(const FeqVoice* voice, FeqVoiceReport* out) {
  if (out == nullptr) return;
  *out = FeqVoiceReport{};
  if (voice == nullptr || voice->settings.enabled == 0) return;
  out->active = 1;
  out->gate_gain_db = static_cast<float>(voice->gate_gain_db);
  out->plosive_cut_db = voice->report_plosive_cut_db;
  out->gate_level_db = static_cast<float>(to_db(voice->gate_envelope));
  out->level_gain_db = static_cast<float>(voice->level.gain_db);
  out->level_heard_db = voice->level.report_level_db;
}

void feq_voice_process_level(FeqVoice* voice, float* const* channels,
                             uint32_t frames) {
  if (voice == nullptr || channels == nullptr) return;
  voice_level_process(voice->level, voice->settings, channels, voice->channels,
                      frames);
}

}  // extern "C"
