/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// Render the app's actual preset wires through the graph used by APOProcess.
// A tagged continuous bed distinguishes lifted steps from global gain riding.
#include "dsp_chain_fixture.h"
#include "graph_test_support.h"
#include "../../dsp-core/tests/footsteps_scene.h"

#include <algorithm>
#include <filesystem>
#include <fstream>

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

Audio render(const Audio& in, std::vector<double> values, uint32_t& delay,
             bool without_lift = false) {
  if (without_lift) {
    const auto tag = std::find(values.begin(), values.end(), FEQ_CHAIN_FOOTSTEPS_TAG);
    CHECK(tag != values.end());
    values[static_cast<size_t>(tag - values.begin()) + 5] = 0;
  }
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
  auto chain = chain_with(values, config);
  fluideq_engine::Graph graph(chain, kRate, 2, 480);
  CHECK(mentions(graph.active_stages(), "footsteps"));
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
}

int main(int argc, char** argv) {
  if (argc < 2) return 2;
  // Optional offline listening export. Input is explicit 48 kHz stereo
  // f32le, converted by ffmpeg without ever opening an output device.
  if (argc == 6 && std::string(argv[1]) == "--render") {
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
      uint32_t delay = 0;
      const Audio out = render(in, values, delay);
      Audio aligned(2, std::vector<float>(out[0].size() - delay));
      for (size_t c = 0; c < 2; ++c)
        std::copy(out[c].begin() + delay, out[c].end(), aligned[c].begin());
      wav(argv[5], aligned);
      std::printf("rendered %s: %zu frames, aligned %u frames\n", preset.c_str(), aligned[0].size(), delay);
      return report();
    }
    return 2;
  }
  std::ifstream input(argv[1]);
  std::string id;
  uint32_t count = 0;
  size_t tested = 0;
  while (input >> id >> count) {
    std::vector<double> values(count);
    for (double& v : values) input >> v;
    CHECK(!input.fail());
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
  CHECK(tested > 0);
  return report();
}
