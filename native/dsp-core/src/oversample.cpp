/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/oversample.h"

#include <array>
#include <cmath>

namespace {

constexpr int kTaps = FEQ_OVERSAMPLE_TAPS;

/**
 * A windowed-sinc low pass at a quarter of the doubled rate.
 *
 * Blackman rather than rectangular: an unwindowed sinc has a stopband around
 * -21 dB whatever its length, which would let a quarter of the folded content
 * straight back through and defeat the point of oversampling.
 *
 * The accumulation order matches the reference exactly — the normalising sum
 * is built in the same sequence, because floating-point addition is not
 * associative and the taps are compared against the reference's to the last
 * bit.
 */
std::array<double, kTaps> design_half_band() {
  std::array<double, kTaps> taps{};
  const double middle = (kTaps - 1) / 2.0;
  double sum = 0.0;
  for (int at = 0; at < kTaps; ++at) {
    const double n = static_cast<double>(at) - middle;
    // sinc at cutoff 0.25 of the oversampled rate, i.e. Nyquist of the
    // original one.
    const double ideal =
        n == 0.0 ? 0.5
                 : std::sin(3.14159265358979323846 * 0.5 * n) /
                       (3.14159265358979323846 * n);
    const double window =
        0.42 -
        0.5 * std::cos((2.0 * 3.14159265358979323846 * at) / (kTaps - 1)) +
        0.08 * std::cos((4.0 * 3.14159265358979323846 * at) / (kTaps - 1));
    taps[static_cast<size_t>(at)] = ideal * window;
    sum += taps[static_cast<size_t>(at)];
  }
  // Normalised to unity at DC, so oversampling never changes the level.
  for (int at = 0; at < kTaps; ++at) {
    taps[static_cast<size_t>(at)] /= sum;
  }
  return taps;
}

/**
 * Built once, before main, rather than on first use.
 *
 * A function-local static would put a thread-safe-initialisation guard on the
 * first call — which would be a lock, on the audio thread, on whichever block
 * happened to be first.
 */
const std::array<double, kTaps> kHalfBand = design_half_band();

/**
 * One sample into a history kept twice over, side by side, without shifting
 * sixty-three values per sample: the last `kTaps` samples always lie in one
 * unbroken run ending at the returned newest, so a sum walks straight down
 * an array with no wrap to test at every tap. The decimation's discarded
 * sample goes in through here alone, with no sum taken.
 */
const double* store(double* history, int* positions, int stage, double sample) {
  const int newest = positions[stage];
  history[newest] = sample;
  history[newest + kTaps] = sample;
  positions[stage] = newest + 1 == kTaps ? 0 : newest + 1;
  return history + newest + kTaps;
}

/**
 * The sum over every `step`-th tap from `first`, newest sample first.
 *
 * The walk order is the reference's, newest to oldest: the sum is
 * accumulated in this sequence and a different one moves the last bits. With
 * a step of two, after a stuffed zero or a sample, the taps left out are the
 * ones meeting stuffed zeros: their products are exact zeros, and adding an
 * exact zero leaves a sum as it was, so the sum is the full one to the last
 * bit for half the work.
 */
double sum_taps(const double* newest, int first, int step) {
  double sum = 0.0;
  for (int tap = first; tap < kTaps; tap += step) {
    sum += newest[-tap] * kHalfBand[static_cast<size_t>(tap)];
  }
  return sum;
}

double push(double* history, int* positions, int stage, double sample) {
  return sum_taps(store(history, positions, stage, sample), 0, 1);
}

/**
 * One halving, doubled: N samples in, 2N out.
 *
 * Zero-stuffing then filtering, which is what interpolation is. The x2
 * restores the level the inserted zeros halve. Each output sums only the
 * taps that meet a real sample: the even ones after a sample, the odd ones
 * after a stuffed zero (`sum_taps`).
 */
void up_once(double* history,
             int* positions,
             int stage,
             const float* input,
             float* output,
             uint32_t frames) {
  for (uint32_t at = 0; at < frames; ++at) {
    const double* sample = store(history, positions, stage,
                                 static_cast<double>(input[at]));
    output[at * 2] = static_cast<float>(sum_taps(sample, 0, 2) * 2.0);
    const double* zero = store(history, positions, stage, 0.0);
    output[at * 2 + 1] = static_cast<float>(sum_taps(zero, 1, 2) * 2.0);
  }
}

/**
 * One halving, back down: 2N in, N out.
 *
 * Filtered before decimating, never after: dropping every other sample of an
 * unfiltered signal is exactly the aliasing this exists to prevent. The
 * discarded sample is still stored, because the history has to advance at
 * the doubled rate or the filter is running at half the rate it was designed
 * for; its sum is not taken, since nothing reads it.
 */
void down_once(double* history,
               int* positions,
               int stage,
               const float* input,
               float* output,
               uint32_t frames) {
  for (uint32_t at = 0; at < frames; ++at) {
    const double kept =
        push(history, positions, stage, static_cast<double>(input[at * 2]));
    store(history, positions, stage, static_cast<double>(input[at * 2 + 1]));
    output[at] = static_cast<float>(kept);
  }
}

}  // namespace

extern "C" {

void feq_oversampler_reset(FeqOversampler* state) {
  if (state == nullptr) {
    return;
  }
  for (int stage = 0; stage < FEQ_OVERSAMPLE_STAGES; ++stage) {
    for (int tap = 0; tap < kTaps * 2; ++tap) {
      state->up[stage][tap] = 0.0;
      state->down[stage][tap] = 0.0;
    }
    state->up_position[stage] = 0;
    state->down_position[stage] = 0;
  }
}

uint32_t feq_oversample_factor_for_sample_rate(double sample_rate) {
  const double rate =
      std::isfinite(sample_rate) && sample_rate > 0.0 ? sample_rate : 48000.0;
  if (rate * 4.0 <= 192000.0) {
    return 4;
  }
  return rate * 2.0 <= 192000.0 ? 2u : 1u;
}

double feq_oversample_round_trip_frames(uint32_t factor) {
  if (factor != 2 && factor != 4) {
    return 0.0;
  }
  const double half_taps = (kTaps - 1) / 2.0;
  // The first halving runs at twice the base rate, the second at four times.
  const double one_way =
      half_taps / 2.0 + (factor == 4 ? half_taps / 4.0 : 0.0);
  return 2.0 * one_way;
}

void feq_oversample_up(FeqOversampler* state,
                       const float* input,
                       float* output,
                       uint32_t frames,
                       uint32_t factor,
                       float* middle) {
  if (state == nullptr || input == nullptr || output == nullptr ||
      frames == 0) {
    return;
  }
  if (factor != 2 && factor != 4) {
    for (uint32_t at = 0; at < frames; ++at) {
      output[at] = input[at];
    }
    return;
  }
  if (factor == 2) {
    up_once(state->up[0], state->up_position, 0, input, output, frames);
    return;
  }
  if (middle == nullptr) {
    return;
  }
  up_once(state->up[0], state->up_position, 0, input, middle, frames);
  up_once(state->up[1], state->up_position, 1, middle, output, frames * 2);
}

void feq_oversample_down(FeqOversampler* state,
                         const float* input,
                         float* output,
                         uint32_t frames,
                         uint32_t factor,
                         float* middle) {
  if (state == nullptr || input == nullptr || output == nullptr ||
      frames == 0) {
    return;
  }
  if (factor != 2 && factor != 4) {
    for (uint32_t at = 0; at < frames; ++at) {
      output[at] = input[at];
    }
    return;
  }
  if (factor == 2) {
    down_once(state->down[0], state->down_position, 0, input, output, frames);
    return;
  }
  if (middle == nullptr) {
    return;
  }
  // Unwound in the reverse order to the way up, so each stage sees the rate it
  // was designed for.
  down_once(state->down[1], state->down_position, 1, input, middle,
            frames * 2);
  down_once(state->down[0], state->down_position, 0, middle, output, frames);
}

void feq_oversample_half_band_design(double* taps) {
  if (taps == nullptr) {
    return;
  }
  const std::array<double, kTaps> designed = design_half_band();
  for (int at = 0; at < kTaps; ++at) {
    taps[at] = designed[static_cast<size_t>(at)];
  }
}

}  // extern "C"
