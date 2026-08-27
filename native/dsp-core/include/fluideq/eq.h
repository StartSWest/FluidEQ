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
#include "fluideq/dynamics.h"
#include "fluideq/oversample.h"

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
 * `states`, `coefficients` and `dynamics` are all `band_count` long and in the
 * same order. `dry` and `wet` are scratch the length of the block, supplied by
 * the caller because the audio thread never allocates — the serial path only
 * touches them for bands whose detector is active.
 *
 * `dynamics` may be null, which reads as a rack of static bands. Individual
 * entries with `active == 0` take the static path, so a rack may mix the two
 * freely; that is the ordinary case, since most bands are static.
 */
void feq_eq_process_bands(FeqBiquadState* states,
                          const FeqBiquadCoefficients* coefficients,
                          uint32_t band_count,
                          float* target,
                          uint32_t frames,
                          FeqEqEngine engine,
                          float* dry,
                          float* wet,
                          FeqBandDynamics* dynamics);

/**
 * The same rack, with one dynamic trajectory shared by every channel.
 *
 * Filter histories stay channel-local — `states` is `channels * band_count`,
 * indexed `[channel * band_count + band]` — but each band's detector listens
 * to whichever channel is changing most at that sample and applies the result
 * to all of them together. Without that, a dynamic cut engaging on the left a
 * few samples before the right pulls a centred vocal sideways, which is
 * audible in a way the magnitude plot cannot show.
 */
void feq_eq_process_bands_linked(FeqBiquadState* states,
                                 uint32_t state_stride,
                                 const FeqBiquadCoefficients* coefficients,
                                 uint32_t band_count,
                                 float* const* targets,
                                 uint32_t channels,
                                 uint32_t frames,
                                 FeqEqEngine engine,
                                 float* const* dry,
                                 float* const* wet,
                                 FeqBandDynamics* dynamics);

/**
 * Up, through the rack, and back down.
 *
 * `factor` is 2 or 4, and every doubled buffer is exactly that many times as
 * long as the block. The coefficients handed in must already have been built
 * for the oversampled rate — see the note in `oversample.h`.
 */
void feq_eq_process_oversampled(FeqBiquadState* states,
                                const FeqBiquadCoefficients* coefficients,
                                uint32_t band_count,
                                float* target,
                                uint32_t frames,
                                FeqEqEngine engine,
                                FeqOversampler* oversampler,
                                uint32_t factor,
                                float* doubled,
                                float* dry_doubled,
                                float* wet_doubled,
                                float* middle,
                                FeqBandDynamics* dynamics);

/** Oversampled, with one dynamic amount applied to every channel. */
void feq_eq_process_oversampled_linked(FeqBiquadState* states,
                                       uint32_t state_stride,
                                       const FeqBiquadCoefficients* coeffs,
                                       uint32_t band_count,
                                       float* const* targets,
                                       uint32_t channels,
                                       uint32_t frames,
                                       FeqEqEngine engine,
                                       FeqOversampler* oversamplers,
                                       uint32_t factor,
                                       float* const* doubled,
                                       float* const* dry_doubled,
                                       float* const* wet_doubled,
                                       float* const* middle,
                                       FeqBandDynamics* dynamics);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_EQ_H */
