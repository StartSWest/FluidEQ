/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Voice level (engine 1.33, `voice_level.h`) at every shared-mode rate: a
 * quiet voice brought to the target and a loud one down toward it, a room
 * on its own never lifted (beside the same room with a voice, which is),
 * the lift held through the pauses between sentences and let go after a
 * long silence, off exactly the input, and a rebuilt rack keeping the lift.
 *
 * The voice is a 140 Hz tone with its harmonics in syllables of 180 ms with
 * 120 ms between, in sentences of 2.4 s with 1 s between, over a room of
 * white noise: the shape a voice has to the level's 300 ms detector.
 */

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/voice.h"

namespace {

using feq_test::check;
constexpr double kPi = 3.14159265358979323846;
constexpr std::array<double, 8> kRates = {44100.0,  48000.0,  88200.0,
                                          96000.0,  176400.0, 192000.0,
                                          352800.0, 384000.0};
constexpr double kTarget = -18.0;

FeqVoiceSettings levelled(int on) {
  FeqVoiceSettings s{};
  feq_voice_settings_defaults(&s);
  s.enabled = 1;
  s.gate_enabled = 0;
  s.level_enabled = on;
  s.level_target_db = kTarget;
  s.level_max_lift_db = 24.0;
  return s;
}

/** Whether a voice speaks at `t`: syllables in sentences. */
bool speaking(double t) {
  if (std::fmod(t, 3.4) >= 2.4) return false;
  return std::fmod(t, 0.3) < 0.18;
}

/** The voice's harmonic tone, unit RMS over a syllable. */
double voice_at(double t) {
  double x = 0;
  for (int h = 1; h <= 6; ++h) x += std::sin(2 * kPi * 140 * h * t) / h;
  return x / 0.9;
}

struct Signal {
  double voice_db;  // the voice's RMS inside a syllable, dBFS
  double room_db;   // the room's RMS, dBFS
  bool talks;
};

struct Run {
  std::vector<float> out;
  std::vector<float> in;
  std::vector<float> gain;  // the level's gain at each block's end, dB
  uint32_t block = 0;
};

Run run(double rate, double seconds, const Signal& sig,
        const FeqVoiceSettings& s) {
  Run r;
  r.block = static_cast<uint32_t>(rate / 100.0);
  FeqVoice* voice = feq_voice_create(rate, 1);
  feq_voice_configure(voice, &s);
  const double v = std::pow(10, sig.voice_db / 20);
  const double room = std::pow(10, sig.room_db / 20) * std::sqrt(3.0);
  uint32_t seed = 7;
  const size_t frames = static_cast<size_t>(seconds * rate) / r.block * r.block;
  r.in.resize(frames);
  for (size_t i = 0; i < frames; ++i) {
    const double t = i / rate;
    seed = seed * 1664525u + 1013904223u;
    const double noise = (seed / 4294967296.0) * 2 - 1;
    r.in[i] = static_cast<float>(
        (sig.talks && speaking(t) ? v * voice_at(t) : 0.0) + room * noise);
  }
  r.out = r.in;
  for (size_t a = 0; a < frames; a += r.block) {
    float* planes[1] = {r.out.data() + a};
    feq_voice_process_level(voice, planes, r.block);
    FeqVoiceReport report{};
    feq_voice_block_report(voice, &report);
    r.gain.push_back(report.level_gain_db);
  }
  feq_voice_destroy(voice);
  return r;
}

/** The RMS of what spoke between `from` and `to` seconds, dBFS. */
double voiced_db(const std::vector<float>& x, double rate, double from,
                 double to) {
  double sum = 0;
  size_t n = 0;
  for (size_t i = static_cast<size_t>(from * rate);
       i < static_cast<size_t>(to * rate) && i < x.size(); ++i) {
    if (speaking(i / rate)) {
      sum += double(x[i]) * x[i];
      ++n;
    }
  }
  return 10 * std::log10(sum / std::max<size_t>(n, 1) + 1e-30);
}

float gain_at(const Run& r, double rate, double t) {
  const size_t at = static_cast<size_t>(t * rate) / r.block;
  return r.gain[std::min(at, r.gain.size() - 1)];
}

void at_rate(double rate) {
  // A quiet voice: syllables at -40 dBFS over a room 30 dB under them.
  const Run quiet = run(rate, 14, {-40, -70, true}, levelled(1));
  const double quiet_out = voiced_db(quiet.out, rate, 7.0, 14.0);
  // A loud one, far over the target.
  const Run loud = run(rate, 10, {-6, -60, true}, levelled(1));
  const double loud_out = voiced_db(loud.out, rate, 5.0, 10.0);
  // The room alone, loud for a room, and the same room with a voice.
  const Run room = run(rate, 12, {-40, -55, false}, levelled(1));
  const Run talked = run(rate, 12, {-40, -55, true}, levelled(1));
  float most_room_gain = 0;
  for (float g : room.gain) most_room_gain = std::max(most_room_gain, std::fabs(g));
  // Held through the 1 s between the third and fourth sentences.
  const float before_pause = gain_at(quiet, rate, 3 * 3.4 + 2.4);
  const float after_pause = gain_at(quiet, rate, 3 * 3.4 + 3.39);
  // A voice that stops: 6 s of speech, then nothing but the room.
  Signal stops{-40, -70, true};
  FeqVoiceSettings s = levelled(1);
  const Run spoke = run(rate, 6.8, stops, s);
  const float lifted = spoke.gain.back();
  stops.talks = false;
  // Continue the same voice into silence: one voice, played on.
  FeqVoice* voice = feq_voice_create(rate, 1);
  feq_voice_configure(voice, &s);
  {
    std::vector<float> buffer(spoke.in);
    for (size_t a = 0; a + spoke.block <= buffer.size(); a += spoke.block) {
      float* planes[1] = {buffer.data() + a};
      feq_voice_process_level(voice, planes, spoke.block);
    }
    const Run silence = run(rate, 1, stops, s);  // a block of room to repeat
    for (int second = 0; second < 18; ++second) {
      std::vector<float> chunk(silence.in);
      for (size_t a = 0; a + spoke.block <= chunk.size(); a += spoke.block) {
        float* planes[1] = {chunk.data() + a};
        feq_voice_process_level(voice, planes, spoke.block);
      }
    }
  }
  FeqVoiceReport let_go{};
  feq_voice_block_report(voice, &let_go);
  // A chain rebuilt mid-sentence keeps the lift.
  FeqVoice* rebuilt = feq_voice_create(rate, 1);
  feq_voice_configure(rebuilt, &s);
  feq_voice_transfer(rebuilt, voice);
  FeqVoiceReport kept{};
  feq_voice_block_report(rebuilt, &kept);
  feq_voice_destroy(rebuilt);
  feq_voice_destroy(voice);
  // Off is the input.
  const Run off = run(rate, 3, {-40, -70, true}, levelled(0));
  double worst = 0;
  for (size_t i = 0; i < off.in.size(); ++i) {
    worst = std::max(worst, std::fabs(double(off.out[i]) - off.in[i]));
  }

  std::printf("%6.0f Hz: quiet -40 -> %.1f (lift %.1f), loud -6 -> %.1f, "
              "room alone %.2f dB, room+voice %.1f dB, pause %.2f -> %.2f, "
              "after 18 s quiet %.1f -> %.1f, kept %.1f, off %.0e\n",
              rate, quiet_out, quiet.gain.back(), loud_out, most_room_gain,
              talked.gain.back(), before_pause, after_pause, lifted,
              let_go.level_gain_db, kept.level_gain_db, worst);
  // Within 1.5 dB: the level is the syllables' own power over 10 ms, held
  // through the gaps between them. The loud voice needs more than the 12 dB
  // of cut there is, and lands on it.
  check(std::fabs(quiet_out - kTarget) < 1.5,
        "a quiet voice is brought to the target");
  check(loud_out < kTarget + 1.5, "a loud voice is brought down to it");
  check(most_room_gain == 0.0f, "a room on its own is never lifted");
  check(talked.gain.back() > 6.0f, "the same room with a voice is (control)");
  check(std::fabs(after_pause - before_pause) < 0.01f,
        "the lift holds between sentences");
  check(lifted > 10.0f && let_go.level_gain_db < lifted - 10.0f,
        "after a long silence the lift is let go");
  check(std::fabs(kept.level_gain_db - let_go.level_gain_db) < 1e-6f,
        "a rebuilt rack keeps the lift");
  check(worst == 0.0, "off is exactly the input");
}

}  // namespace

int main() {
  for (const double rate : kRates) at_rate(rate);
  return feq_test::finish();
}
