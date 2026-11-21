/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/voice.h"

#include <algorithm>
#include <cmath>
#include <new>

#include "fluideq/biquad.h"

namespace {

constexpr double kButterworthQ = 0.7071067811865476;
/** The gate listens between these, so a hum or a hiss does not open it. */
constexpr double kGateListenLowHz = 90.0;
constexpr double kGateListenHighHz = 7000.0;
/** The gate closes this far under where it opens, so a voice on the
 * threshold does not chatter it open and shut every few milliseconds. */
constexpr double kGateHysteresisDb = 4.0;
constexpr double kSilenceDb = -150.0;

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
  voice->report_plosive_cut_db = 0.0f;
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
    if (level >= threshold) {
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
}

}  // extern "C"
