/* FluidEQ — GPL-3.0-or-later */
#include "fluideq/chain.h"
#include "fluideq/chain_source.h"
#include "fluideq/loudness.h"
#include "fluideq/loudness_meter.h"
#include "fluideq/live_normalizer.h"
#include "../src/chain_internal.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <limits>
#include <vector>
namespace {
constexpr double kPi = 3.14159265358979323846;
int failures = 0;
void check(bool pass, const char* text) {
  if (!pass) { std::fprintf(stderr, "FAIL %s\n", text); ++failures; }
}
void prime(FeqChain* chain) {
  float left[480]{}, right[480]{};
  float* planes[] = {left, right};
  feq_chain_process(chain, planes, 480);
  feq_chain_reset(chain, FEQ_CHAIN_RESET_STREAM_START);
}
std::vector<float> programme(unsigned rate, double seconds, bool dynamic) {
  std::vector<float> audio(static_cast<size_t>(rate * seconds));
  for (size_t i = 0; i < audio.size(); ++i) {
    const double level = dynamic && i >= audio.size() / 2 ? 0.05 : 0.1;
    audio[i] = static_cast<float>(level * std::sin(2 * kPi * 1000 *
        static_cast<double>(i) / rate));
  }
  return audio;
}
FeqLoudnessResult analyse(const std::vector<float>& audio, unsigned rate, bool chunks) {
  auto* meter = feq_loudness_create(rate, 2);
  uint32_t random = 1234567;
  for (size_t at = 0; at < audio.size();) {
    random = random * 1664525u + 1013904223u;
    const auto count = static_cast<unsigned>(std::min<size_t>(audio.size() - at,
        chunks ? 1 + random % 8191 : audio.size()));
    const float* planes[] = {audio.data() + at, audio.data() + at};
    feq_loudness_feed(meter, planes, count);
    at += count;
  }
  const auto result = feq_loudness_finish(meter);
  feq_loudness_destroy(meter);
  return result;
}
void windows_and_chunks() {
  for (const unsigned rate : {44100u, 48000u}) {
    const auto audio = programme(rate, 60, true);
    const auto whole = analyse(audio, rate, false), split = analyse(audio, rate, true);
    check(std::abs(whole.integrated_lufs - split.integrated_lufs) < 1e-9 &&
        std::abs(whole.max_short_term_lufs - split.max_short_term_lufs) < 1e-9,
        "whole-file reference is independent of random decode chunks");
    check(whole.max_short_term_lufs - whole.integrated_lufs > 2 &&
        whole.max_short_term_lufs - whole.integrated_lufs < 2.06,
        "analytic dynamic programme distinguishes foreground from integrated loudness");
    auto* meter = feq_loudness_meter_create(rate, 2);
    double loudest = -120;
    const unsigned hop = rate / 10;
    for (size_t at = 0; at < audio.size(); at += hop) {
      const float* planes[] = {audio.data() + at, audio.data() + at};
      feq_loudness_meter_process(meter, planes, hop);
      FeqLoudnessReading reading{};
      feq_loudness_meter_read(meter, &reading);
      loudest = std::max(loudest, static_cast<double>(reading.short_term_lufs));
    }
    feq_loudness_meter_destroy(meter);
    check(std::abs(loudest - whole.max_short_term_lufs) < 0.0001,
          "offline foreground agrees with the independent Live meter on its fixed grid");
    const auto short_clip = analyse(programme(rate, 2.9, true), rate, true);
    check(short_clip.max_short_term_lufs == short_clip.integrated_lufs,
          "a clip shorter than three seconds uses its integrated reading");
    auto partial = programme(rate, 3.05, false);
    const auto baseline = analyse(partial, rate, false);
    for (size_t at = static_cast<size_t>(rate * 3); at < partial.size(); ++at) partial[at] *= 4;
    const auto ending = analyse(partial, rate, true);
    check(std::abs(ending.max_short_term_lufs - baseline.max_short_term_lufs) < 1e-9 &&
        ending.true_peak_dbtp > baseline.true_peak_dbtp + 11.9,
        "an incomplete final grid hop cannot change foreground but its peak is protected");
  }
}
void versioned_source_gain() {
  const auto raw = analyse(programme(48000, 60, true), 48000, true);
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.enabled = 1; settings.normalizer = {2, -3, -18};
  auto* chain = feq_chain_create(48000, 2, 480);
  feq_chain_configure(chain, &settings);
  prime(chain);
  FeqChainSourceAnalysis facts{};
  facts.version = 2; facts.library = 1; facts.source_id = 7; facts.has_level = 1;
  facts.integrated_lufs = raw.integrated_lufs;
  facts.reference_lufs = raw.max_short_term_lufs;
  facts.true_peak_dbtp = raw.true_peak_dbtp;
  FeqChainSourceStatus ready{};
  check(feq_chain_prepare_source_analysis(chain, &facts, nullptr, &ready) && ready.ready,
        "new foreground facts prepare the actual source gain path");
  const double foreground_gain = chain->input_gain_target_db;
  check(std::abs(foreground_gain - (-18 - raw.max_short_term_lufs)) < 1e-6,
        "native v2 actually targets foreground instead of the different integrated number");
  auto* replacement = feq_chain_create(48000, 2, 480);
  feq_chain_configure(replacement, &settings);
  prime(replacement);
  facts.reference_lufs += 2;
  check(feq_chain_prepare_source_analysis(replacement, &facts, nullptr, &ready) && ready.ready,
        "updated foreground facts prepare a replacement graph");
  const int transferred = feq_chain_transfer_state(replacement, chain);
  if (!transferred || std::abs(replacement->input_gain_target_db - (foreground_gain - 2)) >= 1e-6)
    std::fprintf(stderr, "Source handover: result %d target %.9f expected %.9f pending %d/%d\n",
        transferred, replacement->input_gain_target_db, foreground_gain - 2,
        replacement->kernel_handoff.load() != nullptr, chain->kernel_handoff.load() != nullptr);
  check(transferred &&
      std::abs(replacement->input_gain_target_db - (foreground_gain - 2)) < 1e-6,
      "a same-song graph handover retains the newly measured gain rather than restoring the old target");
  feq_chain_destroy(replacement);
  facts.version = 1;
  facts.reference_lufs = std::numeric_limits<double>::quiet_NaN();
  check(feq_chain_prepare_source_analysis(chain, &facts, nullptr, &ready) &&
      std::abs(chain->input_gain_target_db - (-18 - raw.integrated_lufs)) < 1e-6,
      "legacy v1 keeps integrated behavior without inspecting the appended v2 field");
  check(chain->input_gain_target_db - foreground_gain > 2,
        "positive control: the two reference policies produce measurably different gains");
  facts.version = 2;
  check(!feq_chain_prepare_source_analysis(chain, &facts, nullptr, &ready),
        "v2 refuses invalid foreground facts");
  feq_chain_destroy(chain);
}
void live_reference_is_independent_of_callback_size() {
  const auto source = programme(48000, 60, true);
  const auto facts = analyse(source, 48000, false);
  double gains[2]{};
  for (unsigned variant = 0; variant < 2; ++variant) {
    auto left = source, right = source;
    auto* live = feq_live_normalizer_create(48000, 2);
    const FeqNormalizerSettings settings{2, -3, -18};
    FeqLiveNormalizerReading result{};
    const size_t period = variant == 0 ? 127 : source.size();
    const size_t prefix = variant == 0 ? 0 : 63;
    if (prefix) {
      float* planes[] = {left.data(), right.data()};
      feq_live_normalizer_process(live, planes, static_cast<unsigned>(prefix), &settings);
    }
    for (size_t at = prefix; at < source.size(); at += period) {
      float* planes[] = {left.data() + at, right.data() + at};
      const auto count = static_cast<unsigned>(std::min(period, source.size() - at));
      result = feq_live_normalizer_process(live, planes, count, &settings);
    }
    check(std::abs(result.reference_lufs - facts.max_short_term_lufs) < 0.0001,
          "Live observes the same maximum foreground even inside a very large callback");
    check(std::abs(result.output_lufs - (result.input_lufs +
        (-18 - facts.max_short_term_lufs))) < 0.02,
        "the quiet second half keeps its relative level after foreground normalization");
    gains[variant] = result.applied_gain_db;
    feq_live_normalizer_destroy(live);
  }
  check(std::abs(gains[0] - gains[1]) < 0.0001,
        "small and very large callbacks settle on the same constant source gain");
}
void long_named_songs_keep_their_quiet_movements() {
  constexpr unsigned rate = 8000, block = 800;
  double gain_at_quiet_start[2]{}, gain_at_end[2]{};
  for (unsigned named = 0; named < 2; ++named) {
    auto* memory = feq_leveling_memory_create();
    if (named) feq_leveling_memory_begin_song(memory, 123, -120, -120);
    auto* live = feq_live_normalizer_create(rate, 1);
    feq_live_normalizer_attach_memory(live, memory);
    const FeqNormalizerSettings settings{2, -3, -18};
    std::vector<float> audio(block);
    FeqLiveNormalizerReading result{};
    double loud_reference = -120;
    for (unsigned period = 0; period < 6000; ++period) {
      for (unsigned i = 0; i < block; ++i) audio[i] = static_cast<float>(
          (period < 4800 ? 0.1 : 0.05) * std::sin(2 * kPi * 1000 *
          static_cast<double>(period * block + i) / rate));
      float* planes[] = {audio.data()};
      result = feq_live_normalizer_process(live, planes, block, &settings);
      if (period == 4799) {
        gain_at_quiet_start[named] = result.applied_gain_db;
        loud_reference = result.reference_lufs;
      }
    }
    gain_at_end[named] = result.applied_gain_db;
    if (named) check(std::abs(result.reference_lufs - loud_reference) < 0.0001 &&
        std::abs(gain_at_end[named] - gain_at_quiet_start[named]) < 0.0001,
        "an identified ten-minute song retains the level of a quiet movement");
    feq_live_normalizer_destroy(live);
    feq_leveling_memory_destroy(memory);
  }
  check(gain_at_end[0] - gain_at_quiet_start[0] > 0.7,
        "positive control: an unnamed long broadcast still slowly adapts");
}
}
int main() {
  windows_and_chunks();
  versioned_source_gain();
  live_reference_is_independent_of_callback_size();
  long_named_songs_keep_their_quiet_movements();
  return failures == 0 ? 0 : 1;
}
