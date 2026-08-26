/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Polyphase-free 2x/4x oversampling, ported from `oversample.ts`.
 *
 * What this buys a linear filter is not headroom — a biquad cannot alias — it
 * is ROOM. The bilinear transform squeezes the frequency axis as it nears
 * Nyquist, and a band placed high loses its upper skirt against that wall.
 * Measured at 44.1 kHz, a 16 kHz bell asked for +6 dB carries 0.6 dB an octave
 * below its centre and 0.03 an octave above. Run at 88.2 kHz the wall is an
 * octave further off and the band keeps its shape.
 *
 * The coefficients MUST be built for the doubled rate. That is the mechanism,
 * not a detail: handing the ordinary set to an oversampled pass places every
 * band an octave low.
 */
#ifndef FLUIDEQ_OVERSAMPLE_H
#define FLUIDEQ_OVERSAMPLE_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Odd, so the filter has an exact centre tap and a whole-sample delay. */
#define FEQ_OVERSAMPLE_TAPS 63

/** Two halvings is the most any supported factor needs. */
#define FEQ_OVERSAMPLE_STAGES 2

typedef struct FeqOversampler {
  /** One circular FIR history per halving, per direction. */
  double up[FEQ_OVERSAMPLE_STAGES][FEQ_OVERSAMPLE_TAPS];
  double down[FEQ_OVERSAMPLE_STAGES][FEQ_OVERSAMPLE_TAPS];
  /** Next write slot in each history. */
  int up_position[FEQ_OVERSAMPLE_STAGES];
  int down_position[FEQ_OVERSAMPLE_STAGES];
} FeqOversampler;

void feq_oversampler_reset(FeqOversampler* state);

/**
 * Highest power-of-two factor that keeps nonlinear processing at or below
 * 192 kHz. The session rate itself is never changed: a 192 kHz context already
 * has the resolution 48 kHz reaches at 4x.
 *
 * Calculated from the actual rate rather than a table, so an uncommon device
 * rate cannot fall through a gap into the wrong factor.
 */
uint32_t feq_oversample_factor_for_sample_rate(double sample_rate);

/**
 * `input` at `frames` becomes `output` at `frames * factor`.
 *
 * `middle` is scratch of at least `frames * 2` floats and is only touched at
 * 4x. The reference allocates it lazily; here the caller owns it, because the
 * audio thread may not allocate and a lazy allocation is one that happens on
 * whichever block first needed it — the worst possible moment.
 *
 * A factor other than 2 or 4 copies, because a caller asking for 1x wants the
 * signal untouched rather than an error.
 */
void feq_oversample_up(FeqOversampler* state,
                       const float* input,
                       float* output,
                       uint32_t frames,
                       uint32_t factor,
                       float* middle);

/** `input` at `frames * factor` becomes `output` at `frames`. */
void feq_oversample_down(FeqOversampler* state,
                         const float* input,
                         float* output,
                         uint32_t frames,
                         uint32_t factor,
                         float* middle);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_OVERSAMPLE_H */
