/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The stereo signal harness the native-only stages are held to.
 *
 * Every processor ported from TypeScript is checked against its twin by the
 * parity corpus. The stages written in C++ first — Dimension, Bass Forge, Bass
 * Punch — have no twin, so their property tests ARE the specification, and this
 * is what those tests are written on top of: a stereo pair, the generators that
 * fill one, the two measurements taken of one, and the pass/fail counter.
 *
 * It was extracted from `bass_forge_test.cpp` once a second file wanted it, and
 * deliberately not before: an abstraction shaped by one consumer is a guess.
 *
 * There is no gtest in this tree and nothing here adds one. A test is a
 * function that prints what it measured and calls `check`; `main` returns
 * `g_failures == 0 ? 0 : 1`. The printed numbers are the point — a green suite
 * that reports nothing cannot tell a working stage from a removed one.
 */
#ifndef FLUIDEQ_DSP_TEST_SUPPORT_H
#define FLUIDEQ_DSP_TEST_SUPPORT_H

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <vector>

namespace feq_test {

inline int g_failures = 0;

inline void check(bool condition, const char* what) {
  if (!condition) {
    std::printf("  FAIL %s\n", what);
    ++g_failures;
  } else {
    std::printf("  ok   %s\n", what);
  }
}

/** Reports the tally and returns what `main` should. */
inline int finish() {
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

constexpr double kPi = 3.14159265358979323846;
constexpr double kRate = 48000.0;
constexpr uint32_t kFrames = 512;

struct Signal {
  std::vector<float> left;
  std::vector<float> right;
};

/**
 * One signal through a stage, a block at a time.
 *
 * The block size matters to what is being tested: a stage carrying state
 * across blocks and a stage recomputing from scratch measure the same on one
 * long call and differently on two hundred short ones, which is what the chain
 * actually does.
 */
template <typename Process>
void run_blocks(Signal& signal, Process&& process) {
  const size_t blocks = signal.left.size() / kFrames;
  for (size_t block = 0; block < blocks; ++block) {
    float* channels[2] = {signal.left.data() + block * kFrames,
                          signal.right.data() + block * kFrames};
    process(channels);
  }
}

/** A 32-bit LCG, so every run of a test file measures the same signal. */
struct Noise {
  uint32_t seed;
  double next() {
    seed = seed * 1664525u + 1013904223u;
    return static_cast<double>(seed >> 8) / 8388608.0 - 1.0;
  }
};

/**
 * Pink, because white is the wrong question for anything working in the bass.
 *
 * Under white noise the band under 90 Hz holds three tenths of a percent of the
 * energy, so a six decibel error down there moves the total by four hundredths
 * of a decibel and every possible implementation passes. Paul Kellett's
 * three-pole economy filter: -3 dB per octave to within a quarter of a decibel,
 * which is roughly what a record looks like and puts about a fifth of the
 * energy under 90 Hz.
 */
struct Pink {
  Noise noise{2463534242u};
  double b0 = 0.0;
  double b1 = 0.0;
  double b2 = 0.0;
  double next() {
    const double white = noise.next();
    b0 = 0.99765 * b0 + white * 0.0990460;
    b1 = 0.96300 * b1 + white * 0.2965164;
    b2 = 0.57000 * b2 + white * 1.0526913;
    return b0 + b1 + b2 + white * 0.1848;
  }
};

/** Scaled to a fixed peak, so every run of a sweep is the same loudness. */
inline void normalise(std::vector<float>& samples, double peak) {
  double largest = 0.0;
  for (const float sample : samples) {
    largest = std::fmax(largest, std::fabs(static_cast<double>(sample)));
  }
  if (largest <= 0.0) {
    return;
  }
  const auto scale = static_cast<float>(peak / largest);
  for (float& sample : samples) {
    sample *= scale;
  }
}

/** `mono` feeds one signal to both channels; otherwise they are two. */
inline Signal pink_stereo(size_t count, bool mono) {
  Pink source;
  Pink other{Noise{97531u}, 0.0, 0.0, 0.0};
  Signal out;
  out.left.resize(count);
  out.right.resize(count);
  for (size_t at = 0; at < count; ++at) {
    out.left[at] = static_cast<float>(source.next());
    out.right[at] = mono ? out.left[at] : static_cast<float>(other.next());
  }
  normalise(out.left, 0.5);
  normalise(out.right, 0.5);
  return out;
}

inline Signal sine_stereo(size_t count, double hz, double amplitude) {
  Signal out;
  out.left.resize(count);
  out.right.resize(count);
  for (size_t at = 0; at < count; ++at) {
    const double phase = (2.0 * kPi * hz * static_cast<double>(at)) / kRate;
    out.left[at] = static_cast<float>(amplitude * std::sin(phase));
    out.right[at] = out.left[at];
  }
  return out;
}

inline double rms(const Signal& signal, size_t from) {
  double total = 0.0;
  for (size_t at = from; at < signal.left.size(); ++at) {
    const double l = static_cast<double>(signal.left[at]);
    const double r = static_cast<double>(signal.right[at]);
    total += l * l + r * r;
  }
  const auto count = static_cast<double>((signal.left.size() - from) * 2);
  return std::sqrt(total / count);
}

/** One DFT bin. The tree's only FFT is in TypeScript, and this is eight lines. */
inline double bin_magnitude(const std::vector<float>& samples, double hz,
                            size_t from, size_t count) {
  const double omega = (2.0 * kPi * hz) / kRate;
  double real = 0.0;
  double imaginary = 0.0;
  for (size_t at = 0; at < count; ++at) {
    const double sample = static_cast<double>(samples[from + at]);
    const double angle = omega * static_cast<double>(at);
    real += sample * std::cos(angle);
    imaginary += sample * std::sin(angle);
  }
  return (2.0 * std::sqrt(real * real + imaginary * imaginary)) /
         static_cast<double>(count);
}

inline bool identical(const Signal& one, const Signal& other) {
  for (size_t at = 0; at < one.left.size(); ++at) {
    if (one.left[at] != other.left[at] || one.right[at] != other.right[at]) {
      return false;
    }
  }
  return true;
}

}  // namespace feq_test

#endif /* FLUIDEQ_DSP_TEST_SUPPORT_H */
