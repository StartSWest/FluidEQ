/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every mic profile's rack through the engine's own graph, on one channel at
 * 48 kHz in 10 ms blocks — what a USB headset's mic hands the engine. The
 * lines are the encoder's (`mic_profiles_fixture.h`).
 */

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

#include "fluideq_engine/config.h"
#include "fluideq_engine/graph.h"
#include "dsp_chain_fixture.h"
#include "graph_test_support.h"
#include "mic_profiles_fixture.h"

using fluideq_engine::Chain;
using fluideq_engine::Graph;
using fluideq_engine_test::endpoint;
using fluideq_engine_test::Files;
using fluideq_engine_test::kConfigDir;
using fluideq_engine_test::kConfigPath;
using fluideq_engine_test::kDspPath;
using fluideq_engine_test::kMicProfiles;
using fluideq_engine_test::kPi;
using fluideq_engine_test::kRate;
using fluideq_engine_test::MicProfileRow;
using fluideq_engine_test::provider;
using fluideq_engine_test::report;
using fluideq_engine_test::run_blocks;

namespace {

constexpr uint32_t kBlock = 480;

/** The file the app writes for a mic: low lag always, the line, CRLF. */
Chain chain_of(const char* line) {
  Files files;
  files[kDspPath] = std::string("# FluidEQ Engine DSP chain v1\r\n") +
                    "# FluidEQLowLatency: ON\r\n" + line + "\r\n";
  files[kConfigPath] = "";
  return fluideq_engine::resolve_chain(kConfigDir, endpoint(),
                                       provider(files));
}

/** Nothing for this endpoint: the graph the engine runs with no rack. */
Chain no_rack() {
  Files files;
  files[kConfigPath] = "";
  return fluideq_engine::resolve_chain(kConfigDir, endpoint(),
                                       provider(files));
}

/**
 * A loud voice: a 130 Hz glottal series to 5 kHz, syllables at 4.5 a second,
 * peaks within half a dB of full scale, and a 70 Hz thump at each syllable's
 * start the way a "p" lands on a close mic.
 */
std::vector<float> loud_voice(uint32_t frames) {
  std::vector<float> out(frames);
  for (uint32_t at = 0; at < frames; ++at) {
    const double t = static_cast<double>(at) / kRate;
    double voiced = 0.0;
    for (int h = 1; 130.0 * h < 5000.0; ++h) {
      voiced += std::sin(2.0 * kPi * 130.0 * h * t + 0.7 * h) / h;
    }
    const double phase = std::fmod(t * 4.5, 1.0);
    const double syllable = phase < 0.7 ? std::sin(kPi * phase / 0.7) : 0.0;
    const double thump =
        phase < 0.04 ? std::sin(2.0 * kPi * 70.0 * t) * (1.0 - phase / 0.04)
                     : 0.0;
    out[at] = static_cast<float>(0.55 * voiced * syllable + 0.6 * thump);
  }
  const float peak = *std::max_element(
      out.begin(), out.end(),
      [](float a, float b) { return std::fabs(a) < std::fabs(b); });
  const float scale = 0.95f / std::fabs(peak);
  for (float& sample : out) sample *= scale;
  return out;
}

/** A quiet room: white noise at `rms_db` dBFS, the same every run. */
std::vector<float> room(uint32_t frames, double rms_db) {
  std::vector<float> out(frames);
  uint32_t state = 0x2545F491u;
  const double gain = std::pow(10.0, rms_db / 20.0) * std::sqrt(3.0);
  for (float& sample : out) {
    state = state * 1664525u + 1013904223u;
    const double uniform = static_cast<double>(state) / 4294967296.0;
    sample = static_cast<float>(gain * (2.0 * uniform - 1.0));
  }
  return out;
}

std::vector<float> through(const Chain& chain, std::vector<float> signal) {
  Graph graph(chain, kRate, 1, kBlock);
  std::vector<std::vector<float>> channels{std::move(signal)};
  run_blocks(graph, channels, kBlock);
  return channels[0];
}

double peak_db(const std::vector<float>& samples, uint32_t from) {
  float peak = 0.0f;
  for (size_t at = from; at < samples.size(); ++at) {
    peak = std::max(peak, std::fabs(samples[at]));
  }
  return 20.0 * std::log10(std::max(peak, 1e-12f));
}

double rms_db(const std::vector<float>& samples, uint32_t from) {
  double sum = 0.0;
  for (size_t at = from; at < samples.size(); ++at) {
    sum += static_cast<double>(samples[at]) * samples[at];
  }
  return 10.0 * std::log10(sum / static_cast<double>(samples.size() - from) +
                           1e-30);
}

std::vector<float> scaled(std::vector<float> samples, double db) {
  const auto gain = static_cast<float>(std::pow(10.0, db / 20.0));
  for (float& sample : samples) sample *= gain;
  return samples;
}

constexpr uint32_t kFrames = kRate * 6;
constexpr double kRoomDb = -62.0;

void the_limiter_holds_its_ceiling_on_a_loud_voice() {
  std::printf("every limiter holds its ceiling on a voice at full scale\n");
  const std::vector<float> voice = loud_voice(kFrames);
  // Control: the voice is over every ceiling with nothing in the way, so a
  // rack that held it did the holding.
  const double bare = peak_db(through(no_rack(), voice), 0);
  CHECK(bare > -0.6);
  for (const MicProfileRow& row : kMicProfiles) {
    const double peak = peak_db(through(chain_of(row.line), voice), 0);
    std::printf("  %-10s ceiling %5.1f dB, peak %6.2f dB\n", row.id,
                row.ceiling_db, peak);
    CHECK(row.ceiling_db < 0.0);
    // From the first sample: a stream opens on a voice as often as on
    // silence.
    CHECK(peak <= row.ceiling_db + 0.01);
  }
}

void a_quiet_room_is_never_brought_up() {
  std::printf("a quiet room is never brought up by Voice level\n");
  const std::vector<float> quiet = room(kFrames, kRoomDb);
  // Control: the room passes at its own level with no rack.
  CHECK(std::fabs(rms_db(through(no_rack(), quiet), kRate) - kRoomDb) < 0.1);
  for (const MicProfileRow& row : kMicProfiles) {
    const double out = rms_db(through(chain_of(row.line), quiet), kRate);
    const double off =
        rms_db(through(chain_of(row.level_off_line), quiet), kRate);
    std::printf("  %-10s gate %d, room %6.2f dB, Voice level off %6.2f dB "
                "(may lift %.0f dB)\n",
                row.id, row.gate, out, off, row.room_allowance_db);
    // Voice level lifts a voice, never a room on its own: the room comes
    // out no louder than through the same rack with it off.
    CHECK(out < off + 1.0);
    // And that rack lifts it by no more than its make-up, drive and EQ
    // tilt: with Dynamics lifting what is quiet, Meetings' room came out
    // 8.8 dB over the input. (The voice cleaner needs its model, which
    // this test does not load, so a real room ends lower than these.)
    if (row.gate != 0) {
      CHECK(off < kRoomDb + row.room_allowance_db - 4.0);
    } else {
      CHECK(off < kRoomDb + row.room_allowance_db);
    }
  }
}

void a_quiet_voice_is_brought_up() {
  std::printf("a quiet voice is brought up, and an ordinary one passes\n");
  // Peaks at -38 dBFS: a soft talker, or a mic at arm's length — over its
  // room, after a second of the room alone, as a mic hands a voice in.
  // Voice level knows a voice by its standing over the room; syllables over
  // digital silence taught its floor the voice itself, and nothing moved.
  std::vector<float> quiet = room(kFrames, kRoomDb);
  {
    const std::vector<float> voice = scaled(loud_voice(kFrames), -37.6);
    for (size_t at = kRate; at < quiet.size(); ++at) quiet[at] += voice[at];
  }
  // Peaks at -18 dBFS: a headset mic at speaking level.
  const std::vector<float> ordinary = scaled(loud_voice(kFrames), -17.6);
  const double ordinary_in = rms_db(ordinary, kRate);
  for (const MicProfileRow& row : kMicProfiles) {
    const double lifted = rms_db(through(chain_of(row.line), quiet), 3 * kRate);
    const double control =
        rms_db(through(chain_of(row.level_off_line), quiet), 3 * kRate);
    const double passed =
        rms_db(through(chain_of(row.line), ordinary), kRate);
    std::printf("  %-10s quiet %6.2f dB (Voice level off %6.2f), ordinary "
                "%6.2f dB (in %6.2f)\n",
                row.id, lifted, control, passed, ordinary_in);
    // Every profile carries Voice level; the gentlest lifts 12 dB at most.
    CHECK(lifted > control + 3.0);
    // Voice level and the compressor's make-up give an ordinary voice back
    // what the compressor takes; a gate closing on the voice itself takes
    // 10 dB and more.
    CHECK(passed > ordinary_in - 6.0);
  }
}

}  // namespace

int main() {
  the_limiter_holds_its_ceiling_on_a_loud_voice();
  a_quiet_room_is_never_brought_up();
  a_quiet_voice_is_brought_up();
  return report();
}
