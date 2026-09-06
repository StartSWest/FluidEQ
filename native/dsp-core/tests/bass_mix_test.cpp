/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Exercise the actual contribution filter and the public processor separately:
 * fixed gains expose polarity cancellation; musical bursts prove the controls
 * actually reach that filter, including smoothing, bypass and Isolate. */
#include "../src/bass_punch_internal.h"
#include "dsp_test_support.h"

#include <algorithm>
#include <limits>
#include <memory>

using namespace feq_test;

namespace {
constexpr uint32_t kBlock = 512;

FeqBassPunchSettings settings() {
  FeqBassPunchSettings value{};
  value.enabled = 1;
  value.split_hz = 120.0;
  value.attack = 0.85;
  value.sustain = -0.35;
  value.bloom_amount = 0.15;
  value.bloom_decay_ms = 100.0;
  value.duck = 0.5;
  value.mix = 1.0;
  return value;
}

struct Stage {
  std::unique_ptr<FeqBassPunch> state = std::make_unique<FeqBassPunch>();
  std::vector<float> low = std::vector<float>(2 * kBlock);
  std::vector<std::vector<float>> lines;
  std::vector<float*> pointers;
  explicit Stage(double rate) {
    const auto capacity = feq_bass_punch_bloom_capacity(rate);
    lines.assign(FEQ_BASS_PUNCH_BLOOM_LINES, std::vector<float>(capacity));
    for (auto& line : lines) pointers.push_back(line.data());
    feq_bass_punch_init(state.get(), low.data(), pointers.data(), capacity);
  }
};

Signal programme(double rate) {
  Signal result;
  result.left.resize(static_cast<size_t>(rate));
  result.right.resize(result.left.size());
  for (size_t at = 0; at < result.left.size(); ++at) {
    const double t = static_cast<double>(at) / rate;
    const double hit = std::fmod(t, 0.25);
    const double bass = 0.12 * std::sin(2 * kPi * 60 * t) * std::exp(-hit / 0.035);
    const double high = 0.03 * std::sin(2 * kPi * 997 * t);
    result.left[at] = static_cast<float>(bass + high);
    result.right[at] = static_cast<float>(bass * 0.4 - high);
  }
  return result;
}

Signal render(const Signal& input, FeqBassPunchSettings config, double rate,
              uint32_t block = kBlock, bool automate = false) {
  Stage stage(rate);
  Signal out = input;
  // Fixed parameter-change boundaries let block partitioning be tested without
  // moving the automation relative to source samples.
  for (size_t at = 0; at < out.left.size();) {
    const size_t boundary = ((at / 4096) + 1) * 4096;
    const auto span = static_cast<uint32_t>(
        std::min({out.left.size() - at, boundary - at, size_t(block)}));
    if (automate) {
      const double amounts[] = {0.0, 1.0, 2.0, 0.5, 0.0};
      config.mix = amounts[(at / 4096) % 5];
    }
    float* channels[] = {out.left.data() + at, out.right.data() + at};
    feq_bass_punch_process(stage.state.get(), channels, 2, span, &config, rate);
    at += span;
  }
  return out;
}

void test_band_gain_and_polarity() {
  bool cuts_ok = true, boosts_ok = true, boundary_ok = true;
  for (double rate : {44100.0, 48000.0, 96000.0, 192000.0}) {
    auto state = std::make_unique<FeqBassPunch>();
    for (double gain : {0.1, 0.25, 0.5, 0.9, 1.0, 2.0, 4.0}) {
      for (double mix : {0.0, 0.5, 1.0, 1.5, 2.0}) {
        bass_punch_band_reset(state.get());
        bass_punch_band_prepare(state.get(), rate);
        double output = 0;
        for (uint32_t at = 0; at < feq_bass_punch_latency_frames(rate) * 4; ++at) {
          output = bass_punch_band_sample(state.get(), 0, 0.25, gain, 0, mix, false);
        }
        const double expected = gain < 1 && mix > 1
                                    ? std::pow(gain, mix)
                                    : 1 + mix * (gain - 1);
        if (gain < 1) cuts_ok &= output > 0 && std::fabs(output / 0.25 - expected) < 1e-9;
        else boosts_ok &= std::fabs(output / 0.25 - expected) < 1e-9;
      }
    }
    // The old LR4 recombination inverted a boost at its 200 Hz corner.
    // Correlation measures signed gain; RMS alone would pass an inversion.
    for (double hz : {40.0, 60.0, 120.0, 200.0, 300.0, 500.0, 1000.0, 8000.0}) {
      bass_punch_band_reset(state.get());
      bass_punch_band_prepare(state.get(), rate);
      const auto delay = feq_bass_punch_latency_frames(rate);
      double cross = 0, energy = 0;
      for (uint32_t at = 0; at < static_cast<uint32_t>(rate); ++at) {
        const float input = static_cast<float>(0.1 * std::sin(2 * kPi * hz * at / rate));
        const double out = bass_punch_band_sample(state.get(), 0, input, 4, 0, 2, false);
        if (at > delay * 4) {
          const double dry = 0.1 * std::sin(2 * kPi * hz * (at - delay) / rate);
          cross += out * dry;
          energy += dry * dry;
        }
      }
      const double delivered = cross / energy;
      boundary_ok &= delivered >= 1.0 - 1e-6;
      if (hz >= 500) boundary_ok &= std::fabs(delivered - 1) < 0.001;
      if (hz == 60) boundary_ok &= delivered > 5;
    }
  }
  check(cuts_ok, "deep cuts remain positive and deepen correctly through 200%");
  check(boosts_ok, "boost contribution doubles at 200%, with unity dry preserved");
  check(boundary_ok, "boosts never cancel at the boundary and leave mids/treble alone");
}

void test_public_mix() {
  bool dry_ok = true, identity_ok = true, linear_ok = true, doubled_ok = true;
  bool active = true, partition_ok = true, finite = true;
  for (double rate : {44100.0, 48000.0, 96000.0, 192000.0}) {
    const Signal input = programme(rate);
    auto config = settings();
    config.sustain = 0; // Only additions: the >100% cut law is checked above.
    config.mix = 0;
    const Signal dry = render(input, config, rate);
    config.mix = 1;
    const Signal wet = render(input, config, rate);
    config.mix = 0.5;
    const Signal half = render(input, config, rate);
    config.mix = 2;
    const Signal doubled = render(input, config, rate);
    config.isolate = 1;
    const Signal isolated = render(input, config, rate);
    const auto delay = feq_bass_punch_latency_frames(rate);
    double effect = 0;
    for (size_t at = delay; at < input.left.size(); ++at) {
      dry_ok &= dry.left[at] == input.left[at - delay];
      const double delta = wet.left[at] - dry.left[at];
      effect = std::max(effect, std::fabs(delta));
      linear_ok &= std::fabs(half.left[at] - dry.left[at] - delta * 0.5) < 1e-7;
      doubled_ok &= std::fabs(doubled.left[at] - dry.left[at] - delta * 2) < 1e-7;
      identity_ok &= std::fabs(doubled.left[at] - dry.left[at] - isolated.left[at]) < 1e-7;
    }
    active &= effect > 0.05;
    config = settings();
    const Signal single = render(input, config, rate, 1, true);
    const Signal odd = render(input, config, rate, 127, true);
    const Signal blocks = render(input, config, rate, kBlock, true);
    partition_ok &= identical(single, odd) && identical(odd, blocks);
    for (float value : blocks.left) finite &= std::isfinite(value);
  }
  check(dry_ok, "Mix zero is exactly the source after the reported fixed delay");
  check(linear_ok && doubled_ok, "the public Mix blends halfway and doubles additions");
  check(identity_ok && active, "Isolate is exactly the audible contribution, and it is substantial");
  check(partition_ok && finite, "automated Mix is finite and identical across block sizes and rates");
}

void test_dry_endpoints_and_reset() {
  constexpr double rate = 48000;
  Signal input = programme(rate);
  auto config = settings();
  config.mix = 0;
  const Signal zero = render(input, config, rate);
  config.enabled = 0;
  config.mix = 2;
  check(identical(zero, render(input, config, rate)), "bypass and zero Mix have identical alignment");
  config.enabled = 1;
  config.mix = std::numeric_limits<double>::quiet_NaN();
  check(identical(zero, render(input, config, rate)), "non-finite Mix cannot poison the processor");
  config.mix = 0;
  config.isolate = 1;
  const Signal silent = render(input, config, rate);
  check(rms(silent, 0) == 0, "zero Mix in Isolate is exact silence");
  // Fade from full FX to zero; then drain the finite FIR. Returning dry must
  // not leave a persistent rounded gain or an old negative contribution.
  Stage stage(rate);
  config = settings();
  config.mix = 2;
  Signal first = input;
  float* channels[] = {first.left.data(), first.right.data()};
  feq_bass_punch_process(stage.state.get(), channels, 2, kBlock, &config, rate);
  config.mix = 0;
  bool exact = true;
  for (size_t at = 0; at < input.left.size(); at += kBlock) {
    const auto count = static_cast<uint32_t>(std::min(size_t(kBlock), input.left.size() - at));
    channels[0] = input.left.data() + at;
    channels[1] = input.right.data() + at;
    feq_bass_punch_process(stage.state.get(), channels, 2, count, &config, rate);
    if (at > rate * 0.5) {
      for (uint32_t i = 0; i < count; ++i) exact &= input.left[at + i] == zero.left[at + i];
    }
  }
  check(exact, "returning to zero Mix settles to exact dry after the fade");
}
} // namespace

int main() {
  test_band_gain_and_polarity();
  test_public_mix();
  test_dry_endpoints_and_reset();
  return finish();
}
