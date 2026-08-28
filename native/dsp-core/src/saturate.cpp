/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/saturate.h"

#include <cmath>

namespace {

/**
 * The asymmetry, and why it is two numbers rather than one.
 *
 * A fixed offset makes the second harmonic dominant at low drive and lets the
 * third overtake it as the dial opens; an offset that grows with drive keeps
 * the ratio steady, so the control opens smoothly instead of changing
 * character in the middle of its travel.
 */
constexpr double kOffsetBase = 0.18;
constexpr double kOffsetPerDrive = 0.28;

double offset_for(double drive) {
  return kOffsetBase + drive * kOffsetPerDrive;
}

}  // namespace

extern "C" {

void feq_saturator_reset(FeqSaturator* state) {
  if (state == nullptr) {
    return;
  }
  feq_oversampler_reset(&state->oversampler);
}

double feq_saturate_sample(double sample, double drive) {
  const double offset = offset_for(drive);
  return (std::tanh(sample * drive + offset) - std::tanh(offset)) / drive;
}

void feq_saturate_block(FeqSaturator* state,
                        float* target,
                        uint32_t frames,
                        double drive,
                        double blend,
                        double sample_rate,
                        float* oversampled,
                        float* middle) {
  if (state == nullptr || target == nullptr || oversampled == nullptr ||
      frames == 0 || drive == 0.0) {
    return;
  }
  const uint32_t factor = feq_oversample_factor_for_sample_rate(sample_rate);
  const uint32_t oversampled_frames = frames * factor;

  /**
   * Hoisted rather than recomputed per sample.
   *
   * `feq_saturate_sample` re-derives both of these every call, and they depend
   * only on the drive, which is fixed for the block. This loop runs at up to
   * four times the sample rate inside an audio callback: two transcendentals
   * per sample to rebuild a constant is the kind of thing that only shows up
   * as a dropout on somebody else's slower machine.
   */
  const double offset = offset_for(drive);
  const double offset_output = std::tanh(offset);
  const double small_signal_gain = 1.0 - offset_output * offset_output;

  feq_oversample_up(&state->oversampler, target, oversampled, frames, factor,
                    middle);

  for (uint32_t at = 0; at < oversampled_frames; ++at) {
    const double carrier = static_cast<double>(oversampled[at]);
    const double shaped =
        (std::tanh(carrier * drive + offset) - offset_output) / drive;
    // Restore the tangent at silence to unity, then blend in parallel at the
    // oversampled rate so the carrier and the harmonics are sample-aligned
    // before decimation. Blending after would smear one against the other.
    oversampled[at] = static_cast<float>(
        blend < 0.0 ? shaped
                    : carrier + (shaped / small_signal_gain - carrier) * blend);
  }

  feq_oversample_down(&state->oversampler, oversampled, target, frames, factor,
                      middle);
}

double feq_fuzz_drive(double amount) { return 0.72 * std::pow(amount, 1.6); }

double feq_fuzz_blend(double amount) { return 0.45 + amount * 0.15; }

}  // extern "C"
