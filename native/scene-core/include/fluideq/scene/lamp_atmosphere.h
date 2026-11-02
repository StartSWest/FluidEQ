/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
#include <cstdint>
#include <span>
#include <vector>

#include "fluideq/scene/scene_frame.h"

/*
 * What the lamps' scene is handed between the music heard and the draw, and
 * what the desk shows when the scene cannot be drawn: the C++ twins of
 * `src/renderer/lighting/lightingAtmosphere.ts` (silence changes how the
 * scene moves, never whether it is lit), of `createDaylightFollower` and
 * `clockDaylight` (the time of day the window asks of its scenes, eased by
 * the frames' own time), and of `swatchGrid.ts` (the scene's colours spread
 * by its spectrum).
 */

namespace feq::scene {

/** The member's idle settings for the look playing (`ILightingProfile`). */
struct LampProfile {
  /** `idle === 'hold'`: the scene stands still in silence. */
  bool hold = false;
  /** How fast it flows in silence, 0.1 to 1 (`idleSpeed`). */
  double idle_speed = 0.35;
};

class LampAtmosphere {
 public:
  /**
   * `frame`, `delta_ms` of audio after the last, as the desk shows it: its
   * clock and its movement eased between the music and the member's rest.
   */
  void apply(SceneFrame& frame, double delta_ms, bool silent,
             const LampProfile& profile);
  /** 0 in long silence to 1 with music, eased (`activity`). */
  double activity() const { return activity_; }

 private:
  double activity_ = 0.0;
  double time_seconds_ = 0.0;
};

/** `clockDaylight`: the time of day at a local clock reading, 0 to 100. */
double clock_daylight(int hours, int minutes, int seconds);

/** `createDaylightFollower`: where the scene is drawn, eased to `target`. */
class DaylightFollower {
 public:
  double next(double target, double delta_ms);

 private:
  bool started_ = false;
  double value_ = 0.0;
};

using Rgb = std::array<std::uint8_t, 3>;

/** `swatchColours`'s answer when a pack carries no usable swatch. */
inline constexpr Rgb kSwatchAccent{0, 229, 207};

/**
 * `fillSwatchGrid`: `colours` running left to right across a grid `width` by
 * `height`, lit from the bottom up to each column's level of `spectrum`.
 */
void fill_swatch_grid(std::span<const Rgb> colours,
                      std::span<const std::uint8_t> spectrum, int width,
                      int height, std::vector<std::uint8_t>& into);

}  // namespace feq::scene
