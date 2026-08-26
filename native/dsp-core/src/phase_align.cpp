/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/phase_align.h"

#include <cmath>

namespace {

constexpr double kDelaySmoothingMs = 20.0;
constexpr double kLowCornerHz = 150.0;
constexpr double kHighCornerHz = 1200.0;

/**
 * One sample through a fractional delay, linearly interpolated.
 *
 * Linear rather than a higher-order interpolator on purpose: the delay is
 * being *moved* while it runs, and every interpolator above first order rings
 * when its coefficients change. A little high-frequency loss on a band that is
 * below 1.2 kHz by construction costs nothing audible.
 */
double delay_sample(FeqVariableDelay* line, double sample, double delay) {
  line->buffer[line->write] = static_cast<float>(sample);
  double read = static_cast<double>(line->write) - delay;
  if (read < 0.0) {
    read += static_cast<double>(line->capacity);
  }
  const auto before = static_cast<uint32_t>(std::floor(read));
  const uint32_t after = (before + 1) % line->capacity;
  const double fraction = read - std::floor(read);
  const double output =
      static_cast<double>(line->buffer[before]) * (1.0 - fraction) +
      static_cast<double>(line->buffer[after]) * fraction;
  line->write = (line->write + 1) % line->capacity;
  return output;
}

uint32_t capacity_for(double milliseconds, double sample_rate) {
  return static_cast<uint32_t>(
             std::ceil((milliseconds / 1000.0) * sample_rate)) +
         2;
}

}  // namespace

extern "C" {

uint32_t feq_phase_align_low_capacity(double sample_rate) {
  return capacity_for(FEQ_PHASE_ALIGN_LOW_MS, sample_rate);
}

uint32_t feq_phase_align_mid_capacity(double sample_rate) {
  return capacity_for(FEQ_PHASE_ALIGN_MID_MS, sample_rate);
}

void feq_phase_align_init(FeqPhaseAlign* state,
                          float* low,
                          float* mid,
                          float* high,
                          float* low_line,
                          uint32_t low_capacity,
                          float* mid_line,
                          uint32_t mid_capacity) {
  if (state == nullptr) {
    return;
  }
  feq_crossover_reset(&state->crossover);
  state->low = low;
  state->mid = mid;
  state->high = high;
  state->low_line.buffer = low_line;
  state->low_line.capacity = low_capacity;
  state->low_line.write = 0;
  state->mid_line.buffer = mid_line;
  state->mid_line.capacity = mid_capacity;
  state->mid_line.write = 0;
  state->low_delay = 0.0;
  state->mid_delay = 0.0;
  for (uint32_t at = 0; at < low_capacity; ++at) {
    low_line[at] = 0.0f;
  }
  for (uint32_t at = 0; at < mid_capacity; ++at) {
    mid_line[at] = 0.0f;
  }
}

void feq_phase_align_process(FeqPhaseAlign* state,
                             float* target,
                             uint32_t frames,
                             double amount,
                             double sample_rate) {
  if (state == nullptr || target == nullptr || frames == 0) {
    return;
  }
  const double safe_amount = amount < 0.0 ? 0.0 : (amount > 1.0 ? 1.0 : amount);
  const double target_low =
      (FEQ_PHASE_ALIGN_LOW_MS / 1000.0) * sample_rate * safe_amount;
  const double target_mid =
      (FEQ_PHASE_ALIGN_MID_MS / 1000.0) * sample_rate * safe_amount;

  // Fully off AND fully settled: the delays are still glided to zero, so
  // returning early while they are non-zero would step the signal instead.
  if (target_low == 0.0 && state->low_delay < 0.0001 &&
      state->mid_delay < 0.0001) {
    state->low_delay = 0.0;
    state->mid_delay = 0.0;
    return;
  }

  feq_crossover_split(&state->crossover, target, state->low, state->mid,
                      state->high, frames, kLowCornerHz, kHighCornerHz,
                      sample_rate);

  const double smooth =
      1.0 - std::exp(-1.0 / ((kDelaySmoothingMs / 1000.0) * sample_rate));
  for (uint32_t at = 0; at < frames; ++at) {
    state->low_delay += (target_low - state->low_delay) * smooth;
    state->mid_delay += (target_mid - state->mid_delay) * smooth;
    const double low = delay_sample(&state->low_line,
                                    static_cast<double>(state->low[at]),
                                    state->low_delay);
    const double mid = delay_sample(&state->mid_line,
                                    static_cast<double>(state->mid[at]),
                                    state->mid_delay);
    target[at] =
        static_cast<float>(low + mid + static_cast<double>(state->high[at]));
  }
}

}  // extern "C"
