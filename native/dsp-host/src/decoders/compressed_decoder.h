/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * MP3, FLAC and Ogg Vorbis, through vendored single-header decoders.
 *
 * Kept apart from the PCM decoder because they answer different questions.
 * WAV and AIFF are container formats — a header, a chunk list and the samples
 * — and are written out by hand here rather than pulling in a dependency for
 * something that short. These are codecs, and writing an MP3 decoder by hand
 * is not a weekend.
 */
#ifndef FLUIDEQ_COMPRESSED_DECODER_H
#define FLUIDEQ_COMPRESSED_DECODER_H

#include "fluideq/player.h"

/** Null `open` for anything none of the three libraries can read. */
FeqDecoderOps feq_compressed_decoder_ops(void);

#endif /* FLUIDEQ_COMPRESSED_DECODER_H */
