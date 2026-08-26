/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The whole Organic path, ported from `organicStage.ts`.
 *
 * Bandpass at the chosen focus, shape, block DC, add the foundation back, and
 * take the return through the sibilance guard. The foundation is re-added here
 * rather than left in the shaper because the shaper deliberately returns only
 * its difference — see `organic.h`.
 */
#ifndef FLUIDEQ_ORGANIC_STAGE_H
#define FLUIDEQ_ORGANIC_STAGE_H

#include <stdint.h>

#include "fluideq/biquad.h"
#include "fluideq/exciter_guard.h"
#include "fluideq/organic.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct FeqOrganicDc {
  double x;
  double y;
} FeqOrganicDc;

typedef struct FeqOrganicPath {
  FeqBiquadState filter;
  FeqBiquadCoefficients coefficients;
  double focus_hz;
  double quality;
  double sample_rate;
  FeqOrganic shaper;
  /** `frames` each, caller-owned. `band` is the stage's output. */
  float* band;
  float* foundation;
  FeqOrganicDc dc;
  FeqExciterGuard guard;
} FeqOrganicPath;

/**
 * Every buffer is the caller's. `wide` and `wide_dry` are
 * `frames * FEQ_ORGANIC_MAX_OVERSAMPLE`; `guard_scratch` is `frames`.
 */
void feq_organic_path_init(FeqOrganicPath* state,
                           float* band,
                           float* foundation,
                           float* wide,
                           float* wide_dry,
                           float* guard_scratch);

void feq_organic_path_reset_transient(FeqOrganicPath* state);

/** The Q the range dial maps to. Matches `organicRangeQ` in `chain.ts`. */
double feq_organic_range_q(double range);

/**
 * Run the path over `source` and leave the result in `state->band`.
 *
 * `middle` is the oversampler's scratch, `frames * 2` floats.
 */
void feq_organic_path_process(FeqOrganicPath* state,
                              const float* source,
                              uint32_t frames,
                              double focus_hz,
                              double range,
                              double amount,
                              double sample_rate,
                              float* middle);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_ORGANIC_STAGE_H */
