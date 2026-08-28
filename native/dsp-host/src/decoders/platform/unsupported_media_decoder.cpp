/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "../media_decoder.h"

/**
 * No platform decoder here yet, and a table that opens nothing rather than a
 * null pointer.
 *
 * Same reasoning as the audio backend beside it: every caller has one code
 * path, and a platform with no implementation refuses through the same channel
 * an unreadable file does. The registry then falls through to nothing, the
 * player reports a failed load, and the renderer hands the sound back to the
 * element — which is a working app missing a format, not a broken one.
 *
 * macOS would earn an AVFoundation implementation on the same argument that
 * won Media Foundation on Windows: the codecs are already there and already
 * licensed. Linux has no equivalent and would need a real dependency, with the
 * patent question that comes with AAC in a binary that is sold.
 */
FeqDecoderOps feq_media_decoder_ops(void) {
  FeqDecoderOps ops{};
  return ops;
}
