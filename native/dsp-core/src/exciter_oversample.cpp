/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/exciter_oversample.h"

#include <array>
#include <cmath>

namespace {

constexpr int kTaps = FEQ_EXCITER_STEEP_TAPS;
constexpr double kPi = 3.14159265358979323846;
/**
 * The cut-off, as a share of the doubled rate: between the pass edge at
 * 0.21 (0.42 of the output's rate) and the stop edge at 0.25 (its Nyquist).
 */
constexpr double kCutoff = 0.23;
/** Kaiser's beta for 90 dB, from 0.1102 * (A - 8.7). */
constexpr double kBeta = 0.1102 * (90.0 - 8.7);

/** The zeroth-order modified Bessel function, by its series. */
double bessel_i0(double x) {
  double sum = 1.0;
  double term = 1.0;
  const double quarter = x * x / 4.0;
  for (int k = 1; k < 64; ++k) {
    term *= quarter / (static_cast<double>(k) * static_cast<double>(k));
    sum += term;
    if (term < sum * 1e-17) {
      break;
    }
  }
  return sum;
}

std::array<double, kTaps> design_steep() {
  std::array<double, kTaps> taps{};
  const double middle = (kTaps - 1) / 2.0;
  const double norm = bessel_i0(kBeta);
  double sum = 0.0;
  for (int at = 0; at < kTaps; ++at) {
    const double n = static_cast<double>(at) - middle;
    const double ideal = n == 0.0
                             ? 2.0 * kCutoff
                             : std::sin(2.0 * kPi * kCutoff * n) / (kPi * n);
    const double r = n / middle;
    const double window = bessel_i0(kBeta * std::sqrt(1.0 - r * r)) / norm;
    taps[static_cast<size_t>(at)] = ideal * window;
    sum += taps[static_cast<size_t>(at)];
  }
  // Unity at DC, as the shared half-band is: the choice never moves the level.
  for (double& tap : taps) {
    tap /= sum;
  }
  return taps;
}

const std::array<double, kTaps> kSteep = design_steep();

double push(double* history, int* position, double sample) {
  const int newest = *position;
  history[newest] = sample;
  double sum = 0.0;
  int tap = 0;
  for (int read = newest; read >= 0; read -= 1) {
    sum += history[read] * kSteep[static_cast<size_t>(tap)];
    tap += 1;
  }
  for (int read = kTaps - 1; tap < kTaps; read -= 1) {
    sum += history[read] * kSteep[static_cast<size_t>(tap)];
    tap += 1;
  }
  *position = newest + 1 == kTaps ? 0 : newest + 1;
  return sum;
}

/** The sharp first doubling: zero-stuffed, filtered, gained back by two. */
void steep_up(FeqExciterOversampler* state, const float* input, float* output,
              uint32_t frames) {
  for (uint32_t at = 0; at < frames; ++at) {
    output[at * 2] = static_cast<float>(
        push(state->steep_up, &state->steep_up_position,
             static_cast<double>(input[at])) *
        2.0);
    output[at * 2 + 1] = static_cast<float>(
        push(state->steep_up, &state->steep_up_position, 0.0) * 2.0);
  }
}

/** The sharp last halving: filtered, every second sample kept. */
void steep_down(FeqExciterOversampler* state, const float* input,
                float* output, uint32_t frames) {
  for (uint32_t at = 0; at < frames; ++at) {
    const double kept = push(state->steep_down, &state->steep_down_position,
                             static_cast<double>(input[at * 2]));
    push(state->steep_down, &state->steep_down_position,
         static_cast<double>(input[at * 2 + 1]));
    output[at] = static_cast<float>(kept);
  }
}

void copy(const float* input, float* output, uint32_t frames) {
  for (uint32_t at = 0; at < frames; ++at) {
    output[at] = input[at];
  }
}

}  // namespace

extern "C" {

void feq_exciter_oversampler_reset(FeqExciterOversampler* state) {
  if (state == nullptr) {
    return;
  }
  feq_oversampler_reset(&state->shared);
  for (int tap = 0; tap < kTaps; ++tap) {
    state->steep_up[tap] = 0.0;
    state->steep_down[tap] = 0.0;
  }
  state->steep_up_position = 0;
  state->steep_down_position = 0;
}

uint32_t feq_exciter_oversample_factor(double sample_rate, int quality) {
  return quality == FEQ_EXCITER_OVERSAMPLING_OFF
             ? 1u
             : feq_oversample_factor_for_sample_rate(sample_rate);
}

void feq_exciter_oversample_up(FeqExciterOversampler* state,
                               const float* input,
                               float* output,
                               uint32_t frames,
                               uint32_t factor,
                               int quality,
                               float* middle) {
  if (state == nullptr || input == nullptr || output == nullptr ||
      frames == 0) {
    return;
  }
  if (quality != FEQ_EXCITER_OVERSAMPLING_HIGH) {
    feq_oversample_up(&state->shared, input, output, frames, factor, middle);
    return;
  }
  if (factor == 2) {
    steep_up(state, input, output, frames);
    return;
  }
  if (factor != 4 || middle == nullptr) {
    copy(input, output, frames);
    return;
  }
  steep_up(state, input, middle, frames);
  feq_oversample_stage_up(&state->shared, 1, middle, output, frames * 2);
}

void feq_exciter_oversample_down(FeqExciterOversampler* state,
                                 const float* input,
                                 float* output,
                                 uint32_t frames,
                                 uint32_t factor,
                                 int quality,
                                 float* middle) {
  if (state == nullptr || input == nullptr || output == nullptr ||
      frames == 0) {
    return;
  }
  if (quality != FEQ_EXCITER_OVERSAMPLING_HIGH) {
    feq_oversample_down(&state->shared, input, output, frames, factor, middle);
    return;
  }
  if (factor == 2) {
    steep_down(state, input, output, frames);
    return;
  }
  if (factor != 4 || middle == nullptr) {
    copy(input, output, frames);
    return;
  }
  feq_oversample_stage_down(&state->shared, 1, input, middle, frames * 2);
  steep_down(state, middle, output, frames);
}

uint32_t feq_exciter_oversample_warmup(uint32_t factor, int quality) {
  if (factor != 2 && factor != 4) {
    return 0;
  }
  // The stage at twice the rate, up and down: half its taps each way. The
  // shared stage at four times the rate: a quarter of its taps each way.
  const double first = quality == FEQ_EXCITER_OVERSAMPLING_HIGH
                           ? static_cast<double>(kTaps)
                           : static_cast<double>(FEQ_OVERSAMPLE_TAPS);
  const double second =
      factor == 4 ? static_cast<double>(FEQ_OVERSAMPLE_TAPS) / 2.0 : 0.0;
  return static_cast<uint32_t>(std::ceil(first + second));
}

void feq_exciter_oversample_ramp(float* buffer, uint32_t frames, double from,
                                 double to) {
  if (buffer == nullptr || frames == 0 || (from == 1.0 && to == 1.0)) {
    return;
  }
  const double step = (to - from) / static_cast<double>(frames);
  for (uint32_t at = 0; at < frames; ++at) {
    buffer[at] = static_cast<float>(
        static_cast<double>(buffer[at]) *
        (from + step * static_cast<double>(at + 1)));
  }
}

}  // extern "C"
