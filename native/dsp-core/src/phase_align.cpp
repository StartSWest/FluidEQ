/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/phase_align.h"

#include <cmath>

namespace {

constexpr double kDelaySmoothingMs = 20.0;
/**
 * Under this many samples of delay a section is the identity. Its coefficient
 * reaches one as its delay reaches zero, which puts the pole on the unit
 * circle: a filter that is exactly the identity there, and one rounding error
 * from ringing at Nyquist for ever.
 */
constexpr double kIdentityDelay = 1e-4;

/**
 * One sample through a first-order all-pass, H(z) = (c + z^-1) / (1 + c z^-1).
 *
 * Its delay at the bottom of the range is (1 - c) / (1 + c) samples, so the
 * coefficient follows from the delay asked for, and the delay falls away above
 * fs / (pi * delay) — 159 Hz for the low section's two milliseconds, 637 Hz
 * for the mid section's half, at any rate. The level is one at every
 * frequency whatever c is, which is the point of building Timing this way.
 */
double all_pass(FeqAllPassSection* section, double x) {
  if (section->delay < kIdentityDelay) {
    // The history the identity would have, so the section can come back in
    // from the signal rather than from whatever it last heard.
    section->x1 = x;
    section->y1 = x;
    return x;
  }
  const double c = (1.0 - section->delay) / (1.0 + section->delay);
  const double y = c * x + section->x1 - c * section->y1;
  section->x1 = x;
  section->y1 = y;
  return y;
}

void reset(FeqAllPassSection* section) {
  section->x1 = 0.0;
  section->y1 = 0.0;
  section->delay = 0.0;
}

/** A section that was the identity takes up the signal it is joining. */
void prime(FeqAllPassSection* section, double x) {
  section->x1 = x;
  section->y1 = x;
}

}  // namespace

extern "C" {

void feq_phase_align_init(FeqPhaseAlign* state) {
  if (state == nullptr) {
    return;
  }
  reset(&state->low);
  reset(&state->mid);
}

int feq_phase_align_is_active(const FeqPhaseAlign* state) {
  return state != nullptr && (state->low.delay >= kIdentityDelay ||
                              state->mid.delay >= kIdentityDelay)
             ? 1
             : 0;
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

  const bool was_active = feq_phase_align_is_active(state) != 0;
  if (target_low == 0.0 && !was_active) {
    state->low.delay = 0.0;
    state->mid.delay = 0.0;
    return;
  }
  if (!was_active) {
    // Nothing ran while it was off, so the history is whatever it heard
    // then: without this the first delayed sample would be built from it.
    prime(&state->low, static_cast<double>(target[0]));
    prime(&state->mid, static_cast<double>(target[0]));
  }

  const double smooth =
      1.0 - std::exp(-1.0 / ((kDelaySmoothingMs / 1000.0) * sample_rate));
  for (uint32_t at = 0; at < frames; ++at) {
    state->low.delay += (target_low - state->low.delay) * smooth;
    state->mid.delay += (target_mid - state->mid.delay) * smooth;
    const double low = all_pass(&state->low, static_cast<double>(target[at]));
    target[at] = static_cast<float>(all_pass(&state->mid, low));
  }
}

}  // extern "C"
