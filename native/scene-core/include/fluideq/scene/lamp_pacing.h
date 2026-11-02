/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <deque>
#include <vector>

/*
 * The size the lamps' scene is drawn at, and the grid it is reduced to: the
 * C++ twins of `src/renderer/lighting/lampPacing.ts` (start small, grow
 * while the GPU keeps the frame inside its time, shrink after a run of late
 * frames and wait longer before trying again, give the scene up when even
 * the smallest size holds the GPU) and of `gridDownsample.ts` (each cell
 * the light of its block, weighted towards its brightest pixels).
 */

namespace feq::scene {

inline constexpr std::array<std::array<int, 2>, 4> kLampSizes{{
    {768, 432},
    {384, 216},
    {192, 108},
    {96, 54},
}};
inline constexpr int kLightingGridWidth = 48;
inline constexpr int kLightingGridHeight = 27;

enum class LampPace { kSame, kSmaller, kLarger, kGiveUp };

class LampPacing {
 public:
  const std::array<int, 2>& size() const { return kLampSizes[step_]; }
  LampPace record(double elapsed_ms);

 private:
  LampPace change(std::size_t next);

  std::size_t step_ = kLampSizes.size() - 1;
  bool climbing_ = true;
  bool warming_ = true;
  int late_ = 0;
  int hopeless_ = 0;
  std::deque<double> times_;
  double fixed_ = 4.0;
  std::ptrdiff_t blocked_ = -1;
  int resting_ = 0;
  int rest_ = 150;
};

/**
 * `pixels` (RGBA, bottom row first, as `readPixels` returns them) of
 * `width` by `height`, reduced to the lamps' grid, top row first, RGB.
 */
void downsample_to_grid(const std::uint8_t* pixels, int width, int height,
                        std::vector<std::uint8_t>& into);

}  // namespace feq::scene
