/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The warm-up ladder, `createWarmupLadder` in `sceneWarmup.ts`, line for
// line: a scene nobody here has watched can be heavy enough to reset the
// display driver for every program on the machine, so it climbs to full size
// from the listener's floor, a rung at a time, never past a rung it ran slow
// at. Its comments there say why each number is what it is.

#include <algorithm>
#include <vector>

#include "fluideq/scene/size_ladder.h"
#include "size_ladder_internal.h"

namespace feq::scene {
namespace {

constexpr std::array<double, 7> kWarmupScales{0.125, 0.25, 0.35, 0.5,
                                              0.67,  0.85, 1.0};
constexpr int kGoodFramesToClimb = 12;
constexpr double kHopelessFactor = 10.0;
constexpr int kHopelessFrames = 3;
/** Slack for the clock's jitter when deciding a frame was smooth. */
constexpr double kSmoothSlack = 1.25;

class WarmupLadder final : public SizeLadder {
 public:
  WarmupLadder(double top, double floor)
      : scales_(kWarmupScales.begin(), kWarmupScales.end()) {
    if (top > 1.0) {
      scales_.push_back(top);
    }
    floor_rung_ = floor_rung_for(floor);
    rung_ = floor_rung_;
    ceiling_ = last();
  }

  double scale() const override {
    return scales_[static_cast<std::size_t>(rung_)];
  }
  bool slowed() const override { return slowed_; }
  bool cheap_finish() const override { return finish_.cheap(); }

  void refloor(double floor) override {
    floor_rung_ = floor_rung_for(floor);
    if (rung_ < floor_rung_) {
      rung_ = floor_rung_;
      good_streak_ = 0;
    }
  }

  void resume(double proved) override {
    int at = 0;
    for (int index = 0; index <= last(); ++index) {
      if (scales_[static_cast<std::size_t>(index)] <= proved + 1e-6 &&
          index <= ceiling_) {
        at = index;
      }
    }
    rung_ = at;
    good_streak_ = 0;
  }

  bool frame(const CostReading& reading, double interval_ms,
             bool hidden) override {
    if (hidden || degraded_) {
      good_streak_ = 0;
      slow_streak_ = 0;
      hopeless_streak_ = 0;
      return degraded_;
    }
    finish_.frame(reading, interval_ms);
    const double budget = std::max(1.0, interval_ms);
    const bool exact = reading.cost_ms.has_value();
    const bool hopeless = exact && *reading.cost_ms > budget * kHopelessFactor;
    const bool slow = exact ? *reading.cost_ms > budget * kSlowFrameFactor
                            : reading.behind >= 2;
    const bool smooth = exact ? *reading.cost_ms <= budget * kSmoothSlack
                              : reading.behind == 0;

    hopeless_streak_ = hopeless ? hopeless_streak_ + 1 : 0;
    if (rung_ <= floor_rung_ && hopeless_streak_ >= kHopelessFrames) {
      degraded_ = true;
      return degraded_;
    }

    if (slow) {
      good_streak_ = 0;
      slow_streak_ += 1;
      if (slow_streak_ >= kSlowFramesToStep) {
        slow_streak_ = 0;
        if (rung_ == floor_rung_ && rung_ > 0 && !slowed_ &&
            interval_ms < kSlowPaceMs * 0.9) {
          // The smallest picture allowed, still slow: the rate goes first.
          slowed_ = true;
          ceiling_ = rung_;
        } else if (rung_ <= floor_rung_) {
          degraded_ = true;
        } else {
          // Never back up to the rung that ran slow: that pulses.
          ceiling_ = rung_ - 1;
          rung_ -= 1;
        }
      }
      return degraded_;
    }

    slow_streak_ = 0;
    good_streak_ = smooth ? good_streak_ + 1 : 0;
    if (good_streak_ >= kGoodFramesToClimb && rung_ < ceiling_) {
      rung_ += 1;
      good_streak_ = 0;
    }
    return degraded_;
  }

  void reset() override {
    rung_ = floor_rung_;
    ceiling_ = last();
    good_streak_ = 0;
    slow_streak_ = 0;
    hopeless_streak_ = 0;
    slowed_ = false;
    degraded_ = false;
    finish_.reset();
  }

 private:
  int last() const { return static_cast<int>(scales_.size()) - 1; }

  /** The lowest rung the listener would have a scene rest on. */
  int floor_rung_for(double allowed) const {
    for (int index = 0; index <= last(); ++index) {
      if (scales_[static_cast<std::size_t>(index)] >= allowed - 1e-6) {
        return index;
      }
    }
    return 0;
  }

  std::vector<double> scales_;
  FinishWatch finish_;
  int floor_rung_ = 0;
  int rung_ = 0;
  int ceiling_ = 0;
  int good_streak_ = 0;
  int slow_streak_ = 0;
  int hopeless_streak_ = 0;
  bool slowed_ = false;
  bool degraded_ = false;
};

}  // namespace

std::unique_ptr<SizeLadder> make_warmup_ladder(double top, double floor) {
  return std::make_unique<WarmupLadder>(top, floor);
}

}  // namespace feq::scene
