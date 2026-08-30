/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Exciter's driven sidechain and its transient discriminator, ported from
 * `analogDiode.ts`.
 *
 * US 4,150,253 does not return a synthetic harmonic residue. Its attenuated
 * excited signal contains the phase-shifted fundamentals the filter passed and
 * the low-order harmonics made from them, and that continuous filtered
 * foundation is what stops the harmonics being heard as detached fizz.
 *
 * Normalising the tangent at silence keeps the foundation at unity while Drive
 * changes curvature rather than loudness. Bias supplies the one-sided diode
 * character; Texture moves from even-rich warmth toward denser air. There is
 * no threshold, follower or block measurement in the curve itself, so it stays
 * continuous under sustained material.
 */
#ifndef FLUIDEQ_ANALOG_DIODE_H
#define FLUIDEQ_ANALOG_DIODE_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define FEQ_ANALOG_DIODE_MAX_CHARACTER 0.7

typedef struct FeqExciterTransient {
  double fast_envelope;
  double slow_envelope;
  double amount;
  double sample_rate;
  double fast_attack;
  double fast_release;
  double slow_attack;
  double slow_release;
  double control_attack;
  double control_release;
} FeqExciterTransient;

void feq_exciter_transient_init(FeqExciterTransient* state);

/** Clear the envelopes without discarding the cached coefficients. */
void feq_exciter_transient_reset(FeqExciterTransient* state);

/**
 * How much of a transient this sample is part of, 0 to 1.
 *
 * Two envelopes at different speeds, and their difference is the answer: a
 * fast follower minus a slow one is large at an attack and near zero on
 * sustained material. Time constants reproduce that shape continuously rather
 * than making an on/off gate out of it.
 */
double feq_exciter_transient_sample(FeqExciterTransient* state,
                                    double sample,
                                    double sample_rate);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_ANALOG_DIODE_H */
