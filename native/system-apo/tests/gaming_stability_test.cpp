/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// Render the app's actual preset wires through the graph used by APOProcess.
// A tagged continuous bed distinguishes lifted steps from global gain riding.
#include "dsp_chain_fixture.h"
#include "graph_test_support.h"
#include "../src/room_head.h"
#include "../src/source_analysis.h"
#include "../../dsp-core/tests/footsteps_scene.h"
#include "fluideq/primitives.h"

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iterator>

namespace {
using namespace fluideq_engine_test;
using Audio = std::vector<std::vector<float>>;
constexpr double kTag = 110.0;
constexpr uint32_t kFrames = 48000 * 12;

Audio scene(bool steps, double step_db, int music) {
  Audio audio(2, std::vector<float>(kFrames));
  for (size_t c = 0; c < 2; ++c) {
    for (uint32_t i = 0; i < kFrames; ++i) {
      const double t = static_cast<double>(i) / kRate;
      const double phase = c == 0 ? 0.0 : 0.7;
      const double beat = music == 0 ? 1.0 : 0.65 + 0.35 * std::cos(2 * kPi * 2 * t);
      const double voice = t > 6 && t < 8 ? 0.05 * (0.5 + 0.5 * std::sin(2 * kPi * 4 * t)) *
          (std::sin(2 * kPi * 640 * t) + 0.4 * std::sin(2 * kPi * 1280 * t)) : 0;
      audio[c][i] = static_cast<float>(0.12 * std::sin(2 * kPi * kTag * t + phase) +
          beat * (0.025 * std::sin(2 * kPi * 523 * t - phase) +
          (music == 2 ? 0.035 : 0.008) * std::sin(2 * kPi * 3100 * t + phase)) + voice);
    }
  }
  feq_footsteps_test::Random random;
  if (steps) {
    for (const double at : {3.0, 3.7, 4.4, 5.1, 6.4, 7.1, 9.6, 10.3}) {
      const auto step = feq_footsteps_test::footstep(kRate, random);
      for (size_t i = 0; i < step.size(); ++i) {
        const size_t n = static_cast<size_t>(at * kRate) + i;
        for (size_t c = 0; c < 2; ++c) audio[c][n] += static_cast<float>(step[i] *
            std::pow(10.0, step_db / 20.0) * (c == 0 ? 1.0 : 0.35));
      }
    }
  }
  // Both renders carry the same blast: subtracting a different explosion
  // from a tagged bass note measures interference, not background gain.
  feq_footsteps_test::Random blast_random;
  {
    const auto blast = feq_footsteps_test::explosion(kRate, blast_random);
    for (size_t i = 0; i < blast.size(); ++i) {
      const size_t n = 9 * kRate + i;
      if (n < kFrames) for (auto& channel : audio) channel[n] += static_cast<float>(blast[i] * 0.65);
    }
  }
  return audio;
}

void set_lift(std::vector<double>& values, double lift) {
  const auto tag = std::find(values.begin(), values.end(), FEQ_CHAIN_FOOTSTEPS_TAG);
  CHECK(tag != values.end());
  if (tag != values.end()) values[static_cast<size_t>(tag - values.begin()) + 5] = lift;
}

fluideq_engine::Chain gaming_chain(const std::vector<double>& values, bool normalize) {
  FeqChainSettings settings{};
  CHECK(feq_chain_settings_decode(values.data(), static_cast<uint32_t>(values.size()), &settings));
  // The trailer tells the rack what the later Preset layer does. Resolve
  // that actual layer too, or its inverse in the rack cancels a curve the
  // test never plays, and the measured peaks describe a different signal.
  std::string config = settings.tone.matched ? "# FluidEQFilterDesign: MATCHED\n" : "";
  for (uint32_t b = 0; b < settings.tone.band_count; ++b) {
    const auto& band = settings.tone.bands[b];
    const char* type = band.type == FEQ_FILTER_LSC ? "LSC" : band.type == FEQ_FILTER_HSC ? "HSC" : "PK";
    config += "Filter: ON " + std::string(type) + " Fc " + std::to_string(band.frequency) +
      " Hz Gain " + std::to_string(band.gain_db) + " dB Q " + std::to_string(band.quality) + "\n";
  }
  if (normalize) config += "# FluidEQAutoPreamp: ON\n";
  return chain_with(values, config);
}

Audio render(const Audio& in, std::vector<double> values, uint32_t& delay,
             bool without_lift = false, bool normalize = false,
             const fluideq_engine::RoomHead* room_head = nullptr) {
  if (without_lift) set_lift(values, 0);
  fluideq_engine::Graph graph(gaming_chain(values, normalize), kRate, 2, 480,
                              nullptr, 0, room_head);
  CHECK(mentions(graph.active_stages(), "footsteps"));
  if (room_head) CHECK(mentions(graph.active_stages(), "room"));
  delay = graph.latency_frames();
  Audio out = in;
  run_blocks(graph, out, 480);
  return out;
}

double tag_db(const Audio& audio, size_t at) {
  double sine = 0, cosine = 0;
  for (size_t i = 0; i < 4800; ++i) {
    const double phase = 2 * kPi * kTag * static_cast<double>(i) / kRate;
    sine += audio[0][at + i] * std::sin(phase);
    cosine += audio[0][at + i] * std::cos(phase);
  }
  return 20 * std::log10(std::hypot(sine, cosine) / 2400 + 1e-20);
}

double difference_energy(const Audio& mix, const Audio& bed, size_t from,
                         size_t to, uint32_t delay, size_t channel) {
  double sum = 0;
  for (size_t i = from; i < to; ++i) {
    const double delta = mix[channel][i + delay] - bed[channel][i + delay];
    sum += delta * delta;
  }
  return sum;
}

void wav(const std::filesystem::path& file, const Audio& audio) {
  const auto frames = static_cast<uint32_t>(audio[0].size());
  std::ofstream out(file, std::ios::binary);
  const auto word = [&](uint32_t value, int bytes) {
    for (int i = 0; i < bytes; ++i) out.put(static_cast<char>((value >> (8 * i)) & 255));
  };
  out.write("RIFF", 4); word(36 + frames * 8, 4); out.write("WAVEfmt ", 8);
  word(16, 4); word(3, 2); word(2, 2); word(kRate, 4); word(kRate * 8, 4);
  word(8, 2); word(32, 2); out.write("data", 4); word(frames * 8, 4);
  for (size_t i = 0; i < frames; ++i) for (const auto& c : audio)
    out.write(reinterpret_cast<const char*>(&c[i]), 4);
  CHECK(out.good());
}

constexpr double kScoreHz[] = {100, 300, 500, 900, 1500, 2400, 3100, 4200, 7000};
constexpr double kScoreAmplitude[] = {0.18, 0.035, 0.042, 0.025, 0.023, 0.022, 0.024, 0.013, 0.012};
constexpr double kCueTimes[] = {2.8, 3.4, 3.9, 4.4, 5.4, 6.0, 6.3, 6.9, 8.4, 9.6, 10.1, 11.0, 12.4, 13.1, 14.5};
constexpr double kCueLevel[] = {0.06, 0.09, 0.16, 0.09, 0.08, 0.15, 0.19, 0.065, 0.11, 0.15, 0.17, 0.09, 0.18, 0.10, 0.11};

Audio arena_score(double peak, bool cues, bool narrow, bool change_music = false) {
  Audio out(2, std::vector<float>(16 * kRate));
  double largest = 0.0, filtered = 0.0, body = 0.0;
  size_t event = 0;
  uint32_t seed = 17839;
  for (size_t i = 0; i < out[0].size(); ++i) {
    const double time = static_cast<double>(i) / kRate;
    double music = 0.0;
    for (size_t note = 0; note < std::size(kScoreHz); ++note) {
      double hz = narrow && note == 5 ? 2370.0 : kScoreHz[note];
      if (change_music && time >= 5.0) hz += 200.0;
      music += kScoreAmplitude[note] * std::sin(2 * kPi * hz * time + note * 0.71);
    }
    music *= 0.88 + 0.12 * std::sin(2 * kPi * 0.2 * time);
    if (event + 1 < std::size(kCueTimes) && time >= kCueTimes[event + 1]) ++event;
    const double since = time - kCueTimes[event];
    seed = seed * 1664525u + 1013904223u;
    filtered += 0.22 * (seed / 2147483648.0 - 1.0 - filtered);
    body += 0.025 * (filtered - body);
    double cue = 0.0;
    if (since >= 0.0 && since < 0.22) {
      const double envelope = (1 - std::exp(-since / 0.002)) * std::exp(-since / 0.062);
      cue = kCueLevel[event] * envelope * (2 * (filtered - body) +
          0.2 * std::sin(2 * kPi * (1100 * since + 4000 * since * since)));
    }
    // Orthogonal stems let one render expose actual bed modulation and cue
    // gain. Subtracting two unrelated detections cannot separate the stems.
    out[0][i] = static_cast<float>(music + (cues ? cue : 0));
    out[1][i] = static_cast<float>(music - (cues ? cue : 0));
    largest = std::max(largest, std::fabs(music) + std::fabs(cue));
  }
  for (auto& channel : out) for (float& x : channel) x = static_cast<float>(x * peak / largest);
  return out;
}

double mid(const Audio& audio, size_t at) {
  return 0.5 * (audio[0][at] + audio[1][at]);
}

double side(const Audio& audio, size_t at) {
  return 0.5 * (audio[0][at] - audio[1][at]);
}

double tone_power(const Audio& audio, double hz, size_t from, size_t span) {
  double sine = 0.0, cosine = 0.0;
  for (size_t i = 0; i < span; ++i) {
    const double phase = 2 * kPi * hz * i / kRate;
    const double x = mid(audio, from + i);
    sine += x * std::sin(phase);
    cosine += x * std::cos(phase);
  }
  return sine * sine + cosine * cosine;
}

struct ArenaMeasure {
  double bed = 0.0, tone = 0.0, cue = 0.0;
  double tone_at = 0.0;
  double tone_hz = 0.0;
};

ArenaMeasure compare_arena(const Audio& reference, const Audio& output, uint32_t delay,
                           bool change_music = false) {
  ArenaMeasure measured;
  double cue_in = 0.0, cue_out = 0.0;
  constexpr size_t span = kRate / 20;
  for (size_t at = 2 * kRate + delay; at + span < output[0].size(); at += span) {
    double a = 0.0, b = 0.0;
    for (size_t i = at; i < at + span; ++i) {
      a += mid(reference, i) * mid(reference, i);
      b += mid(output, i) * mid(output, i);
      cue_in += side(reference, i) * side(reference, i);
      cue_out += side(output, i) * side(output, i);
    }
    measured.bed = std::max(measured.bed, std::fabs(10 * std::log10(b / a)));
    for (double hz : kScoreHz) {
      if (change_music && at - delay >= 5 * kRate) hz += 200.0;
      const double change = 10 * std::log10(tone_power(output, hz, at, span) /
                                            tone_power(reference, hz, at, span));
      if (std::fabs(change) > measured.tone) {
        measured.tone = std::fabs(change);
        measured.tone_at = static_cast<double>(at - delay) / kRate;
        measured.tone_hz = hz;
      }
    }
  }
  if (cue_in > 0) measured.cue = 10 * std::log10(cue_out / cue_in);
  return measured;
}

double true_peak(const Audio& audio) {
  double peak = 0.0;
  for (const auto& channel : audio) {
    FeqTruePeak meter{};
    feq_true_peak_init(&meter, 4);
    peak = std::max(peak, feq_true_peak_block(&meter, channel.data(),
        static_cast<uint32_t>(channel.size())));
  }
  return peak;
}

void heroes_has_body_and_presence(std::vector<double> values) {
  constexpr double hz[] = {80, 315, 2200, 8000, 12500};
  Audio tones(2, std::vector<float>(std::size(hz) * kRate));
  for (size_t tone = 0; tone < std::size(hz); ++tone) {
    for (size_t i = 0; i < kRate; ++i) {
      const double phase = 2 * kPi * hz[tone] * static_cast<double>(i) / kRate;
      const float x = static_cast<float>(0.06 * std::sin(phase));
      tones[0][tone * kRate + i] = x;
      tones[1][tone * kRate + i] = x;
    }
  }
  uint32_t delay = 0;
  // At a level well below the ceiling, measure the actual preset curve.
  // The transient lift is covered separately by the music and cue tests.
  const Audio out = render(tones, values, delay, true);
  double gain[std::size(hz)] = {};
  for (size_t tone = 0; tone < std::size(hz); ++tone) {
    double before = 0.0, after = 0.0;
    for (size_t i = tone * kRate + kRate / 4;
         i < tone * kRate + 3 * kRate / 4; ++i) {
      before += tones[0][i] * tones[0][i];
      after += out[0][i + delay] * out[0][i + delay];
    }
    gain[tone] = 10 * std::log10(after / before);
  }
  std::printf("Heroes tone: body %.2f dB, low mids %.2f dB, presence %.2f dB, highs %.2f/%.2f dB\n",
              gain[0], gain[1], gain[2], gain[3], gain[4]);
  CHECK(gain[0] - gain[1] > 3.0);
  CHECK(gain[2] - gain[1] > 2.5);
  CHECK(std::fabs(gain[3]) < 1.0 && std::fabs(gain[4]) < 0.75);
}

void heroes_does_not_ride_the_score(std::vector<double> values, bool narrow) {
  for (const double peak : {0.38, 0.93}) {
    const Audio input = arena_score(peak, true, narrow);
    for (const bool normalize : {false, true}) {
      uint32_t delay = 0;
      const Audio reference = render(input, values, delay, true, normalize);
      const uint32_t reference_delay = delay;
      for (const double lift : {0.35, 0.6, 1.0}) {
        if (narrow && lift != 1) continue;
        set_lift(values, lift);
        const Audio out = render(input, values, delay, false, normalize);
        const ArenaMeasure m = compare_arena(reference, out, delay);
        const double tp = true_peak(out);
        std::printf("Heroes narrow=%d auto=%d peak=%.2f lift=%.2f: bed %.3f dB, in-band %.3f dB, cues +%.3f dB, TP %.4f\n",
                    narrow, normalize, peak, lift, m.bed, m.tone, m.cue, tp);
        CHECK(delay == reference_delay);
        CHECK(m.bed < 0.2);
        // The narrow variant tests peak reserve with a deliberately extreme
        // curve. Its side signal may have no remaining headroom.
        if (!narrow) {
          CHECK(m.tone < 0.55);
          CHECK(m.cue > (peak < 0.9 ? lift * 2.0 : lift * 0.6));
        } else if (peak < 0.9) {
          CHECK(m.cue > 0.4);
        }
        CHECK(tp < 0.90);
      }
    }
  }
  if (narrow) return;
  const Audio music = arena_score(0.38, false, false);
  uint32_t delay = 0;
  const Audio quiet = render(music, values, delay, true);
  const Audio listening = render(music, values, delay);
  const auto m = compare_arena(quiet, listening, delay);
  std::printf("Heroes score alone at maximum: bed %.3f dB, in-band %.3f dB\n", m.bed, m.tone);
  CHECK(m.bed < 0.05);
  CHECK(m.tone < 0.15);
}

void heroes_adapts_to_new_music(std::vector<double> values) {
  const Audio input = arena_score(0.38, true, false, true);
  uint32_t delay = 0;
  const Audio dry = render(input, values, delay, true);
  const uint32_t dry_delay = delay;
  set_lift(values, 0.6);
  const Audio out = render(input, values, delay);
  const auto m = compare_arena(dry, out, delay, true);
  std::printf("Heroes continuous music change: bed %.3f dB, in-band %.3f dB at %.2f s (%.0f Hz), cues +%.3f dB\n",
              m.bed, m.tone, m.tone_at, m.tone_hz, m.cue);
  CHECK(delay == dry_delay);
  CHECK(m.bed < 0.2 && m.tone < 0.55);
  CHECK(m.cue > 1.2);
}

void heroes_room_keeps_the_hot_score_steady(const std::vector<double>& values,
                                            const char* head_file) {
  std::ifstream file(head_file, std::ios::binary);
  CHECK(file.good());
  if (!file) return;
  const std::string text{std::istreambuf_iterator<char>(file),
                         std::istreambuf_iterator<char>()};
  const auto head = fluideq_engine::parse_room_head(text, kRate);
  CHECK(head.has_value());
  if (!head) return;

  const Audio input = arena_score(0.93, true, false, true);
  uint32_t dry_delay = 0, delay = 0;
  const Audio dry = render(input, values, dry_delay, true, false, &*head);
  const Audio out = render(input, values, delay, false, false, &*head);
  const auto m = compare_arena(dry, out, delay, true);
  const double peak = true_peak(out);
  std::printf("Heroes with Room, hot music change: bed %.3f dB, in-band %.3f dB, cues +%.3f dB, TP %.4f, latency %u frames\n",
              m.bed, m.tone, m.cue, peak, delay);
  CHECK(delay == dry_delay);
  CHECK(m.bed < 0.2 && m.tone < 0.55);
  CHECK(m.cue > 0.1);
  CHECK(peak < 0.90);
}

Audio switch_heroes(const std::vector<double>& on, uint32_t& delay, bool change_music) {
  auto off = on;
  const auto tag = std::find(off.begin(), off.end(), FEQ_CHAIN_FOOTSTEPS_TAG);
  CHECK(tag != off.end());
  if (tag == off.end()) return {};
  off.erase(tag, tag + FEQ_CHAIN_GAME_TRAILER);
  fluideq_engine::Graph first(gaming_chain(on, false), kRate, 2, 480);
  fluideq_engine::Graph bypassed(gaming_chain(off, false), kRate, 2, 480);
  fluideq_engine::Graph again(gaming_chain(on, false), kRate, 2, 480);
  delay = first.latency_frames();
  CHECK(bypassed.latency_frames() == delay && again.latency_frames() == delay);
  Audio out = arena_score(0.38, true, false, change_music);
  auto* current = &first;
  for (size_t i = 0; i < out[0].size(); i += 480) {
    if (i == 4 * kRate) {
      bypassed.adopt_state(current);
      current = &bypassed;
    } else if (i == 6 * kRate) {
      again.adopt_state(current);
      current = &again;
    }
    float* block[] = {out[0].data() + i, out[1].data() + i};
    current->process(block, 480);
  }
  return out;
}

void heroes_filter_switch(const std::vector<double>& on, bool change_music) {
  auto reference = on;
  set_lift(reference, 0);
  uint32_t delay = 0, dry_delay = 0;
  const Audio out = switch_heroes(on, delay, change_music);
  // Use the same graph replacements in the reference. The rack transition
  // itself can affect the first block even when the lift is already zero.
  const Audio dry = switch_heroes(reference, dry_delay, change_music);
  CHECK(!out.empty() && !dry.empty() && delay == dry_delay);
  if (out.empty() || dry.empty()) return;
  const auto m = compare_arena(dry, out, delay, change_music);
  std::printf("Heroes switching (music changes=%d): bed %.3f dB, in-band %.3f dB at %.2f s (%.0f Hz), cues +%.3f dB, latency %u frames\n",
              change_music, m.bed, m.tone, m.tone_at, m.tone_hz, m.cue, delay);
  CHECK(m.bed < 0.2 && m.tone < 0.55);
  CHECK(m.cue > 0.8);
  for (size_t i = 5 * kRate; i < 6 * kRate; ++i) {
    CHECK(std::fabs(out[0][i] - dry[0][i]) < 1e-6);
    CHECK(std::fabs(out[1][i] - dry[1][i]) < 1e-6);
  }
}
}

int main(int argc, char** argv) {
  if (argc < 2) return 2;
  if (argc == 3 && std::string(argv[1]) == "--sources") {
    const std::filesystem::path directory(argv[2]);
    wav(directory / "game-mixed.wav", scene(true, -24.0, 1));
    wav(directory / "game-hot.wav", arena_score(0.93, true, false, true));
    return report();
  }
  // Optional offline listening export. Input is explicit 48 kHz stereo
  // f32le, converted by ffmpeg without ever opening an output device.
  if ((argc == 6 || argc == 7) && std::string(argv[1]) == "--render") {
    std::ifstream fixture(argv[2]);
    std::string preset;
    uint32_t size = 0;
    while (fixture >> preset >> size) {
      std::vector<double> values(size);
      for (double& v : values) fixture >> v;
      CHECK(!fixture.fail());
      if (preset != argv[4]) continue;
      std::ifstream raw(argv[3], std::ios::binary | std::ios::ate);
      const auto bytes = static_cast<size_t>(raw.tellg());
      if (!raw || bytes == 0 || bytes % 8 != 0) return 2;
      raw.seekg(0);
      std::vector<float> samples(bytes / 4);
      raw.read(reinterpret_cast<char*>(samples.data()), static_cast<std::streamsize>(bytes));
      CHECK(raw.good());
      Audio in(2, std::vector<float>(samples.size()/2));
      for (size_t i = 0; i < in[0].size(); ++i) {
        in[0][i] = samples[2*i]; in[1][i] = samples[2*i+1];
      }
      std::optional<fluideq_engine::RoomHead> head;
      if (argc == 7) {
        std::ifstream file(argv[6], std::ios::binary);
        if (!file) return 2;
        const std::string text{std::istreambuf_iterator<char>(file),
                               std::istreambuf_iterator<char>()};
        head = fluideq_engine::parse_room_head(text, kRate);
        if (!head) return 2;
      }
      const fluideq_engine::SourceAnalysis source{};
      fluideq_engine::Graph graph(gaming_chain(values, false), kRate, 2, 480,
                                  nullptr, 0, head ? &*head : nullptr,
                                  false, nullptr, &source);
      if (head) CHECK(mentions(graph.active_stages(), "room"));
      const uint32_t delay = graph.latency_frames();
      const auto frames = in[0].size();
      for (auto& channel : in) channel.resize(frames + delay);
      run_blocks(graph, in, 480);
      Audio aligned(2, std::vector<float>(frames));
      for (size_t c = 0; c < 2; ++c)
        std::copy(in[c].begin() + delay, in[c].end(), aligned[c].begin());
      wav(argv[5], aligned);
      std::printf("rendered %s: %zu frames, aligned %u frames\n", preset.c_str(), aligned[0].size(), delay);
      return report();
    }
    return 2;
  }
  std::ifstream input(argv[1]);
  const bool heroes_only = argc >= 3 && std::string(argv[2]) == "--heroes";
  const bool check_room = heroes_only && argc == 4;
  std::string id;
  uint32_t count = 0;
  size_t tested = 0;
  while (input >> id >> count) {
    std::vector<double> values(count);
    for (double& v : values) input >> v;
    CHECK(!input.fail());
    if (id == "title-hots-room") {
      if (check_room) {
        heroes_room_keeps_the_hot_score_steady(values, argv[3]);
        ++tested;
      }
      continue;
    }
    if (heroes_only) {
      if (id == "title-hots-full" || id == "title-hots-narrow") {
        heroes_does_not_ride_the_score(values, id == "title-hots-narrow");
        if (id == "title-hots-full") {
          heroes_has_body_and_presence(values);
          heroes_adapts_to_new_music(values);
          heroes_filter_switch(values, false);
          heroes_filter_switch(values, true);
        }
        ++tested;
      }
      continue;
    }
    if (id == "title-hots-narrow") continue;
    for (int music = 0; music < 3; ++music) {
      for (const double level : {-38.0, -20.0}) {
        const Audio bed = scene(false, level, music);
        const Audio mix = scene(true, level, music);
        uint32_t delay = 0;
        const Audio bed_out = render(bed, values, delay);
        const Audio out = render(mix, values, delay);
        double least = 1e9, most = -1e9, peak = 0;
        double bed_least = 1e9, bed_most = -1e9;
        for (size_t i = 2 * kRate; i + 4800 + delay < kFrames; i += 4800) {
          const double shift = tag_db(out, i + delay) - tag_db(bed_out, i + delay);
          least = std::min(least, shift); most = std::max(most, shift);
          if (i < 8 * kRate) {
            const double bed_gain = tag_db(bed_out, i + delay) - tag_db(bed, i);
            bed_least = std::min(bed_least, bed_gain);
            bed_most = std::max(bed_most, bed_gain);
          }
        }
        for (const auto& c : out) for (const float x : c) peak = std::max(peak, std::fabs(static_cast<double>(x)));
        std::printf("%s music=%d step=%.0f step_bed_min=%.3f step_bed_max=%.3f music_drift=%.3f peak=%.3f delay=%u\n", id.c_str(), music, level, least, most, bed_most-bed_least, peak, delay);
        const bool steady = id.find("game-night") == std::string::npos;
        if (steady) {
          CHECK(bed_most - bed_least < 0.25);
          CHECK(least > -0.25 && most < 0.25);
        }
        CHECK(peak < 0.999);
        if (music == 0 && steady) {
          const Audio reference_bed = render(bed, values, delay, true);
          const Audio reference_mix = render(mix, values, delay, true);
          double cue_gain = 1e9;
          for (const double at : {3.0, 3.7, 4.4, 5.1}) {
            const size_t from = static_cast<size_t>(at * kRate), to = from + 4800;
            const double left = difference_energy(out, bed_out, from, to, delay, 0);
            const double right = difference_energy(out, bed_out, from, to, delay, 1);
            const double ref_l = difference_energy(reference_mix, reference_bed, from, to, delay, 0);
            const double ref_r = difference_energy(reference_mix, reference_bed, from, to, delay, 1);
            cue_gain = std::min(cue_gain, 10 * std::log10((left+right)/(ref_l+ref_r)));
          }
          // This counterfactual includes changed music. The separate stems
          // test measures actual step gain and pan from one detector run.
          std::printf("%s step=%.0f incremental_window_energy_gain=%.3f\n", id.c_str(), level, cue_gain);
          CHECK(cue_gain > 0.2);
        }
        std::fflush(stdout);
        if (argc > 2 && music == 1 && level == -20) {
          wav(std::filesystem::path(argv[2]) / (id + "-original.wav"), mix);
          wav(std::filesystem::path(argv[2]) / (id + "-processed.wav"), out);
        }
      }
    }
    ++tested;
  }
  CHECK(heroes_only ? tested == (check_room ? 3u : 2u) : tested > 0);
  return report();
}
