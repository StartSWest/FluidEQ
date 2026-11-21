/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The microphone's Voice stage: low cut, proximity shelf, pop guard, gate.
 *
 * Each claim stands beside its control. The gate takes the room down AND
 * leaves a word at its level (a gate that only did the first would pass a
 * test that silenced everything). The pop guard takes a plosive's low burst
 * AND leaves a steady voice's low end alone. Off is the input to the bit.
 */

#include <cmath>
#include <cstdio>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/voice.h"

namespace {

using feq_test::check;
constexpr double kPi = 3.14159265358979323846;

/** Runs the whole stage over one mono buffer in 10 ms blocks. */
std::vector<float> run(double rate, const FeqVoiceSettings& settings,
                       std::vector<float> samples) {
  FeqVoice* voice = feq_voice_create(rate, 1);
  feq_voice_configure(voice, &settings);
  const size_t block = static_cast<size_t>(rate / 100.0);
  for (size_t at = 0; at < samples.size(); at += block) {
    const uint32_t frames =
        static_cast<uint32_t>(std::min(block, samples.size() - at));
    float* channel = samples.data() + at;
    float* const channels[1] = {channel};
    feq_voice_process_front(voice, channels, frames);
    feq_voice_process_gate(voice, channels, frames);
  }
  feq_voice_destroy(voice);
  return samples;
}

double rms_db(const std::vector<float>& s, size_t from, size_t to) {
  double sum = 0.0;
  for (size_t i = from; i < to; ++i) sum += static_cast<double>(s[i]) * s[i];
  const double value = std::sqrt(sum / static_cast<double>(to - from));
  return value > 1e-12 ? 20.0 * std::log10(value) : -240.0;
}

/** A tone at `hz` and `db` dBFS peak over [from, to), silence elsewhere. */
void add_tone(std::vector<float>& s, double rate, double hz, double db,
              size_t from, size_t to) {
  const double amplitude = std::pow(10.0, db / 20.0);
  for (size_t i = from; i < to && i < s.size(); ++i) {
    s[i] += static_cast<float>(amplitude * std::sin(2.0 * kPi * hz * i / rate));
  }
}

/** Steady pseudo-noise at `db` dBFS RMS, the room. */
void add_room(std::vector<float>& s, double db) {
  const double amplitude = std::pow(10.0, db / 20.0) * std::sqrt(3.0);
  uint32_t state = 12345u;
  for (float& x : s) {
    state = state * 1664525u + 1013904223u;
    const double r = (static_cast<double>(state) / 4294967296.0) * 2.0 - 1.0;
    x += static_cast<float>(amplitude * r);
  }
}

FeqVoiceSettings voice_on() {
  FeqVoiceSettings s{};
  feq_voice_settings_defaults(&s);
  s.enabled = 1;
  return s;
}

void off_is_the_input(double rate) {
  std::vector<float> input(static_cast<size_t>(rate), 0.0f);
  add_room(input, -50.0);
  add_tone(input, rate, 80.0, -12.0, 0, input.size());
  FeqVoiceSettings off{};
  feq_voice_settings_defaults(&off);
  off.low_cut_hz = 120.0;
  off.deplosive = 1.0;
  off.gate_enabled = 1;
  const std::vector<float> out = run(rate, off, input);
  bool same = true;
  for (size_t i = 0; i < input.size(); ++i) same = same && out[i] == input[i];
  check(same, "switched off, every setting set: the input to the bit");
}

/** The room between words comes down by the range; the word does not. */
void gate_takes_the_room_and_keeps_the_word(double rate) {
  const size_t n = static_cast<size_t>(rate * 2.0);
  std::vector<float> input(n, 0.0f);
  add_room(input, -60.0);
  // A word from 0.5 s to 1.0 s, well over the threshold.
  add_tone(input, rate, 300.0, -20.0, n / 4, n / 2);
  FeqVoiceSettings s = voice_on();
  s.gate_enabled = 1;
  s.gate_threshold_db = -45.0;
  s.gate_range_db = 30.0;
  s.gate_hold_ms = 100.0;
  s.gate_release_ms = 100.0;
  const std::vector<float> out = run(rate, s, input);
  const size_t quiet_from = static_cast<size_t>(rate * 1.5);
  const double room_in = rms_db(input, quiet_from, n);
  const double room_out = rms_db(out, quiet_from, n);
  const size_t word_from = n / 4 + static_cast<size_t>(rate * 0.05);
  const double word_in = rms_db(input, word_from, n / 2);
  const double word_out = rms_db(out, word_from, n / 2);
  std::printf("  gate: room %.1f -> %.1f dB, word %.2f -> %.2f dB\n", room_in,
              room_out, word_in, word_out);
  check(room_out < room_in - 28.0, "the room between words is down by the range");
  check(std::fabs(word_out - word_in) < 0.1, "the word keeps its level");

  // Control: a gate with no range changes nothing anywhere.
  s.gate_range_db = 0.0;
  const std::vector<float> open = run(rate, s, input);
  check(std::fabs(rms_db(open, quiet_from, n) - room_in) < 0.01,
        "control: no range, the room is untouched");
}

/** A small range is an expander: the room comes down by that much only. */
void small_range_is_an_expander(double rate) {
  const size_t n = static_cast<size_t>(rate);
  std::vector<float> input(n, 0.0f);
  add_room(input, -60.0);
  FeqVoiceSettings s = voice_on();
  s.gate_enabled = 1;
  s.gate_threshold_db = -40.0;
  s.gate_range_db = 8.0;
  s.gate_hold_ms = 0.0;
  const std::vector<float> out = run(rate, s, input);
  const double drop = rms_db(input, n / 2, n) - rms_db(out, n / 2, n);
  std::printf("  expander: room down %.2f dB at an 8 dB range\n", drop);
  check(std::fabs(drop - 8.0) < 0.1, "the room comes down by the range exactly");
}

/** The low cut takes rumble and leaves the voice band. */
void low_cut_takes_rumble(double rate) {
  const size_t n = static_cast<size_t>(rate);
  std::vector<float> rumble(n, 0.0f);
  add_tone(rumble, rate, 40.0, -12.0, 0, n);
  std::vector<float> speech(n, 0.0f);
  add_tone(speech, rate, 1000.0, -12.0, 0, n);
  FeqVoiceSettings s = voice_on();
  s.low_cut_hz = 120.0;
  const double rumble_drop =
      rms_db(rumble, n / 2, n) - rms_db(run(rate, s, rumble), n / 2, n);
  const double speech_drop =
      rms_db(speech, n / 2, n) - rms_db(run(rate, s, speech), n / 2, n);
  std::printf("  low cut 120 Hz: 40 Hz down %.1f dB, 1 kHz down %.2f dB\n",
              rumble_drop, speech_drop);
  check(rumble_drop > 15.0, "40 Hz rumble is cut");
  check(speech_drop < 0.1, "1 kHz is untouched");
}

/** "Close to the mic" takes the low end down and leaves the voice. */
void proximity_takes_the_low_end(double rate) {
  const size_t n = static_cast<size_t>(rate);
  std::vector<float> low(n, 0.0f);
  add_tone(low, rate, 60.0, -12.0, 0, n);
  std::vector<float> mid(n, 0.0f);
  add_tone(mid, rate, 2000.0, -12.0, 0, n);
  FeqVoiceSettings s = voice_on();
  s.proximity_db = 6.0;
  const double low_drop = rms_db(low, n / 2, n) - rms_db(run(rate, s, low), n / 2, n);
  const double mid_drop = rms_db(mid, n / 2, n) - rms_db(run(rate, s, mid), n / 2, n);
  std::printf("  proximity 6 dB: 60 Hz down %.2f dB, 2 kHz down %.2f dB\n",
              low_drop, mid_drop);
  check(std::fabs(low_drop - 6.0) < 0.6, "60 Hz is down by the shelf");
  check(mid_drop < 0.1, "2 kHz is untouched");
}

/**
 * A plosive: a 20 ms burst at 60 Hz far over a quiet voice. The guard takes
 * it down; a steady voice with an ordinary low end is left alone.
 */
void pop_guard_takes_the_burst_and_keeps_the_voice(double rate) {
  const size_t n = static_cast<size_t>(rate * 2.0);
  std::vector<float> input(n, 0.0f);
  add_tone(input, rate, 500.0, -30.0, 0, n);  // a quiet voice throughout
  const size_t pop_at = n / 2;
  const size_t pop_len = static_cast<size_t>(rate * 0.02);
  add_tone(input, rate, 60.0, -6.0, pop_at, pop_at + pop_len);
  FeqVoiceSettings s = voice_on();
  s.deplosive = 1.0;
  const std::vector<float> out = run(rate, s, input);
  const double pop_in = rms_db(input, pop_at, pop_at + pop_len);
  const double pop_out = rms_db(out, pop_at, pop_at + pop_len);
  std::printf("  pop guard: burst %.1f -> %.1f dB\n", pop_in, pop_out);
  check(pop_out < pop_in - 6.0, "the plosive's burst is taken down");

  // Control: the same voice with a steady low end, nothing sudden.
  std::vector<float> steady(n, 0.0f);
  add_tone(steady, rate, 500.0, -30.0, 0, n);
  add_tone(steady, rate, 120.0, -32.0, 0, n);
  const std::vector<float> kept = run(rate, s, steady);
  const double change = rms_db(steady, n / 2, n) - rms_db(kept, n / 2, n);
  std::printf("  pop guard on a steady voice: %.3f dB\n", change);
  check(std::fabs(change) < 0.05, "control: a steady voice keeps its low end");
}

/** A chain replaced mid-word keeps the gate where it was. */
void transfer_keeps_the_gate(double rate) {
  FeqVoiceSettings s = voice_on();
  s.gate_enabled = 1;
  s.gate_threshold_db = -30.0;
  s.gate_range_db = 40.0;
  s.gate_hold_ms = 0.0;
  s.gate_release_ms = 20.0;
  FeqVoice* old_chain = feq_voice_create(rate, 1);
  feq_voice_configure(old_chain, &s);
  std::vector<float> quiet(static_cast<size_t>(rate * 0.5), 0.0f);
  add_room(quiet, -70.0);
  float* const ch[1] = {quiet.data()};
  feq_voice_process_gate(old_chain, ch, static_cast<uint32_t>(quiet.size()));
  FeqVoiceReport before{};
  feq_voice_block_report(old_chain, &before);
  FeqVoice* new_chain = feq_voice_create(rate, 1);
  feq_voice_configure(new_chain, &s);
  feq_voice_transfer(new_chain, old_chain);
  FeqVoiceReport after{};
  feq_voice_block_report(new_chain, &after);
  std::printf("  transfer: gate %.1f dB -> %.1f dB\n", before.gate_gain_db,
              after.gate_gain_db);
  check(before.gate_gain_db < -39.0, "the gate had closed");
  check(after.gate_gain_db == before.gate_gain_db,
        "the replacing chain starts where the gate was");
  feq_voice_destroy(old_chain);
  feq_voice_destroy(new_chain);
}

}  // namespace

int main() {
  for (const double rate : {16000.0, 44100.0, 48000.0, 96000.0}) {
    std::printf("rate %.1f kHz\n", rate / 1000.0);
    off_is_the_input(rate);
    gate_takes_the_room_and_keeps_the_word(rate);
    small_range_is_an_expander(rate);
    low_cut_takes_rumble(rate);
    proximity_takes_the_low_end(rate);
    pop_guard_takes_the_burst_and_keeps_the_voice(rate);
    transfer_keeps_the_gate(rate);
  }
  return feq_test::finish();
}
