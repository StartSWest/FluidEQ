/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <cstddef>
#include <memory>
#include <optional>
#include <unordered_map>

#include "fluideq/scene/draw_plan.h"
#include "fluideq/scene/frame_pacing.h"
#include "fluideq/scene/size_ladder.h"

/*
 * How one monitor's scene is sized and paced from frame to frame, as the
 * window's scene runner does it (`useSceneRunner.ts`): the listener's choice,
 * the ladder the scene's maker puts it on, the size each program has proved
 * this session, the cadence frames arrive at and a rest in silence. No GPU
 * here — the painter hands in what the GPU clock read — so a test can drive
 * it frame by frame.
 */

namespace feq::scene {

/** Everything one frame is drawn through. */
struct FramePlan {
  double scale = 1.0;
  DrawSize output;
  DrawSize drawn;
  DrawSize canvas;
  Finish finish;
  PresentPlan steps;
};

class DesktopSizing {
 public:
  void choose(const DrawChoice& choice) { choice_ = choice; }
  const DrawChoice& choice() const { return choice_; }

  /**
   * A new program: FluidEQ's own (`measured`) from full size and down when
   * it must; anybody else's climbed to from the floor. Either starts at the
   * size this program has already proved here, if it has.
   */
  void start(std::size_t program, bool measured);

  /** The sizes and passes for the next frame on a window of `window` pixels. */
  FramePlan plan(DrawSize window);

  /**
   * One frame at `now_ms`: drawn, or skipped because the GPU still held
   * `kFramesInFlight` of them, with what the GPU clock read before it. True
   * once the scene is too slow even at the smallest size allowed.
   */
  bool judged(const CostReading& reading, double now_ms, bool drew,
              bool silent);

  /** The least time to leave between frames, all things considered. */
  double pace_ms() const;

 private:
  void make_ladder(double top);

  DrawChoice choice_;
  std::size_t program_ = 0;
  bool measured_ = true;
  std::unique_ptr<SizeLadder> ladder_;
  double ladder_top_ = 0.0;
  double ladder_floor_ = 0.0;
  /** The largest size each program has held for a run of frames here. */
  std::unordered_map<std::size_t, double> proven_;
  double held_scale_ = 0.0;
  int held_frames_ = 0;
  double planned_scale_ = 1.0;
  FrameCadence cadence_;
  std::optional<double> drawn_at_;
  RestWatch rest_;
};

}  // namespace feq::scene
