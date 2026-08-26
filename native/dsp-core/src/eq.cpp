/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The band arrangement, transcribed from `eqEngine.ts`.
 *
 * The one thing that does NOT transcribe literally is the arithmetic width.
 * `target[i] += wet[i] - dry[i]` in JavaScript reads three floats, widens them
 * all to double, evaluates in double, and rounds exactly once when it stores.
 * The same line in C++ over `float` arrays rounds the subtraction and then
 * rounds the addition — twice, at single precision — and the result drifts
 * from the reference by more than the parity tolerance allows across a block.
 *
 * So every mixed expression here is widened by hand. It looks like noise and
 * it is the difference between a port that matches and one that nearly does.
 */

#include "fluideq/eq.h"

extern "C" {

void feq_eq_process_bands(FeqBiquadState* states,
                          const FeqBiquadCoefficients* coefficients,
                          uint32_t band_count,
                          float* target,
                          uint32_t frames,
                          FeqEqEngine engine,
                          float* dry,
                          float* wet) {
  if (states == nullptr || coefficients == nullptr || target == nullptr ||
      band_count == 0 || frames == 0) {
    return;
  }

  if (engine == FEQ_EQ_SERIAL) {
    // A static band in a cascade filters in place, with no copy and no
    // scratch. The dry/wet buffers are not touched at all on this path.
    for (uint32_t band = 0; band < band_count; ++band) {
      feq_biquad_process(&states[band], target, frames, &coefficients[band]);
    }
    return;
  }

  if (dry == nullptr || wet == nullptr) {
    return;
  }

  for (uint32_t at = 0; at < frames; ++at) {
    dry[at] = target[at];
  }
  for (uint32_t band = 0; band < band_count; ++band) {
    for (uint32_t at = 0; at < frames; ++at) {
      wet[at] = dry[at];
    }
    feq_biquad_process(&states[band], wet, frames, &coefficients[band]);
    for (uint32_t at = 0; at < frames; ++at) {
      // Only what this band CHANGED is added. Summing the bands themselves
      // would stack one copy of the dry signal per band and come out N times
      // too loud.
      //
      // Widened deliberately — see the note at the head of this file.
      const double difference =
          static_cast<double>(wet[at]) - static_cast<double>(dry[at]);
      target[at] = static_cast<float>(static_cast<double>(target[at]) +
                                      difference);
    }
  }
}

}  // extern "C"
