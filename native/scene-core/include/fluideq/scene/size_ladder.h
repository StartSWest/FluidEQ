/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
#include <memory>
#include <optional>

/*
 * How large a scene is drawn, decided from what its frames cost the GPU: the
 * window's two size ladders (`src/renderer/graph/sceneHealth.ts` and
 * `sceneWarmup.ts`) in C++, for the scenes drawn without a page. Held to
 * what the TypeScript answers frame by frame (`scene_sizing_parity_test.cpp`,
 * `sceneSizingFixture.ts`), so a background on the desktop gets the same size
 * from the C++ host as it did from its page. Nothing here has a timer: every
 * wait is counted in frames, from the interval frames are arriving at.
 */

namespace feq::scene {

inline constexpr double kThirtyASecondMs = 1000.0 / 30.0;

/** Full to a third: AMD's FSR presets, with one more step off native. */
inline constexpr std::array<double, 8> kRenderScales{1.0,  0.85, 0.77, 0.67,
                                                     0.59, 0.5,  0.42, 0.35};

/** The rate a scene is held to on the rung below the smallest picture. */
inline constexpr double kSlowPaceMs = kThirtyASecondMs;

/** What one frame cost, as the GPU clock reports it (`gpu_clock.h`). */
struct CostReading {
  /** The GPU's own time for the newest finished frame; none without a clock. */
  std::optional<double> cost_ms;
  /** The finishing passes' share of `cost_ms`, when timed. */
  std::optional<double> post_ms;
  /** Frames still on the GPU when the next one was due. */
  int behind = 0;
};

/** The ladder a scene is drawn on (`ICostLadder`). */
class SizeLadder {
 public:
  virtual ~SizeLadder() = default;
  /** The share of the output's pixels, each way, to draw at. */
  virtual double scale() const = 0;
  /** On the rung below the smallest picture: frames held to `kSlowPaceMs`. */
  virtual bool slowed() const = 0;
  /**
   * One frame's reading, against the interval frames arrive at. True once
   * the scene is too slow even at the bottom, when it is handed over.
   */
  virtual bool frame(const CostReading& reading, double interval_ms,
                     bool hidden) = 0;
  /** The finishing passes have proved too dear here: the plain scaler. */
  virtual bool cheap_finish() const = 0;
  /** The listener changed the smallest size allowed; the picture stays. */
  virtual void refloor(double floor) = 0;
  /** Start from a size this program has already proved it draws. */
  virtual void resume(double scale) = 0;
  virtual void reset() = 0;
};

/**
 * FluidEQ's own scenes, watched before release: from full size, down
 * straight to the rung the measured cost fits, and back up the same way.
 * `top` above 1 is the supersampled size `best` smoothing asks for.
 */
std::unique_ptr<SizeLadder> make_cost_ladder(double top = 1.0,
                                             double floor = kRenderScales.back());

/**
 * A member's scene, or the listener's own, watched by nobody here: from the
 * listener's smallest size, a rung at a time after a run of smooth frames.
 */
std::unique_ptr<SizeLadder> make_warmup_ladder(double top = 1.0,
                                               double floor = 0.0);

}  // namespace feq::scene
