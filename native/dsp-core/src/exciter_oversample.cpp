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
constexpr int kHalfTaps = FEQ_OVERSAMPLE_TAPS;
constexpr double kPi = 3.14159265358979323846;
/**
 * Partial sums each filter runs over. A single running sum waits on its own
 * last addition at every tap; with eight, folded, three bands and Organic
 * went from 1.7 to 1.3 ms of every 11 ms block on an efficiency core, the
 * stage whose cost cut a reporter's sound in and out (GitHub issue 30).
 */
constexpr int kLanes = 8;
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

/**
 * A symmetric filter of odd length as its two phases: the even-numbered taps
 * (`even[j]` is tap `2j`, meeting the sample `j` back) and the odd-numbered
 * (`odd[j]` is tap `2j + 1`). Each phase is symmetric in its own right, so a
 * sum adds the two samples a tap pair weighs and takes half the products.
 */
struct Phases {
  int even_count = 0;
  int odd_count = 0;
  std::array<double, FEQ_EXCITER_RING> even{};
  std::array<double, FEQ_EXCITER_RING> odd{};
  /**
   * Only the odd phase's centre: a half-band's other odd taps fall on the
   * zeros of its sinc, where the design computes rounding of sin(kπ) — 1e-17
   * — rather than the zero they are, and summing them was half its work.
   */
  bool odd_is_centre = false;
};

Phases split(const double* taps, int count, bool half_band) {
  Phases phases;
  phases.even_count = (count + 1) / 2;
  phases.odd_count = (count - 1) / 2;
  for (int j = 0; j < phases.even_count; ++j) {
    phases.even[static_cast<size_t>(j)] = taps[2 * j];
  }
  for (int j = 0; j < phases.odd_count; ++j) {
    phases.odd[static_cast<size_t>(j)] = taps[2 * j + 1];
  }
  phases.odd_is_centre = half_band;
  return phases;
}

Phases split_half_band() {
  std::array<double, kHalfTaps> taps{};
  feq_oversample_half_band_design(taps.data());
  return split(taps.data(), kHalfTaps, true);
}

const Phases kHalfPhases = split_half_band();
const Phases kSteepPhases = split(kSteep.data(), kTaps, false);

/**
 * One sample into a ring of `length` kept twice over, side by side, so its
 * last `length` samples always lie in one unbroken run ending at the newest:
 * a sum walks straight down an array with no wrap to test per tap.
 */
const double* store(FeqExciterRing* ring, int length, double sample) {
  const int newest = ring->position;
  ring->samples[newest] = sample;
  ring->samples[newest + length] = sample;
  ring->position = newest + 1 == length ? 0 : newest + 1;
  return ring->samples + newest + length;
}

/** The ring's newest sample's place, without storing one. */
const double* newest_of(const FeqExciterRing* ring, int length) {
  const int newest = ring->position == 0 ? length - 1 : ring->position - 1;
  return ring->samples + newest + length;
}

/**
 * `kernel[j]` times the sample `j` back, summed, for a symmetric kernel of
 * `count` taps: tap pairs folded, in `kLanes` partial sums.
 */
double folded(const double* kernel, const double* newest, int count) {
  const int pairs = count / 2;
  double lane[kLanes] = {};
  int at = 0;
  for (; at + kLanes <= pairs; at += kLanes) {
    for (int j = 0; j < kLanes; ++j) {
      lane[j] += kernel[at + j] *
                 (newest[-(at + j)] + newest[-(count - 1 - at - j)]);
    }
  }
  double sum = count % 2 != 0 ? kernel[pairs] * newest[-pairs] : 0.0;
  for (; at < pairs; ++at) {
    sum += kernel[at] * (newest[-at] + newest[-(count - 1 - at)]);
  }
  for (const double part : lane) {
    sum += part;
  }
  return sum;
}

double odd_phase(const Phases& phases, const double* newest) {
  if (phases.odd_is_centre) {
    const int centre = phases.odd_count / 2;
    return phases.odd[static_cast<size_t>(centre)] * newest[-centre];
  }
  return folded(phases.odd.data(), newest, phases.odd_count);
}

/**
 * One doubling: zero-stuffing then filtering, which is what interpolation
 * is, with the stuffed zeros never stored. The x2 restores the level the
 * zeros would halve.
 */
void stage_up(FeqExciterStage* stage, const Phases& phases, const float* input,
              float* output, uint32_t frames) {
  for (uint32_t at = 0; at < frames; ++at) {
    const double* newest =
        store(&stage->up, phases.even_count, static_cast<double>(input[at]));
    output[at * 2] = static_cast<float>(
        folded(phases.even.data(), newest, phases.even_count) * 2.0);
    output[at * 2 + 1] =
        static_cast<float>(odd_phase(phases, newest) * 2.0);
  }
}

/**
 * One halving: filtered, every second sample kept. The even-numbered
 * samples meet the even taps and the odd-numbered — the one before the kept
 * sample and back — the odd taps; the sample after the kept one waits for
 * the next sum.
 */
void stage_down(FeqExciterStage* stage, const Phases& phases,
                const float* input, float* output, uint32_t frames) {
  for (uint32_t at = 0; at < frames; ++at) {
    const double* even = store(&stage->down_even, phases.even_count,
                               static_cast<double>(input[at * 2]));
    const double* odd = newest_of(&stage->down_odd, phases.even_count);
    output[at] = static_cast<float>(
        folded(phases.even.data(), even, phases.even_count) +
        odd_phase(phases, odd));
    store(&stage->down_odd, phases.even_count,
          static_cast<double>(input[at * 2 + 1]));
  }
}

void reset_stage(FeqExciterStage* stage) {
  for (FeqExciterRing* ring : {&stage->up, &stage->down_even, &stage->down_odd}) {
    for (double& sample : ring->samples) {
      sample = 0.0;
    }
    ring->position = 0;
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
  reset_stage(&state->half[0]);
  reset_stage(&state->half[1]);
  reset_stage(&state->steep);
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
  const bool high = quality == FEQ_EXCITER_OVERSAMPLING_HIGH;
  FeqExciterStage* first = high ? &state->steep : &state->half[0];
  const Phases& first_phases = high ? kSteepPhases : kHalfPhases;
  if (factor == 2) {
    stage_up(first, first_phases, input, output, frames);
    return;
  }
  if (factor != 4 || middle == nullptr) {
    copy(input, output, frames);
    return;
  }
  stage_up(first, first_phases, input, middle, frames);
  stage_up(&state->half[1], kHalfPhases, middle, output, frames * 2);
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
  const bool high = quality == FEQ_EXCITER_OVERSAMPLING_HIGH;
  FeqExciterStage* last = high ? &state->steep : &state->half[0];
  const Phases& last_phases = high ? kSteepPhases : kHalfPhases;
  if (factor == 2) {
    stage_down(last, last_phases, input, output, frames);
    return;
  }
  if (factor != 4 || middle == nullptr) {
    copy(input, output, frames);
    return;
  }
  // Unwound in the reverse order to the way up, so each stage sees the rate
  // it was designed for.
  stage_down(&state->half[1], kHalfPhases, input, middle, frames * 2);
  stage_down(last, last_phases, middle, output, frames);
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
