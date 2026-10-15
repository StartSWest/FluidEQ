/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/*
 * The Exciter's oversampling, with the listener's choice of how.
 *
 * Standard is what the stage always did: the shared half-band oversampler
 * (`oversample.h`), 4x at 44.1 and 48 kHz, 2x at 88.2 and 96, none above.
 * Its 63-tap filter passes to 20 kHz at 48 kHz but is down only 6 dB at the
 * output's Nyquist, so what the harmonics make just over the top folds back:
 * 26 kHz lands at 22 kHz 22 dB down, and a top band pushed as far as its
 * dials go folds back 57 dB under its tone (`exciter_oversample_test.cpp`).
 *
 * High keeps the factor and trades the stage next to the output's own rate
 * for a sharp one: a Kaiser-windowed sinc that passes to 0.42 of the output
 * rate and is 90 dB down by its Nyquist (20.2 kHz and 24 kHz at 48 kHz), in
 * both directions. The second stage of a 4x path stays the shared one; at
 * twice the output rate its own transition lies far above anything heard.
 * The same pushed band folds back 125 dB under its tone.
 *
 * Off runs the harmonic generator at the output's rate: no filter, no lag,
 * and the aliasing that comes with it — 19 dB under the tone, a grit.
 *
 * The harmonics come back later than the programme they were made from by
 * the filters' delay, none on Off, about 1 ms on Standard and 1.8 ms on High
 * at 48 kHz; the clean part of each return is added at the output's rate and
 * is never delayed.
 *
 * Its own module rather than a mode of the shared oversampler, which the
 * EQ and the loudness meter use too: changing that filter would move the
 * EQ's frozen parity fixtures.
 */
#ifndef FLUIDEQ_EXCITER_OVERSAMPLE_H
#define FLUIDEQ_EXCITER_OVERSAMPLE_H

#include <stdint.h>

#include "fluideq/oversample.h"

#ifdef __cplusplus
extern "C" {
#endif

/** In the wire's order (`EXCITER_OVERSAMPLING` in `chain.ts`). */
typedef enum FeqExciterOversampling {
  FEQ_EXCITER_OVERSAMPLING_STANDARD = 0,
  FEQ_EXCITER_OVERSAMPLING_OFF = 1,
  FEQ_EXCITER_OVERSAMPLING_HIGH = 2
} FeqExciterOversampling;

/** The sharp stage's length: 90 dB over a transition of 0.04 of its rate. */
#define FEQ_EXCITER_STEEP_TAPS 143

typedef struct FeqExciterOversampler {
  FeqOversampler shared;
  double steep_up[FEQ_EXCITER_STEEP_TAPS];
  double steep_down[FEQ_EXCITER_STEEP_TAPS];
  int steep_up_position;
  int steep_down_position;
} FeqExciterOversampler;

void feq_exciter_oversampler_reset(FeqExciterOversampler* state);

/** The factor a quality runs at on an output of this rate. */
uint32_t feq_exciter_oversample_factor(double sample_rate, int quality);

/**
 * Up by `factor` (1, 2 or 4) in the quality's way. `middle` is
 * `frames * 2` floats, as the shared oversampler's.
 */
void feq_exciter_oversample_up(FeqExciterOversampler* state,
                               const float* input,
                               float* output,
                               uint32_t frames,
                               uint32_t factor,
                               int quality,
                               float* middle);

/** Down by `factor` to `frames` samples, mirroring the way up. */
void feq_exciter_oversample_down(FeqExciterOversampler* state,
                                 const float* input,
                                 float* output,
                                 uint32_t frames,
                                 uint32_t factor,
                                 int quality,
                                 float* middle);

/**
 * Output-rate frames a reset oversampler needs, up and back down, before
 * nothing of its empty start reaches what it returns. Faded in before then,
 * a return rises out of the filters filling, which is a broadband onset.
 */
uint32_t feq_exciter_oversample_warmup(uint32_t factor, int quality);

/**
 * `buffer` times a gain moving in a straight line from `from` to `to` over
 * the block, reaching `to` on its last sample: the ramp a change of
 * oversampling fades the harmonics through.
 */
void feq_exciter_oversample_ramp(float* buffer,
                                 uint32_t frames,
                                 double from,
                                 double to);

#ifdef __cplusplus
}
#endif

#endif
