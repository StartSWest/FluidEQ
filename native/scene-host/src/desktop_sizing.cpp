/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "desktop_sizing.h"

#include <algorithm>

namespace feq::scene {
namespace {

/**
 * Frames a size has to be held for before it counts as proved: the ladder's
 * own run before it hands a scene over (`PROVEN_FRAMES`).
 */
constexpr int kProvenFrames = 24;

}  // namespace

void DesktopSizing::start(std::size_t program, bool measured) {
  program_ = program;
  measured_ = measured;
  ladder_.reset();
  held_scale_ = 0.0;
  held_frames_ = 0;
  cadence_.reset();
  drawn_at_.reset();
  rest_.reset();
}

void DesktopSizing::make_ladder(double top) {
  ladder_top_ = top;
  ladder_floor_ = choice_.auto_floor;
  ladder_ = measured_ ? make_cost_ladder(top, ladder_floor_)
                      : make_warmup_ladder(top, ladder_floor_);
  const auto proved = proven_.find(program_);
  if (proved != proven_.end()) {
    ladder_->resume(proved->second);
  }
}

FramePlan DesktopSizing::plan(DrawSize window) {
  FramePlan plan;
  plan.output = output_size(window.width, window.height);
  const double top = ladder_top(choice_.smoothing, plan.output);
  if (!ladder_ || top != ladder_top_) {
    make_ladder(top);
  } else if (choice_.auto_floor != ladder_floor_) {
    // A new floor moves the rungs under the picture, never the picture.
    ladder_floor_ = choice_.auto_floor;
    ladder_->refloor(ladder_floor_);
  }
  plan.scale = chosen_scale(choice_, top, ladder_->scale());
  plan.drawn = drawn_size(plan.output, plan.scale);
  plan.finish = finish_for(choice_, plan.scale, ladder_->cheap_finish());
  plan.canvas = canvas_size(plan.drawn, plan.output, plan.finish);
  plan.steps = present_plan(plan.drawn, plan.canvas, plan.finish);
  planned_scale_ = plan.scale;
  return plan;
}

bool DesktopSizing::judged(const CostReading& reading, double now_ms,
                           bool drew, bool silent) {
  if (!ladder_) {
    return false;
  }
  if (drawn_at_) {
    cadence_.note(now_ms - *drawn_at_);
  }
  drawn_at_ = now_ms;
  rest_.frame(now_ms, silent);
  if (ladder_->frame(reading, cadence_.interval_ms(), false)) {
    return true;
  }
  if (!drew) {
    return false;
  }
  // A size held for a run of frames is one this program draws: the next
  // ladder made for it starts there, not from the bottom.
  if (planned_scale_ == held_scale_) {
    held_frames_ += 1;
  } else {
    held_scale_ = planned_scale_;
    held_frames_ = 1;
  }
  if (held_frames_ >= kProvenFrames) {
    double& proved = proven_[program_];
    proved = std::max(proved, planned_scale_);
  }
  return false;
}

double DesktopSizing::pace_ms() const {
  return std::max({choice_.pace_ms,
                   ladder_ && ladder_->slowed() ? kSlowPaceMs : 0.0,
                   rest_.resting() ? kRestPaceMs : 0.0});
}

}  // namespace feq::scene
