/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How the bands are put against the audio, ported from `eqEngine.ts`.
 *
 * A separate question from what shape each band is — that is `biquad.h`.
 *
 * **Serial** is a cascade: each band filters the previous band's output, so
 * every band inherits the phase shift of the ones before it and overlapping
 * bands compound in an order-dependent way. It is the cheapest arrangement and
 * what almost every digital EQ does.
 *
 * **Parallel** filters the original signal with every band independently and
 * adds only what each one changed. No band hears another's phase, the result
 * does not depend on band order, and overlapping bands sum rather than
 * compound — the arrangement passive hardware falls into by construction.
 *
 * The magnitude curves are close but not identical and the phase behaviour is
 * entirely different, which is the whole reason the choice exists.
 */
#ifndef FLUIDEQ_EQ_H
#define FLUIDEQ_EQ_H

#include <stdint.h>

#include "fluideq/biquad.h"

#ifdef __cplusplus
extern "C" {
#endif

/** Matches the `EQ_ENGINES` order in `chain.ts`: serial, then parallel. */
typedef enum FeqEqEngine {
  FEQ_EQ_SERIAL = 0,
  FEQ_EQ_PARALLEL = 1
} FeqEqEngine;

/**
 * Run one channel's rack over one block, in place.
 *
 * `states` and `coefficients` are both `band_count` long and in the same
 * order. `dry` and `wet` are scratch the length of the block, supplied by the
 * caller because the audio thread never allocates — they are untouched by
 * the serial path and are only read by the parallel one.
 *
 * Static bands only for now. Dynamic bands need `dynamics.ts` ported beside
 * this; until then a band whose dynamic detector is active must stay on the
 * TypeScript backend.
 */
void feq_eq_process_bands(FeqBiquadState* states,
                          const FeqBiquadCoefficients* coefficients,
                          uint32_t band_count,
                          float* target,
                          uint32_t frames,
                          FeqEqEngine engine,
                          float* dry,
                          float* wet);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_EQ_H */
