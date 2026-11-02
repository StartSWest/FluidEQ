/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include "fluideq/scene/size_ladder.h"

// What both ladders share (`sceneHealth.ts`).

namespace feq::scene {

/** Consecutive over-budget frames before a step; a run, not one hiccup. */
inline constexpr int kStepDownFrames = 6;
/** Past this many intervals a frame is catastrophically slow. */
inline constexpr double kSlowFrameFactor = 3.0;
/** Consecutive catastrophic frames at the floor before the scene is given up. */
inline constexpr int kSlowFramesToStep = 24;
/** The finishing passes' share of the interval past which they are too dear. */
inline constexpr double kFinishShare = 0.3;

/**
 * Counts the frames whose finishing was too dear and says when it has been
 * so for a run of them (`createFinishWatch`): a decision for the session.
 */
class FinishWatch {
 public:
  void frame(const CostReading& reading, double interval_ms) {
    if (cheap_ || !reading.post_ms) {
      return;
    }
    streak_ = *reading.post_ms > interval_ms * kFinishShare ? streak_ + 1 : 0;
    if (streak_ >= kStepDownFrames) {
      cheap_ = true;
    }
  }
  bool cheap() const { return cheap_; }
  void reset() {
    streak_ = 0;
    cheap_ = false;
  }

 private:
  int streak_ = 0;
  bool cheap_ = false;
};

}  // namespace feq::scene
