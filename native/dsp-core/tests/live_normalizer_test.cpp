/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#include "fluideq/live_normalizer.h"
#include "fluideq/primitives.h"
#include "../src/chain_internal.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <vector>

namespace {
int failures = 0;
void check(bool valid, const char* label) {
  std::printf("%s %s\n", valid ? "PASS" : "FAIL", label);
  if (!valid) ++failures;
}
struct Stream {
  double rate;
  uint32_t block, channels;
  uint64_t position = 0;
  FeqLiveNormalizer* processor;
  FeqNormalizerSettings settings{2, -1, -14};
  FeqLiveNormalizerReading reading{};
  std::vector<float> left, right;
  double peak = 0, link_error = 0;
  FeqTruePeak detector{};
  Stream(double hz, uint32_t size, uint32_t count = 2) :
      rate(hz), block(size), channels(count),
      processor(feq_live_normalizer_create(hz, count)), left(size), right(size) {
    feq_true_peak_init(&detector, 4);
  }
  ~Stream() { feq_live_normalizer_destroy(processor); }
  void play(double seconds, double amplitude) {
    uint64_t remaining = static_cast<uint64_t>(std::llround(seconds * rate));
    while (remaining > 0) {
      const auto frames = static_cast<uint32_t>(std::min<uint64_t>(block, remaining));
      for (uint32_t i = 0; i < frames; ++i) {
        left[i] = static_cast<float>(amplitude * std::sin(6.283185307179586 * 1000 *
                                         static_cast<double>(position++) / rate));
        right[i] = -0.5f * left[i];
      }
      float* planes[2] = {left.data(), right.data()};
      reading = feq_live_normalizer_process(processor, planes, frames, &settings);
      peak = std::max(peak, feq_true_peak_block(&detector, left.data(), frames));
      if (channels == 2)
        for (uint32_t i = 0; i < frames; ++i)
          link_error = std::max(link_error, std::abs(static_cast<double>(right[i] + 0.5f * left[i])));
      remaining -= frames;
    }
  }
};
void quiet_sections(double rate, uint32_t block, uint32_t channels) {
  Stream stream(rate, block, channels);
  check(stream.processor != nullptr, "supported source can prepare live leveling");
  stream.play(8, 0.04);
  check(std::abs(stream.reading.applied_gain_db) < 0.01, "learning never boosts the opening seconds");
  stream.play(52, 0.04);
  const double foreground = stream.reading.applied_gain_db;
  check(foreground > 5 && foreground <= 6, "quiet source is actually raised, within the six dB limit");
  const double reference = stream.reading.reference_lufs;
  stream.play(45, 0.004);
  check(stream.reading.level_state == 3, "sustained quiet passage stays in hold after its window settles");
  check(std::abs(stream.reading.applied_gain_db - foreground) < 0.1,
        "forty-five quiet seconds retain musical contrast");
  check(std::abs(stream.reading.reference_lufs - reference) < 0.1,
        "quiet passage cannot drag the programme reference down");
  stream.play(4, 0);
  check(stream.reading.reference_lufs == -120, "silent source boundary clears the old programme");
  stream.play(60, 0.5);
  check(stream.reading.input_lufs > -14, "replacement source exceeds the requested loudness");
  check(stream.reading.applied_gain_db < 0, "a new louder source is relearned and attenuated");
  check(stream.link_error < 1e-6, "stereo ratio and opposite polarity remain intact");
  feq_live_normalizer_silence(stream.processor, static_cast<uint32_t>(rate));
  stream.play(0.1, 0.5);
  check(stream.reading.reference_lufs > -120, "short host silence does not discard programme history");
  feq_live_normalizer_silence(stream.processor, static_cast<uint32_t>(rate * 3));
  stream.play(0.1, 0.5);
  check(stream.reading.reference_lufs == -120 && stream.reading.level_state == 2,
        "host-flagged silent gap restarts learning without reading a sample buffer");
  stream.settings.mode = 0;
  stream.play(3, 0.04);
  check(std::abs(stream.reading.applied_gain_db) < 0.01, "Off returns to unity");
}
void protection() {
  Stream stream(48000, 127);
  stream.play(55, 0.04);
  stream.peak = 0;
  stream.play(0.5, 2);
  stream.play(0.1, 0);
  check(20 * std::log10(stream.peak) <= -0.85, "unexpected loud source stays below the true-peak ceiling");
  Stream bypass(48000, 127);
  bypass.settings.mode = 0;
  bypass.play(0.5, 2);
  check(bypass.peak > 1.8, "positive control: the same source exceeds full scale without protection");
  Stream peak_only(48000, 256);
  peak_only.settings.mode = 1;
  peak_only.play(5, 0.1);
  check(std::abs(peak_only.reading.applied_gain_db) < 0.01, "peak protection does not lift quiet audio");
  Stream crest(48000, 256);
  crest.settings.target_lufs = -5;
  crest.play(60, 0.75);
  check(crest.reading.applied_gain_db < 1.1, "peak headroom prevents forcing a loudness target through limiting");
}
void restoration_edit() {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.normalizer = {2, -1, -14};
  settings.denoise.enabled = 1;
  settings.denoise.click.enabled = 0;
  auto* previous = feq_chain_create(48000, 2, 256);
  feq_chain_configure(previous, &settings);
  feq_chain_enable_live_normalizer(previous);
  std::vector<float> left(256), right(256);
  float* audio[] = {left.data(), right.data()};
  // Match system rack preparation: adopt pending kernels before publication.
  feq_chain_process(previous, audio, 256);
  feq_chain_reset(previous, FEQ_CHAIN_RESET_STREAM_START);
  FeqLiveNormalizerReading before{};
  for (uint32_t block = 0; block < 12000; ++block) {
    for (uint32_t frame = 0; frame < 256; ++frame) {
      left[frame] = right[frame] = static_cast<float>(0.04 * std::sin(
          6.283185307179586 * 1000 * (block * 256 + frame) / 48000));
    }
    before = feq_live_normalizer_process(previous->live_normalizer, audio, 256, &settings.normalizer);
  }
  check(before.applied_gain_db > 5, "restoration edit starts from audible normalization");
  settings.denoise.click.enabled = 1;
  auto* next = feq_chain_create(48000, 2, 256);
  feq_chain_configure(next, &settings);
  feq_chain_enable_live_normalizer(next);
  std::fill(left.begin(), left.end(), 0.0f);
  std::fill(right.begin(), right.end(), 0.0f);
  feq_chain_process(next, audio, 256);
  feq_chain_reset(next, FEQ_CHAIN_RESET_STREAM_START);
  check(feq_chain_transfer_state(next, previous) == 1, "restoration toggle retains independent rack histories");
  const auto after = feq_live_normalizer_process(next->live_normalizer, audio, 256, &settings.normalizer);
  check(std::abs(after.applied_gain_db - before.applied_gain_db) < 0.01 && after.reference_lufs > -120,
        "restoration toggle preserves learned loudness and applied gain");
  feq_chain_destroy(next);
  feq_chain_destroy(previous);
}
}
int main() {
  quiet_sections(44100, 127, 2);
  quiet_sections(48000, 512, 2);
  quiet_sections(96000, 257, 1);
  protection();
  restoration_edit();
  return failures == 0 ? 0 : 1;
}
