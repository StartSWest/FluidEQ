/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What turns a band from a fixed shape into one that only acts when asked.
 * Ported from `src/renderer/dsp/dynamics.ts`.
 *
 * A static band is honest and blunt: a cut at 6 kHz to tame one singer's
 * sibilance also dulls every cymbal on the record, because a filter cannot
 * tell a sibilant from a ride. This measures the energy in the band's own
 * passband and scales the band's contribution by how far that energy sits over
 * a threshold, so the same cut arrives on the sibilant and not on the cymbal.
 *
 * The detector is the band's own output minus its input — what the filter is
 * CHANGING — divided by how much change a full-strength band would make. That
 * quotient is the level of the band's passband and nothing else, so no second
 * filter is needed for the sidechain and the threshold keeps its meaning when
 * the gain dial moves.
 */
#ifndef FLUIDEQ_DYNAMICS_H
#define FLUIDEQ_DYNAMICS_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct FeqBandDynamics {
  /** Zero for a static band: every dynamic path is skipped entirely. */
  int active;
  /** Linear amplitude at which the band begins to act. */
  double threshold;
  /** Turns the band's own change back into the level of its input. */
  double normalise;
  double attack;
  double release;
  /** Held across blocks — an envelope reset per block is a click per block. */
  double envelope;
  /** What the band is currently applying, 0 to 1. Read by the meter. */
  double amount;
} FeqBandDynamics;

void feq_band_dynamics_init(FeqBandDynamics* state);

/**
 * Point `state` at what the band is now asking for, keeping its envelope.
 *
 * Rebuilt on every settings message, so it must not disturb what is running:
 * the envelope is the last few milliseconds of audio, and resetting it because
 * a neighbouring band moved would be a click on every drag.
 */
void feq_band_dynamics_refresh(FeqBandDynamics* state,
                               int rack_enabled,
                               int band_enabled,
                               int band_dynamic,
                               double gain_db,
                               double threshold_db,
                               double sample_rate);

/**
 * Follow one sample and answer how much of the band to apply, 0 to 1.
 *
 * Peak-following rather than RMS, deliberately: the point is to catch the
 * loudest moment in the band, and an RMS detector averages exactly that away.
 *
 * `difference` is the band's output minus its input, in double. It arrives
 * widened from the band engine on purpose — narrowing it here would put the
 * envelope on a different trajectory from the reference within a few samples.
 */
double feq_band_dynamic_amount(FeqBandDynamics* state, double difference);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_DYNAMICS_H */
