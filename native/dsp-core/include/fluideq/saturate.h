/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The asymmetric soft clipper behind the EQ's colour control, ported from
 * `saturate.ts`.
 *
 * An offset tanh rather than a symmetric one. A symmetric curve produces ODD
 * harmonics only, and odd harmonics are what the ear reads as grit rather than
 * warmth; the offset is what puts a second harmonic in front of the third and
 * keeps the dial monotonic in both across its whole travel.
 */
#ifndef FLUIDEQ_SATURATE_H
#define FLUIDEQ_SATURATE_H

#include <stdint.h>

#include "fluideq/oversample.h"

#ifdef __cplusplus
extern "C" {
#endif

/** Scratch is sized for this, whatever factor the session actually uses. */
#define FEQ_SATURATE_MAX_OVERSAMPLE 4

typedef struct FeqSaturator {
  FeqOversampler oversampler;
} FeqSaturator;

void feq_saturator_reset(FeqSaturator* state);

/** The raw curve, for measurement and for callers that want one sample. */
double feq_saturate_sample(double sample, double drive);

/**
 * Saturate a block in place at a rate-aware resolution.
 *
 * Four times at 44.1/48 moves the folding boundary far enough away for the
 * generated harmonics. A 96 kHz session already supplies one of those octaves
 * and 192 kHz supplies both, so a further 4x there spends the audio deadline
 * without improving anything.
 *
 * `blend` below zero keeps the raw shaper, which is what measurement wants.
 * Zero to one makes this the EQ's parallel colour path: zero is the resampled
 * carrier, one is the level-normalised curve. The raw curve compresses the
 * fundamental as it adds colour, which made the control replace the waveform
 * rather than enrich it — on a full mix that dense difference is heard as
 * grain.
 *
 * `oversampled` is scratch of `frames * FEQ_SATURATE_MAX_OVERSAMPLE` floats
 * and `middle` of `frames * 2`. Both are the caller's, because the audio
 * thread may not allocate and the reference grows its own on first use.
 */
void feq_saturate_block(FeqSaturator* state,
                        float* target,
                        uint32_t frames,
                        double drive,
                        double blend,
                        double sample_rate,
                        float* oversampled,
                        float* middle);

/**
 * The dial's position mapped to a drive that stays colour.
 *
 * The ceiling is 0.72 rather than 1: at 1 the curve was still even-dominant on
 * a sine, but a sine does not expose intermodulation, and broadband music made
 * every partial bend every other partial until the top of the control sounded
 * grainy. The 1.6 power keeps the bottom of the travel fine without leaving
 * the middle of the dial inaudible, which is what squaring it did.
 */
double feq_fuzz_drive(double amount);

/**
 * Preserve most of the carrier even at the top of the dial: 45% to 60%.
 * Full replacement is what made a broadband colour stage read as fuzz.
 */
double feq_fuzz_blend(double amount);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_SATURATE_H */
