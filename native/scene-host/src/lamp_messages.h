/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
#include <cstdint>
#include <optional>
#include <span>
#include <string>
#include <vector>

#include "fluideq/scene/lamp_atmosphere.h"
#include "fluideq/scene/scene_tuner.h"
#include "scene_wire.h"

/*
 * The lamp host's messages read and written (`scene_wire.h` lays them out;
 * `src/main/lighting/sceneHostWire.ts` is the other end). Reading refuses
 * anything out of the bounds main itself keeps: a message that would make
 * the host allocate what no scene needs is a broken pipe, not a scene.
 */

namespace feq::scene::wire {

/** At most this many swatch colours and sliders: no pack carries more. */
inline constexpr std::uint32_t kMaxSwatch = 64;
inline constexpr std::uint32_t kMaxParams = 64;
/** `MAX_SCENE_ARTWORK_*` (`common/sceneArtwork.ts`). */
inline constexpr std::uint32_t kMaxArtworkBytes = 6U * 1024U * 1024U;
inline constexpr std::uint32_t kMaxArtworkEdge = 4096;
inline constexpr std::uint32_t kMaxArtworkPixels = 4096U * 2048U;

struct ShownScene {
  bool guarded = false;
  SceneResponse response;
  std::vector<SceneParam> params;
  std::string vertex_source;
  std::string fragment_source;
  std::array<float, 4> view{};
  std::array<float, 4> spectrum_rect{};
  int artwork_width = 0;
  int artwork_height = 0;
  std::vector<std::uint8_t> webp;
};

struct Show {
  std::uint32_t id = 0;
  std::vector<Rgb> swatch;
  std::optional<ShownScene> scene;
};

struct Daylight {
  DaylightMode mode = DaylightMode::kFixed;
  double value = 0.0;
};

/** Each read is false on a payload that is not exactly its message. */
bool read_show(std::span<const std::uint8_t> payload, Show& show);
bool read_daylight(std::span<const std::uint8_t> payload, Daylight& daylight);
bool read_flag(std::span<const std::uint8_t> payload, bool& flag);
bool read_profile(std::span<const std::uint8_t> payload, LampProfile& profile);
bool read_accent(std::span<const std::uint8_t> payload,
                 std::array<double, 3>& accent);

/** What a grid says beside its colours. */
struct GridReading {
  double level = 0.0;
  double beat = 0.0;
  std::array<double, 3> bands{};
  double delta_ms = 0.0;
  double time_seconds = 0.0;
  double activity = 0.0;
  bool drawn = false;
};

std::vector<std::uint8_t> grid_message(std::span<const std::uint8_t> rgb,
                                       const GridReading& reading);
std::vector<std::uint8_t> picture_message(std::span<const std::uint8_t> rgb,
                                          int width, int height);
std::vector<std::uint8_t> loaded_message(std::uint32_t id);
std::vector<std::uint8_t> failed_message(std::uint32_t id, FailReason reason,
                                         const std::string& words);

}  // namespace feq::scene::wire
