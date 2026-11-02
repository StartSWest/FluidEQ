/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <cstdint>
#include <span>
#include <string>
#include <vector>

/*
 * A scene's artwork as the window's `decodeSceneArtwork` hands it to WebGL:
 * the pack's WebP (the only kind `common/sceneArtwork.ts` admits, its bytes
 * already verified by main), decoded by Windows' own WebP codec (in every
 * Windows since 10 1809), premultiplied, bottom row first (`flipY`), its
 * colours as stored (`colorSpaceConversion: 'none'`: WIC converts none).
 * Called on a thread that has COM.
 */

namespace feq::scene {

/**
 * `rgba` the picture, which must be `width` by `height` as the pack's signed
 * header says; false with `why` when it is not a WebP of that size.
 */
bool decode_artwork(std::span<const std::uint8_t> webp, int width, int height,
                    std::vector<std::uint8_t>& rgba, std::string& why);

}  // namespace feq::scene
