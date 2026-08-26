/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Building a linear-phase kernel from the rack, ported from `linearPhase.ts`.
 *
 * The rack is run over an impulse, the spectrum's phase is thrown away and its
 * magnitude kept, and the inverse transform is rotated by half its length.
 * Real and symmetric going in means real and symmetric coming out, which is
 * the definition of linear phase rather than an approximation of it. The
 * rotation is both what makes the filter causal and where every sample of the
 * latency comes from.
 *
 * This costs milliseconds and allocates. It belongs on a worker, prepared and
 * swapped in whole — never inside a callback.
 */
#ifndef FLUIDEQ_LINEAR_PHASE_H
#define FLUIDEQ_LINEAR_PHASE_H

#include <stdint.h>

#include "fluideq/biquad.h"
#include "fluideq/eq.h"

#ifdef __cplusplus
extern "C" {
#endif

#define FEQ_LINEAR_PHASE_KERNEL_SIZE 16384
#define FEQ_LINEAR_PHASE_KERNEL_LATENCY (FEQ_LINEAR_PHASE_KERNEL_SIZE / 2)

typedef struct FeqLinearPhaseBand {
  int enabled;
  /**
   * A dynamic band is excluded from the kernel and runs after it.
   *
   * A kernel is a fixed filter, computed once and convolved with everything
   * after. A band that changes what it does from what it hears cannot be
   * expressed by one — baking it in at full strength would leave a band that
   * is permanently engaged, which is a static band with extra steps and the
   * opposite of what was asked for.
   */
  int dynamic;
  FeqFilterType type;
  double frequency;
  double gain_db;
  double quality;
} FeqLinearPhaseBand;

typedef struct FeqLinearPhaseRack {
  const FeqLinearPhaseBand* bands;
  uint32_t band_count;
  FeqEqEngine engine;
  FeqEqModel model;
  double model_amount;
  /** Zero disables the subsonic high-pass. */
  double subsonic_hz;
} FeqLinearPhaseRack;

/** Total latency in samples, including the convolver's own partition. */
uint32_t feq_linear_phase_latency(void);

/**
 * Write `FEQ_LINEAR_PHASE_KERNEL_SIZE` samples into `kernel`.
 *
 * Not real-time safe: it allocates and runs two 16k transforms.
 */
void feq_build_linear_phase_kernel(const FeqLinearPhaseRack* rack,
                                   double sample_rate,
                                   float* kernel);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_LINEAR_PHASE_H */
