/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Exciter's Timing control, ported from `phaseAlign.ts`.
 *
 * Three bands, and the lower two are delayed relative to the top: 2.5 ms for
 * the lows, half a millisecond for the mids. That is the arrival-time
 * relationship a driver imposes on its own output, and reproducing it makes an
 * excited top sit behind the transient rather than in front of it.
 *
 * The delays are fractional and smoothed, so moving the dial glides rather
 * than stepping — a delay line whose length jumps produces a click on every
 * pixel of a drag.
 */
#ifndef FLUIDEQ_PHASE_ALIGN_H
#define FLUIDEQ_PHASE_ALIGN_H

#include <stdint.h>

#include "fluideq/primitives.h"

#ifdef __cplusplus
extern "C" {
#endif

#define FEQ_PHASE_ALIGN_LOW_MS 2.5
#define FEQ_PHASE_ALIGN_MID_MS 0.5

typedef struct FeqVariableDelay {
  float* buffer;
  uint32_t capacity;
  uint32_t write;
} FeqVariableDelay;

typedef struct FeqPhaseAlign {
  FeqCrossover crossover;
  /** Band scratch, `frames` each. Caller-owned. */
  float* low;
  float* mid;
  float* high;
  FeqVariableDelay low_line;
  FeqVariableDelay mid_line;
  double low_delay;
  double mid_delay;
} FeqPhaseAlign;

/** The delay-line capacity each band needs at this rate, in samples. */
uint32_t feq_phase_align_low_capacity(double sample_rate);
uint32_t feq_phase_align_mid_capacity(double sample_rate);

void feq_phase_align_init(FeqPhaseAlign* state,
                          float* low,
                          float* mid,
                          float* high,
                          float* low_line,
                          uint32_t low_capacity,
                          float* mid_line,
                          uint32_t mid_capacity);

void feq_phase_align_process(FeqPhaseAlign* state,
                             float* target,
                             uint32_t frames,
                             double amount,
                             double sample_rate);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_PHASE_ALIGN_H */
