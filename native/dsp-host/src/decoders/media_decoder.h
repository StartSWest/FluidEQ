/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The formats the operating system already knows, decoded by the operating
 * system.
 *
 * What is left after WAV, AIFF, MP3, FLAC and Ogg Vorbis is the MPEG-4 family
 * — m4a, m4b, AAC, ALAC — and WMA. Every permissive AAC decoder that could be
 * vendored is either GPL-incompatible (`uaac.h` is RPSL, Fraunhofer's FDK has
 * its own terms) or a whole library rather than a header (faad2, which is
 * GPL-2-or-later and would at least be compatible). None of that addresses the
 * other half of the problem: AAC is patented, and shipping a decoder inside a
 * binary that is SOLD is a different question from compiling one at home.
 *
 * Windows has already answered both. Media Foundation decodes AAC since
 * Windows 7 and WMA since Vista, Microsoft licenses those codecs for the
 * operating system, and asking it costs nothing to link and nothing to
 * distribute. It is what any native Windows media application does, and it is
 * the correct answer rather than the expedient one.
 *
 * Other platforms get a stub that opens nothing. macOS has AVFoundation and
 * would earn the same treatment; Linux has no equivalent and would need a real
 * dependency. Until either is written, those files fall back to the element,
 * which is exactly what the fallback is for.
 */
#ifndef FLUIDEQ_MEDIA_DECODER_H
#define FLUIDEQ_MEDIA_DECODER_H

#include "fluideq/player.h"

/** Null `open` for anything the platform cannot decode, and on every platform
 * that has no implementation yet. */
FeqDecoderOps feq_media_decoder_ops(void);

#endif /* FLUIDEQ_MEDIA_DECODER_H */
