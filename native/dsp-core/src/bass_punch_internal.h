/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What `bass_punch.cpp` and `bass_punch_bloom.cpp` share.
 *
 * The shaper and the bloom are two unrelated pieces of arithmetic that happen
 * to be dialled on the same page: one is a pair of envelope followers and a
 * gain, the other is a Schroeder network of delay lines. They were split when
 * the shaper grew its own shelf, along the seam that was already there — the
 * bloom is fed one mono sample per frame and returns one, and touches nothing
 * else in the state.
 */
#ifndef FLUIDEQ_BASS_PUNCH_INTERNAL_H
#define FLUIDEQ_BASS_PUNCH_INTERNAL_H

#include "fluideq/bass_punch.h"

/** Points every line at its caller-owned buffer and empties it. */
void bass_punch_bloom_attach(FeqBassPunch* state,
                             float* const* buffers,
                             uint32_t capacity);

/** Empties every line without changing its length. */
void bass_punch_bloom_clear(FeqBassPunch* state);

/**
 * Re-lengths every line for a new rate, and empties them as well.
 *
 * What is in a line at the old rate is read back at a different offset and a
 * different speed at the new one, and it is read back through a feedback loop,
 * so it does not decay out of the way.
 */
void bass_punch_bloom_retune(FeqBassPunch* state, double sample_rate);

/** The loop gains a dialled decay asks for, before the main loop smooths them
 *  towards them. `decay_ms` is clamped here to the documented range. */
void bass_punch_bloom_targets(double decay_ms,
                              double* comb_feedback,
                              double* all_pass_gain);

/** One sample through the network, band-limited by `limit` on the way out. */
double bass_punch_bloom_sample(FeqBassPunch* state,
                               double mono,
                               const FeqBiquadCoefficients* limit);

#endif /* FLUIDEQ_BASS_PUNCH_INTERNAL_H */
