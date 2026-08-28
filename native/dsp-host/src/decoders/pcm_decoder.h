/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The uncompressed half of the library: WAV and AIFF.
 *
 * Written here rather than taken from a library, because these are container
 * formats rather than codecs — a header, a chunk list and the samples — and a
 * dependency for that would be a licence obligation in a signed, sold binary
 * bought for nothing.
 *
 * The compressed formats are a different question and are deliberately not
 * answered here. See `feq_decoder_ops` for what happens when one arrives.
 */
#ifndef FLUIDEQ_PCM_DECODER_H
#define FLUIDEQ_PCM_DECODER_H

#include "fluideq/player.h"

/**
 * The decoder table the player is given.
 *
 * `open` returns null for anything it cannot read, which the player reports as
 * a failed load rather than as silence.
 */
FeqDecoderOps feq_decoder_ops(void);

/** Non-zero when this build can decode the file at `path` without help. */
int feq_decoder_handles(const char* path);

#endif /* FLUIDEQ_PCM_DECODER_H */
