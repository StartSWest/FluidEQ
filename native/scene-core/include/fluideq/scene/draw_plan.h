/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
#include <optional>

/*
 * The sizes a scene drawn without a page goes through, and the finishing
 * passes between them, on the window's own rules (`useSceneRunner.ts`,
 * `sceneCanvasPlan.ts`, `scenePost.ts`'s `presentPlan`): the panel's pixels up
 * to a 4K budget, larger than that for `best` smoothing, smaller where the
 * ladder or a preset says, and brought back to the panel by FSR or averaged
 * down. Held to the TypeScript by `scene_sizing_parity_test.cpp`.
 */

namespace feq::scene {

/** How much larger than the panel `best` smoothing draws, each way. */
inline constexpr double kSupersample = 2.0;

enum class Smoothing { kOff, kFast, kBest };

/** The listener's choice for a scene (`IScenePerformance`), as main sends it. */
struct DrawChoice {
  /**
   * The share of the panel a preset pins the picture to; 1 for full size
   * (`native`), which `best` smoothing still draws larger; none for the
   * ladder to decide (`auto`).
   */
  std::optional<double> pinned;
  /** The smallest picture `auto` may draw. */
  double auto_floor = 0.35;
  /** A smaller picture brought up by FSR rather than a plain stretch. */
  bool fsr = true;
  Smoothing smoothing = Smoothing::kBest;
  /** The least time between frames the listener allows; 0 for every one. */
  double pace_ms = 0.0;
};

struct DrawSize {
  int width = 1;
  int height = 1;
  bool operator==(const DrawSize&) const = default;
};

/** The panel's pixels, held to a 4K pixel budget. */
DrawSize output_size(int panel_width, int panel_height);

/** The largest scale a ladder climbs to: above 1 when `best` draws larger. */
double ladder_top(Smoothing smoothing, DrawSize output);

/** `scale` of `output`, never under a pixel. */
DrawSize drawn_size(DrawSize output, double scale);

/** The scale to draw at: the ladder's, unless a preset or full size is pinned. */
double chosen_scale(const DrawChoice& choice, double top, double ladder_scale);

struct Finish {
  bool fsr = false;
  bool fxaa = false;
};

/**
 * The passes the choice asks for at `scale`: FSR until it proved too dear
 * (`cheap`), FXAA unless the picture is already a full supersample.
 */
Finish finish_for(const DrawChoice& choice, double scale, bool cheap);

/**
 * What the passes finish at: the panel's pixels when the picture is brought
 * to them, the drawn size when a smaller one is left for a plain stretch.
 */
DrawSize canvas_size(DrawSize drawn, DrawSize output, Finish finish);

enum class PresentStep { kFsr, kDownsample, kFxaa, kCopy };

/** The passes from the drawn picture to the canvas, in order: one or two. */
struct PresentPlan {
  std::array<PresentStep, 2> steps{};
  int count = 0;
};

PresentPlan present_plan(DrawSize drawn, DrawSize canvas, Finish finish);

}  // namespace feq::scene
