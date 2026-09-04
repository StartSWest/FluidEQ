/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** A safe sample peak alone cannot detect a guard roughening sustained bass. */
#include "fluideq/chain.h"
#include "dsp_test_support.h"

#include <algorithm>
#include <memory>

namespace {
constexpr double kPi = 3.14159265358979323846;
constexpr uint32_t kBlock = 256;
using feq_test::check;
using Chain = std::unique_ptr<FeqChain, decltype(&feq_chain_destroy)>;

void filter_stability() {
  for (FeqFilterType type : {FEQ_FILTER_PK, FEQ_FILTER_NO, FEQ_FILTER_LSC,
                              FEQ_FILTER_HSC, FEQ_FILTER_LPQ, FEQ_FILTER_HPQ,
                              FEQ_FILTER_BP}) {
    for (double hz : {16000.0, 18500.0, 20000.0}) {
      const auto coefficients = feq_biquad_coefficients(type, hz, 6.0, 0.707,
                                                         32000.0);
      check(1.0 + coefficients.a1 + coefficients.a2 > 0.0 &&
                1.0 - coefficients.a1 + coefficients.a2 > 0.0 &&
                1.0 - coefficients.a2 > 0.0,
            "preset corners at and above Nyquist have stable poles");
      std::vector<float> impulse(32000, 0.0f);
      impulse[0] = 1.0f;
      FeqBiquadState state{};
      feq_biquad_process(&state, impulse.data(),
                          static_cast<uint32_t>(impulse.size()), &coefficients);
      check(std::all_of(impulse.begin(), impulse.end(),
                          [](float value) { return std::isfinite(value); }),
            "an out-of-band corner never generates invalid samples");
      check(std::all_of(impulse.begin() + 30000, impulse.end(),
                          [](float value) { return std::fabs(value) < 1e-5; }),
            "the filter impulse decays instead of running away");
      if (type == FEQ_FILTER_LPQ) {
        check(impulse[0] > 0.9f, "the protected low-pass still passes its input");
      }
    }
  }
}

void steady_tone(double rate, double hz) {
  Chain chain(feq_chain_create(rate, 2, kBlock), feq_chain_destroy);
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.master.enabled = 1;
  // Manual gain is after every other processor, and must still be protected.
  settings.master.output_trim_db = 9.0;
  feq_chain_configure(chain.get(), &settings);
  std::vector<float> left(kBlock), right(kBlock);
  float* planes[2] = {left.data(), right.data()};
  const size_t frames = static_cast<size_t>(rate * 3.0);
  const size_t start = static_cast<size_t>(rate * 2.0);
  double sine = 0.0;
  double cosine = 0.0;
  double power = 0.0;
  double peak = 0.0;
  double stereo_error = 0.0;
  for (size_t block = 0; block < frames; block += kBlock) {
    const uint32_t span = static_cast<uint32_t>(
        std::min(static_cast<size_t>(kBlock), frames - block));
    for (uint32_t at = 0; at < span; ++at) {
      const double phase = 2.0 * kPi * hz * static_cast<double>(block + at) / rate;
      left[at] = static_cast<float>(0.94 * std::sin(phase));
      right[at] = left[at] * 0.5f;
    }
    feq_chain_process(chain.get(), planes, span);
    for (uint32_t at = 0; at < span; ++at) {
      peak = std::max(peak, std::fabs(static_cast<double>(left[at])));
      stereo_error = std::max(stereo_error,
          std::fabs(static_cast<double>(left[at]) * 0.5 - right[at]));
      if (block + at < start) continue;
      const double phase = 2.0 * kPi * hz * static_cast<double>(block + at) / rate;
      sine += left[at] * std::sin(phase);
      cosine += left[at] * std::cos(phase);
      power += static_cast<double>(left[at]) * left[at];
    }
  }
  const double count = static_cast<double>(frames - start);
  const double fundamental = 2.0 * (sine * sine + cosine * cosine) / count;
  const double thdn = std::sqrt(std::max(0.0, power - fundamental) /
                                std::max(fundamental, 1e-20));
  std::printf("  %.0f Hz at %.0f samples/s: THD+N %.5f%% peak %.6f\n",
              hz, rate, thdn * 100.0, peak);
  check(peak <= 1.0, "manual gain cannot escape the final ceiling");
  check(thdn < 0.002, "limiting a sustained note adds less than 0.2% distortion");
  check(power / count > 0.1, "the guard preserves an audible fundamental");
  check(stereo_error < 1e-6, "peak protection preserves stereo balance");
}

void recovery() {
  const double rate = 48000.0;
  Chain chain(feq_chain_create(rate, 2, kBlock), feq_chain_destroy);
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  feq_chain_configure(chain.get(), &settings);
  std::vector<float> left(kBlock), right(kBlock);
  float* planes[2] = {left.data(), right.data()};
  double reference_power = 0.0;
  double recovered_power = 0.0;
  const size_t frames = 48000 * 10;
  for (size_t block = 0; block < frames; block += kBlock) {
    const uint32_t span = static_cast<uint32_t>(
        std::min(static_cast<size_t>(kBlock), frames - block));
    for (uint32_t at = 0; at < span; ++at) {
      const size_t position = block + at;
      const double t = static_cast<double>(position) / rate;
      const double amplitude = t >= 2.0 && t < 3.0 ? 2.8 : 0.2;
      left[at] = static_cast<float>(amplitude * std::sin(2.0 * kPi * 1000.0 * t));
      right[at] = left[at];
    }
    feq_chain_process(chain.get(), planes, span);
    for (uint32_t at = 0; at < span; ++at) {
      const size_t position = block + at;
      const double power = static_cast<double>(left[at]) * left[at];
      if (position >= 48000 && position < 96000) reference_power += power;
      if (position >= 432000) recovered_power += power;
    }
  }
  const double difference = 10.0 * std::log10(recovered_power / reference_power);
  std::printf("  recovery: %.5f dB relative to the quiet passage before overload\n",
              difference);
  check(std::fabs(difference) < 0.1,
        "one overload does not leave the rest of the track turned down");
}
}  // namespace

int main() {
  filter_stability();
  for (double rate : {44100.0, 48000.0, 96000.0}) {
    for (double hz : {20.0, 40.0, 100.0, 1000.0, 8000.0, 16000.0}) {
      steady_tone(rate, hz);
    }
  }
  recovery();
  return feq_test::finish();
}
