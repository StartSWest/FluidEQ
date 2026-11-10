/* FluidEQ — GPL-3.0-or-later */
#include "fluideq/chain.h"
#include "fluideq/chain_source.h"
#include "fluideq/loudness.h"
#include "fluideq/dsp.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <iterator>
#include <set>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

namespace {
constexpr double kPi = 3.14159265358979323846;
constexpr unsigned kBlock = 480;
int failures = 0;
void check(bool valid, const std::string& label) {
  if (!valid) { std::fprintf(stderr, "FAIL %s\n", label.c_str()); ++failures; }
}
struct Audio { double rate; std::vector<float> left, right; };
struct Metrics { double lufs, peak, crest, contrast, foreground; };
struct Factory {
  std::string id;
  double loss_budget, crest_budget, contrast_budget;
  FeqChainSettings settings{};
};
Audio scene(double rate, double scale, bool sparse) {
  Audio out{rate, std::vector<float>(static_cast<size_t>(rate * 6)), {}};
  out.right.resize(out.left.size());
  for (size_t i = 0; i < out.left.size(); ++i) {
    const double t = static_cast<double>(i) / rate;
    const double beat = std::fmod(t, sparse ? 2.0 : 0.5);
    const double kick = (sparse ? 0.7 : 0.18) * std::exp(-beat * 45) *
        std::sin(2 * kPi * 61 * t);
    const double envelope = sparse ? 0.23 : 0.8 + 0.2 * std::sin(2 * kPi * 2 * t);
    double left = kick, right = kick;
    constexpr double hz[] = {47, 83, 163, 317, 683, 1423, 3011, 6121, 11003};
    constexpr double level[] = {0.04, 0.05, 0.04, 0.05, 0.04, 0.03, 0.02, 0.01, 0.006};
    for (unsigned n = 0; n < 9; ++n) {
      left += envelope * level[n] * std::sin(2 * kPi * hz[n] * t);
      right += envelope * level[n] * std::sin(2 * kPi * hz[n] * t + (n < 2 ? 0 : 0.3 * n));
    }
    out.left[i] = static_cast<float>(scale * left);
    out.right[i] = static_cast<float>(scale * right);
  }
  return out;
}

void apply_gain(Audio& audio, double db) {
  const double gain = std::pow(10.0, db / 20.0);
  for (float& sample : audio.left) sample = static_cast<float>(sample * gain);
  for (float& sample : audio.right) sample = static_cast<float>(sample * gain);
}
Metrics measure(const Audio& audio, double warmup_seconds = 1) {
  auto* meter = feq_loudness_create(audio.rate, 2);
  const size_t begin = static_cast<size_t>(audio.rate * warmup_seconds);
  double peak = 0, energy = 0;
  std::vector<double> blocks;
  const size_t width = static_cast<size_t>(audio.rate * 0.4);
  for (size_t at = begin; at < audio.left.size(); at += width) {
    const size_t count = std::min(width, audio.left.size() - at);
    const float* planes[] = {audio.left.data() + at, audio.right.data() + at};
    feq_loudness_feed(meter, planes, static_cast<uint32_t>(count));
    double sum = 0;
    for (size_t i = at; i < at + count; ++i) {
      const double l = audio.left[i], r = audio.right[i];
      sum += l * l + r * r;
      peak = std::max({peak, std::abs(l), std::abs(r)});
    }
    energy += sum;
    const double db = 10 * std::log10(std::max(sum / (2.0 * static_cast<double>(count)), 1e-30));
    if (db > -60) blocks.push_back(db);
  }
  const auto result = feq_loudness_finish(meter);
  feq_loudness_destroy(meter);
  std::sort(blocks.begin(), blocks.end());
  const auto at = [&](double q) { return blocks[std::min(blocks.size() - 1,
      static_cast<size_t>(static_cast<double>(blocks.size()) * q))]; };
  const double rms = std::sqrt(energy /
      (2.0 * static_cast<double>(audio.left.size() - begin)));
  return {result.integrated_lufs, result.true_peak_dbtp,
      20 * std::log10(std::max(peak, 1e-15) / std::max(rms, 1e-15)),
      blocks.empty() ? 0 : at(0.95) - at(0.1), result.max_short_term_lufs};
}
bool read_float_wave(const char* file, Audio& audio) {
  std::ifstream input(file, std::ios::binary);
  if (!input) return false;
  const std::vector<char> bytes{std::istreambuf_iterator<char>(input), {}};
  const auto word = [&](size_t offset, unsigned count) {
    uint32_t value = 0;
    for (unsigned n = 0; n < count; ++n)
      value |= static_cast<uint32_t>(static_cast<unsigned char>(bytes[offset + n])) << (8 * n);
    return value;
  };
  if (bytes.size() < 12 || std::memcmp(bytes.data(), "RIFF", 4) != 0 ||
      std::memcmp(bytes.data() + 8, "WAVE", 4) != 0) return false;
  size_t fmt = 0, data = 0, length = 0;
  for (size_t offset = 12; offset + 8 <= bytes.size();) {
    const size_t size = word(offset + 4, 4), start = offset + 8;
    if (size > bytes.size() - start) return false;
    if (std::memcmp(bytes.data() + offset, "fmt ", 4) == 0 && size >= 16) fmt = start;
    if (std::memcmp(bytes.data() + offset, "data", 4) == 0) { data = start; length = size; }
    offset = start + size + (size & 1);
  }
  if (fmt == 0 || data == 0 || length == 0 || length % 8 != 0 ||
      word(fmt + 2, 2) != 2 || word(fmt + 14, 2) != 32) return false;
  const auto format = word(fmt, 2);
  if (format != 3 && (format != 65534 || fmt + 40 > bytes.size() ||
                     word(fmt + 24, 2) != 3)) return false;
  audio.rate = word(fmt + 4, 4);
  if (audio.rate < 8000 || audio.rate > 384000) return false;
  audio.left.resize(length / 8);
  audio.right.resize(length / 8);
  for (size_t i = 0; i < audio.left.size(); ++i) {
    std::memcpy(&audio.left[i], bytes.data() + data + i * 8, 4);
    std::memcpy(&audio.right[i], bytes.data() + data + i * 8 + 4, 4);
    if (!std::isfinite(audio.left[i]) || !std::isfinite(audio.right[i])) return false;
  }
  return audio.left.size() >= static_cast<size_t>(audio.rate * 0.4);
}
struct InputReadback { int alignment = 0; double gain_db = 0, error_db = 0; };
bool align_input(const Audio& raw, Audio& actual, double expected_db, InputReadback& result) {
  if (raw.rate != actual.rate || raw.left.empty()) return false;
  const double gain = std::pow(10.0, expected_db / 20);
  const size_t second = static_cast<size_t>(raw.rate);
  std::vector<double> energies(raw.left.size() / second + 1);
  for (size_t i = 0; i < raw.left.size(); i += 64)
    energies[i / second] += raw.left[i] * raw.left[i] + raw.right[i] * raw.right[i];
  const size_t strongest = static_cast<size_t>(std::max_element(
      energies.begin(), energies.end()) - energies.begin());
  const size_t begin = std::min(strongest * second, raw.left.size() > second
      ? raw.left.size() - second : size_t{0});
  const size_t end = std::min(raw.left.size(), begin + second);
  const auto sample = [&](const std::vector<float>& channel, int64_t i) {
    return i >= 0 && static_cast<uint64_t>(i) < channel.size()
        ? static_cast<double>(channel[static_cast<size_t>(i)]) : 0.0;
  };
  double best = 1e300;
  for (int lag = -4096; lag <= 4096; ++lag) {
    double error = 0;
    for (size_t i = begin; i < end; i += 64) {
      const int64_t at = static_cast<int64_t>(i) + lag;
      const double l = sample(actual.left, at) - raw.left[i] * gain;
      const double r = sample(actual.right, at) - raw.right[i] * gain;
      error += l * l + r * r;
    }
    if (error < best) { best = error; result.alignment = lag; }
  }
  Audio aligned{raw.rate, std::vector<float>(raw.left.size()), {}};
  aligned.right.resize(raw.right.size());
  double source_energy = 0, product = 0, error_energy = 0;
  for (size_t i = 0; i < raw.left.size(); ++i) {
    const int64_t at = static_cast<int64_t>(i) + result.alignment;
    const double l = sample(actual.left, at), r = sample(actual.right, at);
    aligned.left[i] = static_cast<float>(l);
    aligned.right[i] = static_cast<float>(r);
    const double x = raw.left[i], y = raw.right[i];
    source_energy += x * x + y * y;
    product += x * l + y * r;
    error_energy += (l - x * gain) * (l - x * gain) + (r - y * gain) * (r - y * gain);
  }
  if (source_energy <= 1e-20 || product <= 0) return false;
  result.gain_db = 20 * std::log10(product / source_energy);
  result.error_db = 10 * std::log10(std::max(1e-30,
      error_energy / (source_energy * gain * gain)));
  actual = std::move(aligned);
  return std::abs(result.gain_db - expected_db) < 0.0001 && result.error_db < -100;
}
void external_curve(Audio& audio, const FeqChainSettings& settings) {
  for (unsigned b = 0; b < settings.tone.band_count; ++b) {
    const auto& band = settings.tone.bands[b];
    const auto k = settings.tone.matched && band.gain_db != 0
        ? feq_biquad_coefficients_matched(band.type, band.frequency, band.gain_db,
                                        band.quality, audio.rate)
        : feq_biquad_coefficients(band.type, band.frequency, band.gain_db,
                                 band.quality, audio.rate);
    FeqBiquadState left{}, right{};
    feq_biquad_process(&left, audio.left.data(), static_cast<unsigned>(audio.left.size()), &k);
    feq_biquad_process(&right, audio.right.data(), static_cast<unsigned>(audio.right.size()), &k);
  }
}
Audio render(const Audio& source, FeqChainSettings settings, bool live = false) {
  Audio out = source;
  auto* chain = feq_chain_create(source.rate, 2, kBlock);
  check(chain != nullptr, "factory chain can be created");
  feq_chain_configure(chain, &settings);
  FeqChainSourceAnalysis analysis{};
  analysis.version = 2;
  analysis.library = live ? 0 : 1;
  analysis.source_id = live ? 0 : 1;
  FeqChainSourceStatus ready{};
  check(feq_chain_prepare_source_analysis(chain, &analysis, nullptr, &ready) == 1 &&
      ready.ready != 0, "the source path prepares without level facts");
  feq_chain_reset(chain, FEQ_CHAIN_RESET_STREAM_START);
  const auto latency = feq_chain_latency_frames(chain);
  out.left.resize(out.left.size() + latency);
  out.right.resize(out.right.size() + latency);
  for (size_t at = 0; at < out.left.size(); at += kBlock) {
    const unsigned count = static_cast<unsigned>(std::min<size_t>(kBlock, out.left.size() - at));
    float* planes[] = {out.left.data() + at, out.right.data() + at};
    feq_chain_process(chain, planes, count);
    feq_chain_wake_workers(chain);
  }
  feq_chain_destroy(chain);
  // Same routing as playback: inverse inside the rack, exact curve once outside.
  if (settings.enabled != 0) external_curve(out, settings);
  out.left.erase(out.left.begin(), out.left.begin() + latency);
  out.right.erase(out.right.begin(), out.right.begin() + latency);
  return out;
}
void musical_bounds(const Factory& factory, bool sparse) {
  const auto source = scene(48000, 1, sparse);
  auto without = factory.settings;
  without.maximizer.enabled = 0;
  auto linear = render(source, without);
  apply_gain(linear, factory.settings.maximizer.drive_db);
  const auto before = measure(linear);
  const auto after = measure(render(source, factory.settings));
  const auto quiet = measure(render(scene(48000, 0.0625, sparse), factory.settings));
  const auto quieter = measure(render(scene(48000, 0.03125, sparse), factory.settings));
  const std::string label = factory.id + (sparse ? " sparse" : " dense");
  const double loss = before.lufs - after.lufs;
  check(std::isfinite(after.lufs) && after.lufs > -60, label + " retains nonzero wanted programme");
  check(after.peak <= -0.99, label + " stays below the final true-peak ceiling");
  check(loss <= factory.loss_budget + 0.036, label + " respects limiter-loss budget");
  check(before.crest - after.crest <= factory.crest_budget + 0.055,
        label + " retains transient contrast");
  check(before.contrast - after.contrast <= factory.contrast_budget + 0.055,
        label + " retains phrase contrast");
  check(std::abs(quiet.lufs - quieter.lufs - 6.0206) < 0.5,
        label + " preserves the level difference between clean scaled copies");
  std::printf("{\"genre\":\"%s\",\"scene\":\"%s\",\"outputLufs\":%.6f,"
      "\"truePeakDbtp\":%.6f,\"limiterLossLu\":%.6f,\"crestLossDb\":%.6f,"
      "\"phraseLossDb\":%.6f,\"scaledCopyDeltaLu\":%.6f}\n",
      factory.id.c_str(), sparse ? "sparse" : "dense", after.lufs, after.peak,
      loss, before.crest - after.crest, before.contrast - after.contrast,
      quiet.lufs - quieter.lufs);
}

double opening_rms_db(const Audio& audio, size_t begin, size_t count) {
  double sum = 0.0;
  for (size_t i = begin; i < begin + count; ++i)
    sum += double(audio.left[i]) * audio.left[i] + double(audio.right[i]) * audio.right[i];
  return 10 * std::log10(std::max(1e-30, sum / (2 * count)));
}

void live_opening_bounds(const Factory& factory) {
  const auto hot = scene(48000, 8, false);
  const auto result = measure(render(hot, factory.settings, true), 0);
  check(std::isfinite(result.lufs) && result.peak <= -0.99,
        factory.id + " protects a hot unknown Live opening, including its first block");
  const auto library = measure(render(hot, factory.settings), 0);
  check(std::abs(library.lufs - result.lufs) < 0.1,
        factory.id + " has the same raw source level in Library and Live");

  constexpr size_t boundary = 48000 * 3;
  const auto loud = scene(48000, 2, false);
  Audio gap = loud;
  Audio quiet = loud;
  for (size_t i = 0; i < boundary; ++i) {
    gap.left[i] = gap.right[i] = 0.0f;
    quiet.left[i] *= 0.04f;
    quiet.right[i] *= 0.04f;
  }
  const auto after_gap = render(gap, factory.settings, true);
  const auto no_gap = render(quiet, factory.settings, true);
  const auto peak = std::max(measure(after_gap, 0).peak, measure(no_gap, 0).peak);
  check(peak <= -0.99, factory.id + " protects both quiet-to-loud transitions");
  double excess[3]{};
  const size_t windows[] = {kBlock, 4800, 48000};
  for (size_t i = 0; i < 3; ++i) {
    excess[i] = opening_rms_db(no_gap, boundary, windows[i]) -
        opening_rms_db(after_gap, boundary, windows[i]);
    check(excess[i] < 0.75, factory.id + " does not inherit boost from quiet audio");
  }
  std::printf("{\"genre\":\"%s\",\"scene\":\"opening\",\"truePeakDbtp\":%.6f,"
      "\"firstBlockExcessDb\":%.6f,\"first100MsExcessDb\":%.6f,\"firstSecondExcessDb\":%.6f}\n",
      factory.id.c_str(), std::max(peak, result.peak), excess[0], excess[1], excess[2]);
}
void strength_control(const Factory& factory) {
  // Public deterministic control: equal octave energy from 125 Hz to 4 kHz,
  // 32 harmonics, Schroeder phases. Its low crest leaves room to measure the
  // fixed gain in the absence of the input Normalizer.
  Audio source{48000, std::vector<float>(48000 * 6), {}};
  float period[384]{};
  for (unsigned i = 0; i < 384; ++i) {
    double value = 0;
    for (unsigned n = 0; n < 32; ++n)
      value += 0.03 / std::sqrt(n + 1.0) *
          std::sin(2 * kPi * (n + 1) * i / 384 - kPi * n * (n + 1) / 32);
    period[i] = static_cast<float>(value);
  }
  for (size_t i = 0; i < source.left.size(); ++i) source.left[i] = period[i % 384];
  source.right = source.left;
  const auto original = measure(source, 0);
  const double scale = std::pow(10.0, (-18 - original.foreground) / 20);
  for (size_t i = 0; i < source.left.size(); ++i)
    source.right[i] = source.left[i] = static_cast<float>(source.left[i] * scale);
  const auto input = measure(source, 0);
  check(std::abs(input.foreground + 18) < 0.0001 && input.peak < -12,
        factory.id + " strength control starts at a known raw level");
  auto without = factory.settings;
  without.maximizer.enabled = 0;
  auto linear = render(source, without);
  apply_gain(linear, factory.settings.maximizer.drive_db);
  const auto before = measure(linear);
  const auto after = measure(render(source, factory.settings));
  const double loss = before.lufs - after.lufs;
  check(std::abs(after.lufs - input.lufs) <= 4.5 &&
      std::abs(after.foreground - input.foreground) <= 4.5,
      factory.id + " unnormalized control retains useful output strength");
  check(after.peak <= -0.99 && loss <= factory.loss_budget + 0.036 &&
      before.crest - after.crest <= factory.crest_budget + 0.055 &&
      before.contrast - after.contrast <= factory.contrast_budget + 0.055,
      factory.id + " strength control stays clean within the original dynamics budgets");
  std::printf("{\"genre\":\"%s\",\"scene\":\"strength\",\"sourceForegroundLufs\":%.9f,"
      "\"sourceTruePeakDbtp\":%.9f,\"sourceLufs\":%.9f,\"outputLufs\":%.9f,\"outputForegroundLufs\":%.9f,"
      "\"truePeakDbtp\":%.9f,\"limiterLossLu\":%.9f,\"crestLossDb\":%.9f,\"phraseLossDb\":%.9f}\n",
      factory.id.c_str(), input.foreground, input.peak, input.lufs, after.lufs, after.foreground,
      after.peak, loss, before.crest - after.crest, before.contrast - after.contrast);
}

double magnitude(const Audio& audio, double hz) {
  const auto count = static_cast<size_t>(audio.rate);
  const double coefficient = 2 * std::cos(2 * kPi * hz / audio.rate);
  double previous = 0, older = 0;
  for (size_t i = 0; i < count; ++i) {
    const double value = audio.left[audio.left.size() - count + i];
    const double next = value + coefficient * previous - older;
    older = previous;
    previous = next;
  }
  const double power = previous * previous + older * older - coefficient * previous * older;
  return 2 * std::sqrt(std::max(power, 0.0)) / static_cast<double>(count);
}
double aliases(const Factory& factory, double rate, double hz, double amplitude) {
  Audio source{rate, std::vector<float>(static_cast<size_t>(rate * 4)), {}};
  for (size_t i = 0; i < source.left.size(); ++i)
    source.left[i] = static_cast<float>(amplitude *
        std::sin(2 * kPi * hz * static_cast<double>(i) / rate));
  source.right = source.left;
  auto settings = factory.settings;
  // Include hot Live openings: keep every creative stage and the exact curve,
  // but do not normalize away the three different generator stimulus levels.
  settings.normalizer.mode = 0;
  const auto out = render(source, settings);
  const double wanted = magnitude(out, hz);
  check(wanted > 1e-5, factory.id + " alias probe retains its wanted tone");
  std::set<double> bins;
  for (unsigned n = 2; n <= 32; ++n) {
    if (n * hz <= rate / 2) continue;
    const double fold = std::abs(std::fmod(n * hz + rate / 2, rate) - rate / 2);
    bool wanted_harmonic = false;
    for (unsigned order = 1; order * hz <= rate / 2; ++order)
      if (std::abs(fold - order * hz) < 1) wanted_harmonic = true;
    if (fold >= 20 && fold < 20000 && !wanted_harmonic) bins.insert(fold);
  }
  double power = 0;
  for (const double bin : bins) {
    const double value = magnitude(out, bin);
    power += value * value;
  }
  return 10 * std::log10(std::max(power, 1e-30) / (wanted * wanted));
}
void generator_bounds(const Factory& factory) {
  if (factory.settings.exciter.enabled == 0 && factory.settings.bass_forge.enabled == 0) return;
  double worst = -300;
  for (const double rate : {44100.0, 48000.0})
    for (const double hz : {5500.0, 9000.0, 11000.0})
      for (const double amplitude : {0.025, 0.1, 0.3})
        worst = std::max(worst, aliases(factory, rate, hz, amplitude));
  std::printf("{\"genre\":\"%s\",\"worstAliasDbc\":%.6f}\n", factory.id.c_str(), worst);
  check(worst < -90, factory.id + " stays below the generated-fold bound in the sweep");
}
void wanted_colour_contract() {
  // Independently captured from checkpoint 130b69ff, before the input-filter
  // correction. Both the audible fundamental and generated H2/H3 are held;
  // muting a return cannot satisfy these comparisons.
  for (const double rate : {44100.0, 48000.0}) {
    for (const bool organic : {false, true}) {
      const double hz = organic ? 500 : 1250;
      Audio source{rate, std::vector<float>(static_cast<size_t>(rate * 4)), {}};
      for (size_t i = 0; i < source.left.size(); ++i)
        source.left[i] = static_cast<float>(0.1 * std::sin(2 * kPi * hz *
            static_cast<double>(i) / rate));
      source.right = source.left;
      FeqChainSettings settings{};
      feq_chain_settings_defaults(&settings);
      settings.enabled = 1;
      settings.exciter.enabled = 1;
      settings.exciter.oversampling = 1;
      for (auto& band : settings.exciter.bands) band.enabled = 0;
      settings.exciter.organic_enabled = organic ? 1 : 0;
      settings.exciter.organic_amount = 0.08;
      settings.exciter.organic_focus_hz = 500;
      settings.exciter.organic_range = 0.28;
      if (!organic) settings.exciter.bands[1] = {1, 1250, 0.3, 2, 0.12, 0.2};
      const auto out = render(source, settings);
      const double fundamental = magnitude(out, hz);
      const double h2 = 20 * std::log10(magnitude(out, hz * 2) / fundamental);
      const double h3 = 20 * std::log10(magnitude(out, hz * 3) / fundamental);
      check(std::abs(fundamental - (organic ? 0.10592581 : 0.1050170)) < 0.00001,
            "wanted colour keeps its measured focus fundamental");
      check(std::abs(h2 - (organic ? -35.0865 : -35.607)) < 0.1,
            "wanted colour keeps its independently captured second harmonic");
      check(std::abs(h3 - (organic ? -57.199 : -47.482)) < 0.1,
            "wanted colour keeps its independently captured third harmonic");
      settings.exciter.enabled = 0;
      const auto dry = render(source, settings);
      check(magnitude(dry, hz * 2) / magnitude(dry, hz) < 1e-6 &&
          magnitude(dry, hz * 3) / magnitude(dry, hz) < 1e-6,
          "positive control: the wanted colour disappears under bypass");
      std::printf("colour %.0f %s f=%.9f h2=%.6f h3=%.6f\n",
          rate, organic ? "organic" : "mid", fundamental, h2, h3);
    }
  }
}
void input_readback_controls() {
  const auto raw = scene(48000, 1, false);
  Audio delayed{48000, std::vector<float>(raw.left.size() + 321), {}};
  delayed.right.resize(delayed.left.size());
  constexpr double gain_db = 3.5;
  const double gain = std::pow(10.0, gain_db / 20);
  for (size_t i = 0; i < raw.left.size(); ++i) {
    delayed.left[i + 321] = static_cast<float>(raw.left[i] * gain);
    delayed.right[i + 321] = static_cast<float>(raw.right[i] * gain);
  }
  auto aligned = delayed;
  InputReadback result{};
  check(align_input(raw, aligned, gain_db, result) && result.alignment == 321,
        "input readback recovers a known fixed delay and independently specified linked gain");
  const auto before = measure(raw, 0), after = measure(aligned, 0);
  check(std::abs(after.foreground - before.foreground - gain_db) < 0.00001 &&
      std::abs(after.lufs - before.lufs - gain_db) < 0.00001,
      "fixed-grid measurements retain their meaning after source-time alignment");
  auto wrong = delayed;
  check(!align_input(raw, wrong, gain_db + 0.1, result),
        "positive control: wrong input gain cannot be hidden by alignment");
  auto corrupt = delayed;
  corrupt.right[48037] += 0.01f;
  check(!align_input(raw, corrupt, gain_db, result),
        "positive control: one corrupted stereo sample fails the full-waveform residual");
}
}
int main(int argc, char** argv) {
  const bool live_latency = argc == 3 && std::strcmp(argv[1], "--latency-live") == 0;
  if (argc == 3 && (live_latency || std::strcmp(argv[1], "--latency") == 0)) {
    std::istringstream tokens(argv[2]);
    std::vector<double> values;
    double value;
    while (tokens >> value) values.push_back(value);
    FeqChainSettings settings{};
    if (!feq_chain_settings_decode(values.data(), static_cast<unsigned>(values.size()), &settings)) return 2;
    auto* chain = feq_chain_create(48000, 2, kBlock);
    auto* engine = feq_engine_create(48000, 2, kBlock);
    if (!chain || !engine) return 2;
    feq_chain_configure(chain, &settings);
    if (live_latency && !feq_chain_enable_live_normalizer(chain)) return 2;
    float left[kBlock]{}, right[kBlock]{};
    float* planes[] = {left, right};
    feq_chain_process(chain, planes, kBlock);
    const unsigned rack = feq_chain_latency_frames(chain);
    const unsigned final_engine = feq_engine_latency_frames(engine);
    std::printf("{\"chainLatencyFrames\":%u,\"engineLatencyFrames\":%u,\"totalLatencyFrames\":%u}\n",
        rack, final_engine, rack + final_engine);
    feq_chain_destroy(chain);
    feq_engine_destroy(engine);
    return 0;
  }
  if (argc == 5 && std::strcmp(argv[1], "--input-reference") == 0) {
    Audio raw{}, actual{};
    char* end = nullptr;
    const double expected = std::strtod(argv[4], &end);
    if (!std::isfinite(expected) || end == argv[4] || *end != '\0' ||
        !read_float_wave(argv[2], raw) || !read_float_wave(argv[3], actual)) return 2;
    InputReadback readback{};
    if (!align_input(raw, actual, expected, readback)) {
      std::fprintf(stderr, "Input readback mismatch: expected %.9f, measured %.9f, error %.3f dB, lag %d\n",
          expected, readback.gain_db, readback.error_db, readback.alignment);
      return 1;
    }
    const auto result = measure(actual, 0);
    std::printf("{\"integratedLufs\":%.9f,\"truePeakDbtp\":%.9f,"
        "\"crestDb\":%.9f,\"blockRmsRangeDb\":%.9f,\"maxShortTermLufs\":%.9f,"
        "\"measuredGainDb\":%.9f,\"residualDb\":%.3f,\"alignmentFrames\":%d}\n",
        result.lufs, result.peak, result.crest, result.contrast, result.foreground,
        readback.gain_db, readback.error_db, readback.alignment);
    return 0;
  }
  if ((argc == 3 || argc == 4) && std::strcmp(argv[1], "--measure") == 0) {
    Audio audio{};
    if (!read_float_wave(argv[2], audio)) return 2;
    if (argc == 4) {
      std::istringstream trim(argv[3]);
      double gain_db = 0.0;
      if (!(trim >> gain_db) || !std::isfinite(gain_db)) return 2;
      apply_gain(audio, gain_db);
    }
    const auto result = measure(audio, 0);
    std::printf("{\"integratedLufs\":%.9f,\"truePeakDbtp\":%.9f,"
        "\"crestDb\":%.9f,\"blockRmsRangeDb\":%.9f,\"maxShortTermLufs\":%.9f}\n", result.lufs,
        result.peak, result.crest, result.contrast, result.foreground);
    return 0;
  }
  if (argc == 5 && std::strcmp(argv[1], "--limit") == 0) {
    // Planning only: the supplied WAV is the actual before-Maximizer
    // waveform, with the external curve already applied. The final audit
    // re-renders the complete chain and every active colour stage afresh.
    Audio input{};
    if (!read_float_wave(argv[2], input)) return 2;
    FeqChainSettings settings{};
    feq_chain_settings_defaults(&settings);
    settings.enabled = 1;
    settings.low_latency = 1;
    settings.maximizer.enabled = 1;
    std::istringstream dials(argv[3]);
    std::istringstream ceiling(argv[4]);
    if (!(dials >> settings.maximizer.drive_db >> settings.maximizer.look_ahead_ms
          >> settings.maximizer.release_ms) || !(ceiling >> settings.maximizer.ceiling_db)) return 2;
    const auto result = measure(render(input, settings), 0);
    std::printf("{\"integratedLufs\":%.9f,\"truePeakDbtp\":%.9f,"
        "\"crestDb\":%.9f,\"blockRmsRangeDb\":%.9f,\"maxShortTermLufs\":%.9f}\n",
        result.lufs, result.peak, result.crest, result.contrast, result.foreground);
    return failures == 0 ? 0 : 1;
  }
  const bool programme_only = argc == 4 && std::strcmp(argv[1], "--programme") == 0;
  const bool generators_only = argc == 3 && std::strcmp(argv[1], "--generators") == 0;
  if (argc != 2 && !programme_only && !generators_only) return 2;
  std::ifstream input(argv[programme_only ? 3 : generators_only ? 2 : 1]);
  if (!input) return 2;
  std::string line;
  unsigned count = 0;
  Factory control{};
  while (std::getline(input, line)) {
    std::istringstream tokens(line);
    Factory factory;
    if (!(tokens >> factory.id >> factory.loss_budget >> factory.crest_budget >>
          factory.contrast_budget)) return 2;
    if (programme_only && factory.id != argv[2]) continue;
    std::vector<double> values;
    double value;
    while (tokens >> value) values.push_back(value);
    if (!feq_chain_settings_decode(values.data(), static_cast<unsigned>(values.size()),
                                   &factory.settings)) return 2;
    if (!generators_only) {
      musical_bounds(factory, false);
      musical_bounds(factory, true);
      strength_control(factory);
      live_opening_bounds(factory);
    }
    if (!programme_only) generator_bounds(factory);
    if (factory.id == "country") control = factory;
    ++count;
  }
  if (programme_only) return count == 1 && failures == 0 ? 0 : 1;
  check(count == 83, "all 83 music factory configurations were actually rendered");
  wanted_colour_contract();
  input_readback_controls();
  control.settings.exciter.enabled = 1;
  control.settings.exciter.bands[2].enabled = 1;
  control.settings.exciter.bands[2].freq_hz = 8000;
  control.settings.exciter.bands[2].range = 0.22;
  control.settings.exciter.bands[2].drive = 2.3;
  control.settings.exciter.bands[2].mix = 0.2;
  control.settings.exciter.bands[2].texture = 0.5;
  check(aliases(control, 48000, 11000, 0.1) > -60,
        "positive control: the removed high-band generation produces detectable folds");
  auto bypass = control.settings;
  bypass.enabled = 0;
  const auto raw = measure(render(scene(48000, 10, false), bypass));
  check(raw.peak > 0 && raw.lufs > -15,
        "positive control: unprotected hot audio really exceeds the ceiling");
  std::printf("music-factory: %u presets, %d failures\n", count, failures);
  return failures == 0 ? 0 : 1;
}
