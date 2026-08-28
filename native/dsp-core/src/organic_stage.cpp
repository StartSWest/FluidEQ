/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/organic_stage.h"

namespace {

/**
 * A one-pole DC blocker after the shaper, not before it.
 *
 * The diode curve is asymmetric by design, which is exactly what puts the
 * second harmonic in front of the third — and asymmetry produces a DC offset.
 * Blocking it before the shaper would remove nothing; blocking it after is
 * what stops that offset walking into the summing bus and eating headroom
 * silently.
 */
constexpr double kDcPole = 0.9974;

double clamp01(double value) {
  if (value < 0.0) {
    return 0.0;
  }
  return value > 1.0 ? 1.0 : value;
}

void block_dc(FeqOrganicDc* state, float* buffer, uint32_t frames) {
  for (uint32_t at = 0; at < frames; ++at) {
    const double x = static_cast<double>(buffer[at]);
    const double y = x - state->x + kDcPole * state->y;
    state->x = x;
    state->y = y;
    buffer[at] = static_cast<float>(y);
  }
}

}  // namespace

extern "C" {

void feq_organic_path_init(FeqOrganicPath* state,
                           float* band,
                           float* foundation,
                           float* wide,
                           float* wide_dry,
                           float* guard_scratch) {
  if (state == nullptr) {
    return;
  }
  feq_biquad_reset(&state->filter);
  state->coefficients.b0 = 1.0;
  state->coefficients.b1 = 0.0;
  state->coefficients.b2 = 0.0;
  state->coefficients.a1 = 0.0;
  state->coefficients.a2 = 0.0;
  state->focus_hz = 0.0;
  state->quality = 0.0;
  state->sample_rate = 0.0;
  feq_organic_init(&state->shaper, wide, wide_dry);
  state->band = band;
  state->foundation = foundation;
  state->dc.x = 0.0;
  state->dc.y = 0.0;
  feq_exciter_guard_init(&state->guard, guard_scratch);
}

void feq_organic_path_reset_transient(FeqOrganicPath* state) {
  if (state != nullptr) {
    feq_organic_reset_transient(&state->shaper);
  }
}

double feq_organic_range_q(double range) {
  return 1.2 - clamp01(range) * 1.02;
}

void feq_organic_path_process(FeqOrganicPath* state,
                              const float* source,
                              uint32_t frames,
                              double focus_hz,
                              double range,
                              double amount,
                              double sample_rate,
                              float* middle) {
  if (state == nullptr || source == nullptr || state->band == nullptr ||
      state->foundation == nullptr || frames == 0) {
    return;
  }
  for (uint32_t at = 0; at < frames; ++at) {
    state->band[at] = source[at];
  }

  const double quality = feq_organic_range_q(range);
  // Rebuilt only when something it depends on actually moved. A bandpass
  // rebuilt every block is two transcendentals per block for a value that
  // changes when somebody turns a dial.
  if (state->focus_hz != focus_hz || state->quality != quality ||
      state->sample_rate != sample_rate) {
    state->focus_hz = focus_hz;
    state->quality = quality;
    state->sample_rate = sample_rate;
    state->coefficients = feq_biquad_coefficients(FEQ_FILTER_BP, focus_hz, 0.0,
                                                  quality, sample_rate);
  }

  feq_biquad_process(&state->filter, state->band, frames, &state->coefficients);
  for (uint32_t at = 0; at < frames; ++at) {
    state->foundation[at] = state->band[at];
  }

  feq_organic_block(&state->shaper, state->band, frames, amount, sample_rate,
                    middle);
  block_dc(&state->dc, state->band, frames);

  const double foundation_gain = feq_organic_foundation_gain();
  for (uint32_t at = 0; at < frames; ++at) {
    state->band[at] = static_cast<float>(
        static_cast<double>(state->band[at]) +
        static_cast<double>(state->foundation[at]) * foundation_gain);
  }

  feq_exciter_guard_process(&state->guard, state->band, frames, sample_rate,
                            feq_organic_sibilance_protection(focus_hz));
}

}  // extern "C"
