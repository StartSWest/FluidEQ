/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What stops an Exciter turning a voice into a hiss, ported from
 * `exciterGuard.ts`.
 *
 * Generated harmonics land wherever the programme has energy, and on speech
 * that means on top of sibilance the recording already has too much of. The
 * return path is therefore taken through a bell at 7.2 kHz, blended in by
 * amount, so the stage adds air everywhere except where air is the problem.
 *
 * The return gains are tapers rather than lines: a fractional power puts most
 * of the travel at the bottom of the dial, where the difference between a
 * little and none is what people are actually adjusting.
 */
#ifndef FLUIDEQ_EXCITER_GUARD_H
#define FLUIDEQ_EXCITER_GUARD_H

#include <stdint.h>

#include "fluideq/biquad.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct FeqExciterGuard {
  FeqBiquadState filter;
  FeqBiquadCoefficients coefficients;
  double sample_rate;
  double amount;
  /** Scratch, `frames` long, caller-owned. */
  float* filtered;
} FeqExciterGuard;

void feq_exciter_guard_init(FeqExciterGuard* state, float* filtered);

/**
 * One curve for all three bands: every return is now harmonics over the same
 * quiet carrier, so there is nothing left for a second curve to describe.
 */
double feq_exciter_return_gain(double amount);
double feq_organic_exciter_return_gain(double amount);

/**
 * How much protection Organic needs at a given focus, 0 to 1.
 *
 * Zero outside 4.5-11 kHz because the sibilant region is not there, ramped at
 * both edges so moving the focus dial glides rather than switching.
 */
double feq_organic_sibilance_protection(double focus_hz);

void feq_exciter_guard_process(FeqExciterGuard* state,
                               float* target,
                               uint32_t frames,
                               double sample_rate,
                               double amount);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_EXCITER_GUARD_H */
