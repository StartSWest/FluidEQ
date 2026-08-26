/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Organic stage, ported from `organic.ts`.
 *
 * A second diode with its own drive and asymmetry laws, run at the oversampled
 * rate and returning only the difference from the foundation — the foundation
 * itself is subtracted on the way out, because this stage is summed in
 * parallel rather than replacing the signal.
 */
#ifndef FLUIDEQ_ORGANIC_H
#define FLUIDEQ_ORGANIC_H

#include <stdint.h>

#include "fluideq/analog_diode.h"
#include "fluideq/oversample.h"

#ifdef __cplusplus
extern "C" {
#endif

#define FEQ_ORGANIC_MAX_OVERSAMPLE 4

typedef struct FeqOrganic {
  FeqOversampler oversampler;
  /** Scratch at `frames * FEQ_ORGANIC_MAX_OVERSAMPLE`, caller-owned. */
  float* wide;
  float* wide_dry;
  double drive;
  double asymmetry;
  FeqExciterTransient transient;
} FeqOrganic;

void feq_organic_init(FeqOrganic* state, float* wide, float* wide_dry);

void feq_organic_reset_transient(FeqOrganic* state);

double feq_organic_drive(double amount);
double feq_organic_asymmetry(double amount);

/** The gain of the foundation this stage subtracts before summing. */
double feq_organic_foundation_gain(void);

double feq_organic_sample(double sample,
                          double drive,
                          double asymmetry,
                          double harmonic_gain);

/**
 * Process a block in place and return the drive actually reached.
 *
 * The drive and asymmetry are smoothed at the OVERSAMPLED rate, not the block
 * rate: at 4x that is four times as many steps per block, and a port that
 * smoothed at the session rate would glide four times too fast.
 *
 * `middle` is the oversampler's own scratch, `frames * 2` floats.
 */
double feq_organic_block(FeqOrganic* state,
                         float* target,
                         uint32_t frames,
                         double amount,
                         double sample_rate,
                         float* middle);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_ORGANIC_H */
