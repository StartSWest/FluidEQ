/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <Windows.h>

#include <cstdint>
#include <utility>
#include <vector>

#include "fluideq/scene/lamp_atmosphere.h"
#include "lamp_messages.h"

namespace feq::scene {

/** The time of day to draw at now: the clock's, or the one main set. */
inline double daylight_now(const wire::Daylight& daylight) {
  if (daylight.mode != wire::DaylightMode::kClock) {
    return daylight.value;
  }
  SYSTEMTIME local{};
  GetLocalTime(&local);
  return clock_daylight(local.wHour, local.wMinute, local.wSecond);
}

/**
 * A scene as main described it, made the scene a painter draws — the lamps'
 * (`LampScene`) or a monitor's (`DesktopScene`), which hold the same parts.
 * `artwork` is its picture already decoded, empty for none.
 */
template <typename Scene>
Scene scene_of(std::uint32_t id, wire::ShownScene shown,
               std::vector<std::uint8_t> artwork) {
  Scene made;
  made.id = id;
  made.guarded = shown.guarded;
  made.response = shown.response;
  made.pack.vertex_source = std::move(shown.vertex_source);
  made.pack.fragment_source = std::move(shown.fragment_source);
  for (const auto& param : shown.params) {
    // `uniformNameForParam`.
    made.pack.params.emplace_back("uParam_" + param.id, param.value);
  }
  made.params = std::move(shown.params);
  made.pack.artwork = std::move(artwork);
  made.pack.artwork_width = made.pack.artwork.empty() ? 0 : shown.artwork_width;
  made.pack.artwork_height =
      made.pack.artwork.empty() ? 0 : shown.artwork_height;
  made.pack.view = shown.view;
  made.pack.spectrum_rect = shown.spectrum_rect;
  return made;
}

}  // namespace feq::scene
