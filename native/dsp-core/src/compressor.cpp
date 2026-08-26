/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/compressor.h"

#include <cmath>

namespace {

double db_to_linear(double db) { return std::pow(10.0, db / 20.0); }

/**
 * The gain that puts the overshoot back by the ratio: a signal `over` times
 * the threshold should end up `over ** (1 / ratio)` times it.
 */
double required_gain(double magnitude, double threshold, double ratio) {
  if (magnitude <= threshold) {
    return 1.0;
  }
  const double over = magnitude / threshold;
  return std::pow(over, 1.0 / ratio - 1.0);
}

/** After `ms` the envelope has travelled 1 - 1/e of the distance. */
double coefficient_for(double milliseconds, double sample_rate) {
  return std::exp(-1.0 / ((milliseconds / 1000.0) * sample_rate));
}

}  // namespace

extern "C" {

void feq_compressor_reset(FeqCompressor* state) {
  if (state != nullptr) {
    state->gain = 1.0;
  }
}

void feq_compressor_process(FeqCompressor* state,
                            float* samples,
                            uint32_t frames,
                            const FeqCompressorBand* band,
                            double sample_rate) {
  if (state == nullptr || samples == nullptr || band == nullptr) {
    return;
  }
  const double threshold = db_to_linear(band->threshold_db);
  const double makeup = db_to_linear(band->makeup_db);
  const double attack = coefficient_for(band->attack_ms, sample_rate);
  const double release = coefficient_for(band->release_ms, sample_rate);

  for (uint32_t at = 0; at < frames; ++at) {
    const double magnitude = std::fabs(static_cast<double>(samples[at]));
    const double target = required_gain(magnitude, threshold, band->ratio);
    const double coefficient = target < state->gain ? attack : release;
    state->gain = target + (state->gain - target) * coefficient;
    samples[at] = static_cast<float>(static_cast<double>(samples[at]) *
                                     (state->gain * makeup));
  }
}

void feq_compressor_process_linked(FeqCompressor* state,
                                   float* const* channels,
                                   uint32_t channel_count,
                                   uint32_t frames,
                                   const FeqCompressorBand* band,
                                   double sample_rate) {
  if (state == nullptr || channels == nullptr || band == nullptr ||
      channel_count == 0 || frames == 0) {
    return;
  }
  const double threshold = db_to_linear(band->threshold_db);
  const double makeup = db_to_linear(band->makeup_db);
  const double attack = coefficient_for(band->attack_ms, sample_rate);
  const double release = coefficient_for(band->release_ms, sample_rate);

  for (uint32_t frame = 0; frame < frames; ++frame) {
    double magnitude = 0.0;
    for (uint32_t channel = 0; channel < channel_count; ++channel) {
      const double value = std::fabs(static_cast<double>(channels[channel][frame]));
      if (value > magnitude) {
        magnitude = value;
      }
    }
    const double target = required_gain(magnitude, threshold, band->ratio);
    const double coefficient = target < state->gain ? attack : release;
    state->gain = target + (state->gain - target) * coefficient;
    const double gain = state->gain * makeup;
    for (uint32_t channel = 0; channel < channel_count; ++channel) {
      channels[channel][frame] = static_cast<float>(
          static_cast<double>(channels[channel][frame]) * gain);
    }
  }
}

}  // extern "C"
