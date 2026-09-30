/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** What the denoise tests measure with: the check, the seeded noise, the level probes and a stage run over a signal. */
#ifndef FLUIDEQ_DENOISE_TEST_SUPPORT_H
#define FLUIDEQ_DENOISE_TEST_SUPPORT_H

#include "fluideq/denoise.h"
#include "fluideq/convolver.h"
#include <cmath>
#include <cstdio>
#include <cstring>
#include <cstdint>
#include <vector>

namespace feq_denoise_test {

inline int g_failures = 0;

inline void check(bool condition, const char* what) {
  if (!condition) {
    std::printf("  FAIL %s\n", what);
    ++g_failures;
  } else {
    std::printf("  ok   %s\n", what);
  }
}

constexpr double kPi = 3.14159265358979323846;
constexpr double kRate = 48000.0;
constexpr uint32_t kFrames = 512;

/** A deterministic white-noise source, so a failure can be reproduced. */
struct Noise {
  uint32_t state = 22222u;
  double next() {
    state = state * 1664525u + 1013904223u;
    return (static_cast<double>(state >> 8) / 8388608.0) - 1.0;
  }
};

inline FeqDenoiseSettings bypassed_modules() {
  FeqDenoiseSettings settings{};
  feq_denoise_settings_defaults(&settings);
  settings.enabled = 1;
  settings.hiss.enabled = 0;
  settings.hum.enabled = 0;
  settings.click.enabled = 0;
  settings.voice.enabled = 0;
  return settings;
}

/** Level of one frequency, by projection onto a whole number of cycles. */
inline double tone_level_db(const std::vector<float>& signal,
                     double hz,
                     uint32_t from,
                     uint32_t count) {
  double real = 0.0;
  double imaginary = 0.0;
  for (uint32_t i = 0; i < count; i += 1) {
    const double phase = 2.0 * kPi * hz * static_cast<double>(from + i) / kRate;
    real += signal[from + i] * std::cos(phase);
    imaginary += signal[from + i] * std::sin(phase);
  }
  const double magnitude =
      2.0 * std::sqrt(real * real + imaginary * imaginary) /
      static_cast<double>(count);
  return magnitude > 1e-12 ? 20.0 * std::log10(magnitude) : -240.0;
}

/**
 * Average power across a band, in dB.
 *
 * A single projection is the right instrument for a TONE and the wrong one for
 * noise: at one frequency a broadband signal gives a chi-square estimate with
 * two degrees of freedom, which scatters by several decibels run to run and
 * cannot tell a real 2 dB difference from its own variance. Thirty-two probes
 * spread across the band average that down to where a comparison means
 * something.
 */
inline double band_level_db(const std::vector<float>& signal,
                     double low,
                     double high,
                     uint32_t from,
                     uint32_t count) {
  constexpr uint32_t kProbes = 32;
  double sum = 0.0;
  for (uint32_t i = 0; i < kProbes; i += 1) {
    const double t = static_cast<double>(i) / static_cast<double>(kProbes - 1);
    const double db =
        tone_level_db(signal, low * std::pow(high / low, t), from, count);
    sum += std::pow(10.0, db / 10.0);
  }
  return 10.0 * std::log10(sum / static_cast<double>(kProbes));
}

inline double rms_db(const std::vector<float>& signal, uint32_t from, uint32_t count) {
  double sum = 0.0;
  for (uint32_t i = 0; i < count; i += 1) {
    sum += static_cast<double>(signal[from + i]) *
           static_cast<double>(signal[from + i]);
  }
  const double rms = std::sqrt(sum / static_cast<double>(count));
  return rms > 1e-12 ? 20.0 * std::log10(rms) : -240.0;
}

/** What the stage delays by, for a given configuration. */
inline uint32_t latency_of(const FeqDenoiseSettings& settings) {
  FeqDenoise* denoise = feq_denoise_create(kRate, 2, kFrames);
  feq_denoise_configure(denoise, &settings);
  const uint32_t latency = feq_denoise_latency_frames(denoise);
  feq_denoise_destroy(denoise);
  return latency;
}

/** Run a signal through a configured stage and return what came out. */
inline std::vector<float> run(const FeqDenoiseSettings& settings,
                       const std::vector<float>& input,
                       const FeqNoiseProfile* profile) {
  FeqDenoise* denoise = feq_denoise_create(kRate, 2, kFrames);
  feq_denoise_configure(denoise, &settings);
  if (profile != nullptr) {
    feq_denoise_set_profile(denoise, profile);
  }

  std::vector<float> left = input;
  std::vector<float> right = input;
  for (uint32_t at = 0; at + kFrames <= input.size(); at += kFrames) {
    float* channels[2] = {left.data() + at, right.data() + at};
    feq_denoise_process(denoise, channels, kFrames);
  }
  feq_denoise_destroy(denoise);
  return left;
}

}  // namespace feq_denoise_test

#endif  // FLUIDEQ_DENOISE_TEST_SUPPORT_H
