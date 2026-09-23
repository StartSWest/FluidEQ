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
   * opposite of what was asked for. What it changes at full strength IS
   * fixed, though, and the Isolate monitor hears it through a kernel of its
   * own: `feq_build_linear_phase_change_kernel`.
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

/**
 * What one band changes at full strength, as a linear-phase kernel.
 *
 * The rack's static magnitude times the band's own magnitude less one, laid
 * out and centred exactly as `feq_build_linear_phase_kernel` lays out the
 * rack, so the two outputs land on the same sample. Added to the rack's
 * output, it is the band switched fully on; scaled by a dynamic band's
 * amount, it is the band doing what its detector says, in linear phase.
 *
 * Magnitude only, like the rack's kernel, and that is the point. A
 * minimum-phase band run after the kernel changes phase either side of its
 * passband as well as level, and a monitor that subtracts the dry signal —
 * Isolate — plays that phase change as if it were sound: measured on pink
 * noise, a +5.4 dB band at 4.3 kHz and Q 9.1 let the octave either side
 * through 14 dB louder, and everything under 2 kHz 25 dB louder, than the
 * same band made static.
 *
 * `band` indexes `rack->bands`; a disabled band changes nothing and gets a
 * silent kernel. Not real-time safe: it allocates and runs three 16k
 * transforms.
 */
void feq_build_linear_phase_change_kernel(const FeqLinearPhaseRack* rack,
                                          uint32_t band,
                                          double sample_rate,
                                          float* kernel);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_LINEAR_PHASE_H */
