/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Exciter's Timing control: the lows made to arrive later than the top.
 *
 * At full amount the bottom of the range arrives 2.5 ms late, the mids about
 * half a millisecond, the top on time. That is the arrival-time relationship
 * a driver imposes on its own output, and reproducing it makes an excited top
 * sit behind the transient rather than in front of it.
 *
 * Two first-order all-pass sections in series, one for the lows and one for
 * the mids, so the level is the same at every frequency and only the arrival
 * moves — which is how the hardware this follows does it. It was three bands
 * with the lower two delayed, and two bands delayed against each other arrive
 * out of step where they overlap and partly cancel: at Timing's own setting
 * that took 4.6 dB out of 1.2 kHz and a decibel out of 150 Hz, on every
 * exciter profile that used it (`exciter_test.cpp` holds it flat now).
 *
 * The delays glide, so moving the dial never steps the sound. A section whose
 * delay has glided to nothing is the identity rather than a filter left
 * running, because its pole would then sit on the unit circle.
 */
#ifndef FLUIDEQ_PHASE_ALIGN_H
#define FLUIDEQ_PHASE_ALIGN_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Each section's delay at the bottom of the range, at full amount. */
#define FEQ_PHASE_ALIGN_LOW_MS 2.0
#define FEQ_PHASE_ALIGN_MID_MS 0.5

typedef struct FeqAllPassSection {
  double x1;
  double y1;
  /** Delay at the bottom of the range, in samples, gliding to its target. */
  double delay;
} FeqAllPassSection;

typedef struct FeqPhaseAlign {
  FeqAllPassSection low;
  FeqAllPassSection mid;
} FeqPhaseAlign;

void feq_phase_align_init(FeqPhaseAlign* state);

/** True while either section still holds a delay, gliding to none included. */
int feq_phase_align_is_active(const FeqPhaseAlign* state);

void feq_phase_align_process(FeqPhaseAlign* state,
                             float* target,
                             uint32_t frames,
                             double amount,
                             double sample_rate);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_PHASE_ALIGN_H */
