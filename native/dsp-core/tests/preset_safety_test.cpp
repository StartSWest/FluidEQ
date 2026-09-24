/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Zero-input-trim coverage: every factory chain, every local profile, every
 * pair of different processors, and every local replacement in every chain.
 * The music smoke used -6 dB for local profiles and could not see ordinary
 * overloads. Measure sample AND reconstructed peaks, including startup.
 *
 * What is held: every render is finite and audible, and a rack that carries
 * a ceiling of its own — the Maximizer, or the Master with its loudness
 * target — never leaves over full scale. A rack without one is measured and
 * reported, not held: the final guard that used to hold every rack under
 * -0.1 dBTP was removed on 2026-09-22 (`chain_transparency_test.cpp`), and
 * what such a rack does with a record already at full scale is the record's
 * and the listener's, as it is under Equalizer APO.
 *
 * A chain is measured where it is heard: after its preset's curve, which the
 * main EQ plays behind the rack and the rack is told on the wire
 * (`generate-preset-fixtures.ts`), so its limiter holds the ceiling for the
 * curve to come. Measured at the rack's own output, a curve's boosts were
 * never seen, and on loud records they had put chains 3-5 dB over.
 */
#include "fluideq/chain.h"
#include "fluideq/primitives.h"
#include "dsp_test_support.h"

#include <algorithm>
#include <fstream>
#include <memory>
#include <string>

namespace {
using feq_test::check;
constexpr double kPi = 3.14159265358979323846;
constexpr uint32_t kBlock = 256;
using Audio = std::vector<std::vector<float>>;
using Chain = std::unique_ptr<FeqChain, decltype(&feq_chain_destroy)>;

struct Preset {
  std::string family;
  std::string id;
  FeqChainSettings settings{};
};

struct Metrics {
  bool finite = true;
  double peak = 0.0;
  double true_peak = 0.0;
  double rms = 0.0;
};

std::vector<Preset> load(const char* file) {
  std::ifstream input(file);
  std::vector<Preset> presets;
  Preset preset;
  uint32_t count = 0;
  while (input >> preset.family >> preset.id >> count) {
    if (count > 10000) {
      return {};
    }
    std::vector<double> parameters(count);
    for (double& value : parameters) {
      input >> value;
    }
    if (!input || !feq_chain_settings_decode(parameters.data(), count,
                                             &preset.settings)) {
      return {};
    }
    presets.push_back(preset);
  }
  return input.eof() ? presets : std::vector<Preset>{};
}

void replace(FeqChainSettings& target, const Preset& local) {
  const auto& source = local.settings;
  if (local.family == "denoise") target.denoise = source.denoise;
  else if (local.family == "equaliser") target.eq = source.eq;
  else if (local.family == "exciter") target.exciter = source.exciter;
  else if (local.family == "bass-forge") target.bass_forge = source.bass_forge;
  else if (local.family == "bass-punch") target.bass_punch = source.bass_punch;
  else if (local.family == "dimension") target.dimension = source.dimension;
  else if (local.family == "maximizer") target.maximizer = source.maximizer;
  else if (local.family == "master") target.master = source.master;
  else check(false, "every profile family has a replacement operation");
}

/** Bass, presence, treble and asymmetric transients at almost full scale. */
Audio programme(double rate) {
  const size_t frames = static_cast<size_t>(rate * 0.5);
  Audio result(2, std::vector<float>(frames));
  for (size_t channel = 0; channel < 2; ++channel) {
    double peak = 0.0;
    for (size_t at = 0; at < frames; ++at) {
      const double t = static_cast<double>(at) / rate;
      const double phase = channel == 0 ? 0.0 : 0.7;
      const double bass = std::sin(2.0 * kPi * 53.0 * t + phase);
      const double middle = std::sin(2.0 * kPi * 997.0 * t - phase);
      const double high = std::sin(2.0 * kPi * 7901.0 * t + phase);
      const bool bright = (at / (frames / 4)) % 2 == 1;
      const double sample = (bright ? 0.15 : 0.65) * bass + 0.18 * middle +
                            (bright ? 0.65 : 0.15) * high;
      result[channel][at] = static_cast<float>(sample);
      peak = std::max(peak, std::fabs(sample));
    }
    for (float& value : result[channel]) {
      value = static_cast<float>(static_cast<double>(value) * 0.98 / peak);
    }
  }
  result[0][frames / 3] = 0.99f;
  result[1][frames * 2 / 3] = -0.99f;
  return result;
}

/**
 * The preset's curve after the rack, as the main EQ plays it: the bands the
 * rack was told, designed as the Preset layer asks. No preamp in front of
 * it, which is the harder case: the rack's limiter alone keeps the result
 * under its ceiling.
 */
void play_tone(const FeqChainToneSettings& tone, Audio& audio, double rate) {
  for (auto& channel : audio) {
    for (uint32_t band = 0; band < tone.band_count; ++band) {
      const FeqChainToneBand& one = tone.bands[band];
      const FeqBiquadCoefficients coefficients =
          tone.matched != 0
              ? feq_biquad_coefficients_matched(one.type, one.frequency,
                                                one.gain_db, one.quality, rate)
              : feq_biquad_coefficients(one.type, one.frequency, one.gain_db,
                                        one.quality, rate);
      FeqBiquadState state{};
      feq_biquad_process(&state, channel.data(),
                         static_cast<uint32_t>(channel.size()), &coefficients);
    }
  }
}

Audio render(const FeqChainSettings& settings, const Audio& source,
             double rate, double makeup = 0.0) {
  Chain chain(feq_chain_create(rate, 2, kBlock), feq_chain_destroy);
  if (!chain) return {};
  feq_chain_configure(chain.get(), &settings);
  feq_chain_set_track_level_gains(chain.get(), 0.0, makeup, 1);
  Audio output = source;
  // Flush every processor's look-ahead, so the final input transient counts.
  for (auto& channel : output) channel.resize(channel.size() + 4096, 0.0f);
  for (size_t at = 0; at < output[0].size(); at += kBlock) {
    float* planes[2] = {output[0].data() + at, output[1].data() + at};
    const uint32_t span = static_cast<uint32_t>(
        std::min(static_cast<size_t>(kBlock), output[0].size() - at));
    feq_chain_process(chain.get(), planes, span);
  }
  play_tone(settings.tone, output, rate);
  return output;
}

Metrics measure(const Audio& audio) {
  Metrics result;
  double squared = 0.0;
  size_t count = 0;
  for (const auto& channel : audio) {
    FeqTruePeak detector{};
    // Keep measurement at 4x even when processing uses 2x at 96 kHz.
    feq_true_peak_init(&detector, 4);
    for (float value : channel) {
      result.finite = result.finite && std::isfinite(value);
      result.peak = std::max(result.peak, std::fabs(static_cast<double>(value)));
      result.true_peak = std::max(result.true_peak,
                                  feq_true_peak_sample(&detector, value));
      squared += static_cast<double>(value) * value;
      ++count;
    }
  }
  result.rms = count > 0 ? std::sqrt(squared / static_cast<double>(count)) : 0.0;
  return result;
}

/** Whether the rack carries a stage whose job is holding a ceiling. */
bool has_ceiling(const FeqChainSettings& settings) {
  return settings.maximizer.enabled != 0 ||
         (settings.master.enabled != 0 &&
          settings.master.loudness_maximize != 0);
}

bool safe(const FeqChainSettings& settings, const Metrics& result) {
  if (!result.finite || result.rms <= 0.01) return false;
  return !has_ceiling(settings) ||
         (result.peak <= 1.0 && result.true_peak <= 1.0);
}

size_t g_checked = 0;
double g_largest_peak = 0.0;
/** The loudest true peak left by a rack with no ceiling of its own. */
double g_largest_open_peak = 0.0;

void verify(const FeqChainSettings& settings, const Audio& source,
            double rate, const std::string& name) {
  const double makeup = settings.master.enabled &&
                                settings.master.loudness_maximize &&
                                !settings.master.matched_bypass
                            ? 4.0 : 0.0;
  const Metrics result = measure(render(settings, source, rate, makeup));
  ++g_checked;
  g_largest_peak = std::max(g_largest_peak, result.true_peak);
  if (!has_ceiling(settings)) {
    g_largest_open_peak = std::max(g_largest_open_peak, result.true_peak);
  }
  if (!safe(settings, result)) {
    std::printf("  FAIL %s @ %.0f: sample %.6f true %.6f rms %.6f finite %d\n",
                name.c_str(), rate, result.peak, result.true_peak, result.rms,
                result.finite ? 1 : 0);
    ++feq_test::g_failures;
  }
}

/** Residual energy after fitting the fundamental, independent of its phase. */
double distortion(const Audio& audio, double rate, double hz) {
  const size_t start = static_cast<size_t>(rate);
  const size_t end = start * 2;
  if (audio.empty() || audio[0].size() < end) return 1.0;
  double sine = 0.0;
  double cosine = 0.0;
  double power = 0.0;
  for (size_t at = start; at < end; ++at) {
    const double value = audio[0][at];
    const double phase = 2.0 * kPi * hz * static_cast<double>(at) / rate;
    sine += value * std::sin(phase);
    cosine += value * std::cos(phase);
    power += value * value;
  }
  const double count = static_cast<double>(end - start);
  const double fundamental = 2.0 * (sine * sine + cosine * cosine) / count;
  return std::sqrt(std::max(0.0, power - fundamental) /
                   std::max(fundamental, 1e-20));
}

void check_air(const std::vector<Preset>& presets) {
  const double rate = 48000.0;
  Audio note(2, std::vector<float>(96000));
  for (size_t at = 0; at < note[0].size(); ++at) {
    note[0][at] = static_cast<float>(0.94 * std::sin(
        2.0 * kPi * 8000.0 * static_cast<double>(at) / rate));
    note[1][at] = note[0][at] * 0.5f;
  }
  size_t found = 0;
  for (const auto& preset : presets) {
    if (!((preset.family == "equaliser" && preset.id == "air") ||
          (preset.family == "chain" && preset.id == "clarity"))) continue;
    ++found;
    const Audio output = render(preset.settings, note, rate);
    const double residual = distortion(output, rate, 8000.0);
    std::printf("  Air %s: THD+N %.5f%%, true peak %.6f\n",
                preset.family.c_str(), residual * 100.0, measure(output).true_peak);
    check(safe(preset.settings, measure(output)),
          "Air remains audible, and under its own ceiling where it has one");
    check(residual < 0.002, "Air adds less than 0.2% distortion to a clean tone");
    if (preset.family == "equaliser") {
      // The EQ alone carries no ceiling, so a boosted tone at 0.94 leaves
      // over full scale — intact, as floating point, which is the point:
      // nothing here reshapes it. Clipped by hand, the measurement sees it.
      Audio clipped = output;
      check(measure(clipped).true_peak > 1.0,
            "positive control: Air alone takes the tone over full scale");
      for (auto& channel : clipped) {
        for (float& value : channel) value = std::clamp(value, -1.0f, 1.0f);
      }
      check(distortion(clipped, rate, 8000.0) > 0.01,
            "positive control: the distortion measurement detects hard clipping");
      auto quiet = note;
      for (auto& channel : quiet) {
        for (float& value : channel) value *= 0.01f;
      }
      const Metrics dry = measure(quiet);
      const Metrics lifted = measure(render(preset.settings, quiet, rate));
      check(lifted.rms > dry.rms * 1.25,
            "Air still boosts treble when headroom is available");
    }
  }
  check(found == 2, "both the Air EQ and the complete Air chain were checked");
  FeqChainSettings none{};
  feq_chain_settings_defaults(&none);
  check(!safe(none, measure(Audio(2, std::vector<float>(48000, 0.0f)))),
        "positive control: silence cannot pass");
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2 || argc > 3) return 2;
  // Independent partitions let CTest parallelize the expensive catalogue
  // without sharing filter histories, counters or audio between threads.
  const std::string partition = argc == 3 ? argv[2] : "all";
  const auto presets = load(argv[1]);
  if (presets.empty()) {
    std::printf("FAIL: missing or invalid preset fixtures\n");
    return 1;
  }
  std::vector<Preset> chains;
  std::vector<Preset> locals;
  for (const auto& preset : presets) {
    (preset.family == "chain" ? chains : locals).push_back(preset);
  }
  /**
   * 107 whole chains, including the worldwide genre catalogue and None.
   *
   * A literal rather than a number the generator declares, because the point
   * is to notice: a catalogue that grows without this file growing with it is
   * a chain nobody renders at seven sample rates before it reaches anybody.
   * It sat at 28 through the two Room copies being added, and the miss only
   * showed when the fixtures were next regenerated.
   */
  check(chains.size() == 107 && locals.size() > 150,
        "the complete shipped catalogue is present");
  // Positive control for measuring after the curve: the chains' curves came
  // on the wire — all but None, Reference and Expansive, which have none.
  const auto toned = std::count_if(chains.begin(), chains.end(),
                                   [](const Preset& chain) {
                                     return chain.settings.tone.band_count > 0;
                                   });
  check(toned == static_cast<std::ptrdiff_t>(chains.size()) - 3,
        "every chain with a tone carries its curve to be played after it");
  if (partition == "all" || partition == "individual") {
    check_air(presets);
    for (double rate : {32000.0, 44100.0, 48000.0, 88200.0, 96000.0,
                        176400.0, 192000.0}) {
      const Audio source = programme(rate);
      for (const auto& preset : presets) {
        verify(preset.settings, source, rate, preset.family + "/" + preset.id);
        if (preset.settings.bass_punch.enabled) {
          auto extra = preset.settings;
          extra.bass_punch.mix = 2.0;
          verify(extra, source, rate,
                 preset.family + "/" + preset.id + " at 200% Punch Mix");
        }
      }
      std::printf("  %.0f Hz: %zu individual presets checked\n", rate, presets.size());
      std::fflush(stdout);
    }
  }
  const Audio source = programme(48000.0);
  for (const auto& chain : chains) {
    if (partition != "all" && partition != "chains") break;
    for (const auto& local : locals) {
      auto settings = chain.settings;
      replace(settings, local);
      verify(settings, source, 48000.0,
              chain.id + " + " + local.family + "/" + local.id);
    }
    std::printf("  %s: every local profile checked\n", chain.id.c_str());
    std::fflush(stdout);
  }
  for (size_t first = 0; first < locals.size(); ++first) {
    if (partition != "all" && partition != locals[first].family) continue;
    for (size_t second = first + 1; second < locals.size(); ++second) {
      if (locals[first].family == locals[second].family) continue;
      auto settings = locals[first].settings;
      replace(settings, locals[second]);
      verify(settings, source, 48000.0,
              locals[first].family + "/" + locals[first].id + " + " +
              locals[second].family + "/" + locals[second].id);
    }
    if (first + 1 == locals.size() ||
        locals[first + 1].family != locals[first].family) {
      std::printf("  %s: all cross-family pairs checked\n", locals[first].family.c_str());
      std::fflush(stdout);
    }
  }
  std::printf("  %zu renders at 0 dB input; largest true peak %.6f, "
              "%.6f on a rack with no ceiling of its own\n",
              g_checked, g_largest_peak, g_largest_open_peak);
  check(g_checked > 0, "the selected catalogue partition rendered audio");
  return feq_test::finish();
}
