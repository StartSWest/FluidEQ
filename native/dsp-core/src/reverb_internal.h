/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Reverb's parts (`reverb.h`, `reverb.cpp`): Dattorro's lengths and
 * taps, the five voicings, the delay line and all-pass they are built
 * from, and the stage's state. Apart from the stage's processing so
 * neither file grows past what one can read.
 */
#ifndef FLUIDEQ_REVERB_INTERNAL_H
#define FLUIDEQ_REVERB_INTERNAL_H

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <vector>

#include "fluideq/reverb.h"

namespace feq_reverb_detail {

constexpr double kPi = 3.14159265358979323846;
constexpr double kPaperRate = 29761.0;
/** The largest type's size, which every line is allocated for. */
constexpr double kMaxSize = 1.35;
/** The modulated all-passes' swing, in paper samples, and their rates. */
constexpr double kExcursion = 16.0;
constexpr double kModLeftHz = 0.5;
constexpr double kModRightHz = 0.61;
/** Dial moves, type changes and the switch fade over this. */
constexpr double kFadeSeconds = 0.020;
/** Under this a mono sum is silence to the ducker. */
constexpr double kDuckThresholdDb = -45.0;
constexpr double kDuckAttackSeconds = 0.030;
/**
 * The tail has to bloom inside the gaps between words, a few hundred ms:
 * the voice's envelope lets go in 40 ms and the gain comes back in 150 ms.
 * At 120 and 300 ms it was still 2.5 dB down 0.6 s into a pause.
 */
constexpr double kDuckReleaseSeconds = 0.150;
constexpr double kDuckEnvelopeSeconds = 0.040;

/** One type's character (the plan's table, 2026-11-23). */
struct Voicing {
  double size;
  /** The input low-pass's coefficient, Dattorro's "bandwidth". */
  double bandwidth;
  double input_diffusion_1;
  double input_diffusion_2;
  double decay_diffusion_1;
};

constexpr std::array<Voicing, FEQ_REVERB_TYPES> kVoicings{{
    // Plate: bright and dense, the paper's own values.
    {1.0, 0.9995, 0.75, 0.625, 0.70},
    // Vocal plate: smaller and darker, sits behind a voice.
    {0.8, 0.70, 0.70, 0.60, 0.65},
    // Room: small and close.
    {0.45, 0.90, 0.60, 0.50, 0.55},
    // Chamber: rounder early build-up.
    {0.70, 0.85, 0.75, 0.65, 0.70},
    // Hall: big, slow build.
    {kMaxSize, 0.80, 0.75, 0.625, 0.70},
}};

/**
 * Dattorro's lengths at 29761 Hz: the paper's four input diffusers, then
 * four short ones of our own. With the paper's alone the tail took 165-230
 * ms past its onset to reach an echo density of 0.9 (Abel and Huang), a
 * grain heard on a voice's first syllable; all-passes change no level at
 * any frequency, only how early the echoes are many.
 */
constexpr int kDiffusers = 8;
constexpr double kInput[kDiffusers] = {142, 107, 379, 277, 89, 61, 47, 31};
constexpr double kExtraDiffusion = 0.6;
constexpr double kLeftAp1 = 672, kLeftD1 = 4453, kLeftAp2 = 1800,
                 kLeftD2 = 3720;
constexpr double kRightAp1 = 908, kRightD1 = 4217, kRightAp2 = 2656,
                 kRightD2 = 3163;
/** Output taps: line, offset, sign. Seven a side, the paper's. */
enum Tap { kL1, kLAp2, kL2, kR1, kRAp2, kR2 };
struct TapPoint {
  Tap line;
  double at;
  double sign;
};
constexpr TapPoint kLeftTaps[7] = {
    {kR1, 266, 1},     {kR1, 2974, 1},  {kRAp2, 1913, -1}, {kR2, 1996, 1},
    {kL1, 1990, -1},   {kLAp2, 187, -1}, {kL2, 1066, -1}};
constexpr TapPoint kRightTaps[7] = {
    {kL1, 353, 1},     {kL1, 3627, 1},  {kLAp2, 1228, -1}, {kL2, 2673, 1},
    {kR1, 2111, -1},   {kRAp2, 335, -1}, {kR2, 121, -1}};

/** A power-of-two ring read back at whole or fractional delays. */
struct Line {
  std::vector<float> data;
  uint32_t mask = 0;
  uint32_t write = 0;

  void allocate(double longest) {
    uint32_t size = 1;
    while (size < static_cast<uint32_t>(std::ceil(longest)) + 4) size <<= 1;
    data.assign(size, 0.0f);
    mask = size - 1;
    write = 0;
  }
  void clear() {
    std::fill(data.begin(), data.end(), 0.0f);
    write = 0;
  }
  void push(float value) {
    data[write] = value;
    write = (write + 1) & mask;
  }
  /** The sample written `delay` pushes ago (1 is the last one). */
  float at(uint32_t delay) const { return data[(write - delay) & mask]; }
  float at_fraction(double delay) const {
    const auto whole = static_cast<uint32_t>(delay);
    const auto part = static_cast<float>(delay - whole);
    const float a = at(whole);
    const float b = at(whole + 1);
    return a + (b - a) * part;
  }
};

/** w[n] = x + g·w[n-D]; y = w[n-D] - g·w[n]. Unity gain at every frequency. */
inline float allpass(Line& line, double delay, float g, float x) {
  const float delayed = line.at_fraction(delay);
  const float w = x + g * delayed;
  line.push(w);
  return delayed - g * w;
}

struct Biquad {
  double b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  double z1 = 0, z2 = 0;
  float run(float x) {
    const double y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2;
    z2 = b2 * x - a2 * y;
    return static_cast<float>(y);
  }
};

/** A Butterworth high-pass (Q 1/sqrt 2), the cookbook's. */
inline void high_pass(Biquad& filter, double corner_hz, double rate) {
  const double w0 = 2.0 * kPi * std::min(corner_hz, rate * 0.45) / rate;
  const double alpha = std::sin(w0) / (2.0 * std::sqrt(0.5));
  const double cosw = std::cos(w0);
  const double a0 = 1.0 + alpha;
  filter.b0 = (1.0 + cosw) / 2.0 / a0;
  filter.b1 = -(1.0 + cosw) / a0;
  filter.b2 = (1.0 + cosw) / 2.0 / a0;
  filter.a1 = -2.0 * cosw / a0;
  filter.a2 = (1.0 - alpha) / a0;
}

inline double clamp(double value, double low, double high) {
  return std::min(high, std::max(low, value));
}

}  // namespace feq_reverb_detail

struct FeqReverb {
  double rate = 48000.0;
  uint32_t channels = 2;
  FeqReverbSettings settings{};

  // Derived from the settings, control thread.
  double scale = 1.0;  // samples per paper sample, rate and size
  double excursion = 0.0;
  float bandwidth = 0.9995f;
  float input_g1 = 0.75f, input_g2 = 0.625f;
  float decay_g1 = 0.70f, decay_g2 = 0.5f;
  float decay = 0.5f;
  float damping = 0.0005f;
  double predelay_samples = 0.0;
  float target_wet = 0.0f;
  float width_same = 1.0f, width_cross = 0.0f;
  float duck_floor = 1.0f;
  feq_reverb_detail::Biquad low_cut;

  // The tank and what feeds it, audio thread.
  feq_reverb_detail::Line predelay;
  std::array<feq_reverb_detail::Line, feq_reverb_detail::kDiffusers> input;
  feq_reverb_detail::Line left_ap1, left_d1, left_ap2, left_d2;
  feq_reverb_detail::Line right_ap1, right_d1, right_ap2, right_d2;
  float bandwidth_state = 0.0f;
  float damp_left = 0.0f, damp_right = 0.0f;
  double mod_phase_left = 0.0, mod_phase_right = 0.25;
  float wet = 0.0f;       // smoothed wet gain
  float fade = 1.0f;      // brought in after a type change, out when off
  float duck_env = 0.0f;  // the dry voice's envelope
  float duck_gain = 1.0f;
  /** A pre-delay crossed from: its length and how far the cross has come. */
  double predelay_from = 0.0;
  float predelay_cross = 1.0f;
  float denormal_guard = 1e-18f;
  /** A type's taps crossed from: the old type's scale and how far. */
  double tap_scale_from = 1.0;
  float tap_cross = 1.0f;
  int running = 0;  // the tank holds a tail worth playing

  // Per-sample coefficients for the smoothers.
  float fade_step = 0.0f;
  float wet_coefficient = 0.0f;
  float duck_attack = 0.0f, duck_release = 0.0f, duck_env_release = 0.0f;
};

#endif  // FLUIDEQ_REVERB_INTERNAL_H
