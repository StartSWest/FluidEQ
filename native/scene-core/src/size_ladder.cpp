/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The cost ladder, `createCostLadder` in `sceneHealth.ts`, line for line: its
// comments there say why each number is what it is.

#include <algorithm>
#include <cmath>
#include <vector>

#include "fluideq/scene/size_ladder.h"
#include "size_ladder_internal.h"

namespace feq::scene {
namespace {

constexpr double kTargetShare = 0.7;
constexpr double kOverShare = 0.9;
constexpr double kClimbMs = 1000.0;
constexpr double kHoldMs = 1000.0;
constexpr double kBounceMs = 8000.0;
constexpr double kCeilingMs = 20000.0;
constexpr int kMaxCeilingDoublings = 3;

int frames_of(double ms, double interval_ms) {
  return std::max(1, static_cast<int>(std::ceil(ms / std::max(1.0, interval_ms))));
}

std::vector<double> ladder_scales(double top, double floor) {
  std::vector<double> scales;
  for (const double scale : kRenderScales) {
    if (scale >= floor - 1e-6) {
      scales.push_back(scale);
    }
  }
  if (scales.empty()) {
    scales.push_back(kRenderScales.front());
  }
  if (top > 1.0) {
    scales.insert(scales.begin(), top);
  }
  return scales;
}

struct Judged {
  bool over = false;
  bool catastrophic = false;
};

/** On the GPU's clock alone where there is one; on the pipeline otherwise. */
Judged judge(const CostReading& reading, double interval_ms) {
  if (reading.cost_ms) {
    return {*reading.cost_ms > interval_ms * kOverShare,
            *reading.cost_ms > interval_ms * kSlowFrameFactor};
  }
  return {reading.behind >= 1, reading.behind >= 2};
}

class CostLadder final : public SizeLadder {
 public:
  CostLadder(double top, double floor)
      : top_(top), scales_(ladder_scales(top, floor)),
        slow_rung_(static_cast<int>(scales_.size())) {}

  double scale() const override { return scale_at(rung_); }
  bool slowed() const override { return rung_ == slow_rung_; }
  bool cheap_finish() const override { return finish_.cheap(); }

  void refloor(double floor) override {
    const double current = scale_at(rung_);
    const bool was_slow = rung_ == slow_rung_;
    scales_ = ladder_scales(top_, floor);
    slow_rung_ = static_cast<int>(scales_.size());
    int at = -1;
    for (int index = 0; index < slow_rung_; ++index) {
      if (std::abs(scales_[static_cast<std::size_t>(index)] - current) < 1e-6) {
        at = index;
        break;
      }
    }
    if (was_slow) {
      rung_ = slow_rung_;
    } else {
      rung_ = at >= 0 ? at : slow_rung_ - 1;
    }
    ceiling_rung_ = 0;
    ceiling_left_ = 0;
  }

  void resume(double scale) override {
    int at = -1;
    for (int index = 0; index < slow_rung_; ++index) {
      if (scales_[static_cast<std::size_t>(index)] <= scale + 1e-6) {
        at = index;
        break;
      }
    }
    rung_ = at >= 0 ? at : slow_rung_ - 1;
  }

  bool frame(const CostReading& reading, double interval_ms,
             bool hidden) override {
    if (hidden || degraded_) {
      slow_streak_ = 0;
      floor_streak_ = 0;
      return degraded_;
    }
    finish_.frame(reading, interval_ms);
    if (reading.cost_ms) {
      typical_cost_ms_ =
          typical_cost_ms_
              ? *typical_cost_ms_ + (*reading.cost_ms - *typical_cost_ms_) * 0.2
              : *reading.cost_ms;
    }
    if (since_climb_) {
      *since_climb_ += 1;
    }
    if (hold_left_ > 0) {
      hold_left_ -= 1;
    }
    if (ceiling_left_ > 0) {
      ceiling_left_ -= 1;
      if (ceiling_left_ == 0) {
        ceiling_rung_ = 0;
      }
    }
    const Judged judged = judge(reading, interval_ms);
    const bool bottom = at_bottom(interval_ms);
    floor_streak_ = bottom && judged.catastrophic ? floor_streak_ + 1 : 0;
    if (floor_streak_ >= kSlowFramesToStep) {
      degraded_ = true;
      return degraded_;
    }
    if (judged.over) {
      slow_streak_ += 1;
      if (slow_streak_ >= 2) {
        clean_streak_ = 0;
      }
      if (slow_streak_ >= kStepDownFrames) {
        slow_streak_ = 0;
        if (!bottom) {
          step_down(interval_ms);
        }
      }
    } else {
      slow_streak_ = 0;
      clean_streak_ += 1;
      if (rung_ > 0) {
        climb(interval_ms);
      }
    }
    return degraded_;
  }

  void reset() override {
    rung_ = 0;
    slow_streak_ = 0;
    clean_streak_ = 0;
    floor_streak_ = 0;
    hold_left_ = 0;
    since_climb_.reset();
    ceiling_rung_ = 0;
    ceiling_left_ = 0;
    doublings_ = 0;
    typical_cost_ms_.reset();
    fast_interval_ms_.reset();
    degraded_ = false;
    finish_.reset();
  }

 private:
  double scale_at(int at) const {
    return scales_[static_cast<std::size_t>(std::min(at, slow_rung_ - 1))];
  }

  std::optional<double> predicted(int from_rung, int to_rung) const {
    if (!typical_cost_ms_) {
      return std::nullopt;
    }
    // Per pixel: the square of the scale, rounded once as `** 2` is.
    const double ratio = scale_at(to_rung) / scale_at(from_rung);
    return *typical_cost_ms_ * (ratio * ratio);
  }

  static bool can_slow(double interval_ms) {
    return interval_ms < kSlowPaceMs * 0.9;
  }

  bool at_bottom(double interval_ms) const {
    return rung_ == slow_rung_ ||
           (rung_ == slow_rung_ - 1 && !can_slow(interval_ms));
  }

  void step_down(double interval_ms) {
    const double target = kTargetShare * interval_ms;
    int next = rung_ + 1;
    while (next < slow_rung_ - 1) {
      const auto cost = predicted(rung_, next);
      if (!cost || *cost <= target) {
        break;
      }
      next += 1;
    }
    if (next == slow_rung_ - 1 && can_slow(interval_ms)) {
      const auto cost = predicted(rung_, next);
      if (cost && *cost > target) {
        next = slow_rung_;
      }
    }
    const bool bounced =
        since_climb_ && *since_climb_ < frames_of(kBounceMs, interval_ms);
    if (bounced) {
      ceiling_rung_ = std::max(ceiling_rung_, rung_ + 1);
      ceiling_left_ =
          frames_of(std::ldexp(kCeilingMs, doublings_), interval_ms);
      doublings_ = std::min(kMaxCeilingDoublings, doublings_ + 1);
    }
    if (next == slow_rung_) {
      fast_interval_ms_ = interval_ms;
    }
    rung_ = next;
    since_climb_.reset();
    hold_left_ = frames_of(kHoldMs, interval_ms);
  }

  void climb(double interval_ms) {
    if (rung_ - 1 < ceiling_rung_ || hold_left_ > 0) {
      return;
    }
    if (clean_streak_ < frames_of(kClimbMs, interval_ms)) {
      return;
    }
    const double budget = rung_ == slow_rung_ && fast_interval_ms_
                              ? *fast_interval_ms_
                              : interval_ms;
    const double room = kTargetShare * budget * 0.9;
    int next = rung_ - 1;
    if (typical_cost_ms_) {
      const auto cost = predicted(rung_, next);
      if (!cost || *cost > room) {
        clean_streak_ = 0;
        return;
      }
      while (next - 1 >= ceiling_rung_) {
        const auto above = predicted(rung_, next - 1);
        if (!above || *above > room) {
          break;
        }
        next -= 1;
      }
    }
    rung_ = next;
    clean_streak_ = 0;
    since_climb_ = 0;
  }

  const double top_;
  std::vector<double> scales_;
  int slow_rung_;
  FinishWatch finish_;
  int rung_ = 0;
  int slow_streak_ = 0;
  int clean_streak_ = 0;
  int floor_streak_ = 0;
  int hold_left_ = 0;
  std::optional<int> since_climb_;
  int ceiling_rung_ = 0;
  int ceiling_left_ = 0;
  int doublings_ = 0;
  std::optional<double> typical_cost_ms_;
  std::optional<double> fast_interval_ms_;
  bool degraded_ = false;
};

}  // namespace

std::unique_ptr<SizeLadder> make_cost_ladder(double top, double floor) {
  return std::make_unique<CostLadder>(top, floor);
}

}  // namespace feq::scene
