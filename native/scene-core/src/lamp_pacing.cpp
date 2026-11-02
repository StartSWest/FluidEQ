/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/scene/lamp_pacing.h"

#include <algorithm>
#include <cmath>

#include "fluideq/scene/rhythm.h"

namespace feq::scene {
namespace {

constexpr double kLampFrameMs = 40.0;
constexpr double kRoomToGrow = 0.75;
constexpr int kLateRun = 3;
constexpr std::size_t kClimbWindow = 3;
constexpr std::size_t kSettledWindow = 30;
constexpr int kMaxRest = 1800;
constexpr double kHopelessFrameMs = 250.0;

double quartile(std::vector<double> times, double at) {
  std::sort(times.begin(), times.end());
  return times[static_cast<std::size_t>(
      std::floor(static_cast<double>(times.size() - 1) * at))];
}

std::vector<double> newest(const std::deque<double>& times,
                           std::size_t count) {
  return {times.end() - static_cast<std::ptrdiff_t>(count), times.end()};
}

}  // namespace

LampPace LampPacing::change(std::size_t next) {
  const LampPace pace = next > step_ ? LampPace::kSmaller : LampPace::kLarger;
  step_ = next;
  late_ = 0;
  times_.clear();
  warming_ = true;
  return pace;
}

LampPace LampPacing::record(double elapsed_ms) {
  const std::size_t smallest = kLampSizes.size() - 1;
  if (warming_) {
    warming_ = false;
    return LampPace::kSame;
  }
  if (step_ == smallest && elapsed_ms > kHopelessFrameMs) {
    hopeless_ += 1;
    return hopeless_ >= 2 ? LampPace::kGiveUp : LampPace::kSame;
  }
  hopeless_ = 0;
  times_.push_back(elapsed_ms);
  if (times_.size() > kSettledWindow) {
    times_.pop_front();
  }
  if (resting_ > 0) {
    resting_ -= 1;
  }
  if (elapsed_ms > kLampFrameMs) {
    late_ += 1;
    if (late_ >= kLateRun && step_ < smallest) {
      climbing_ = false;
      blocked_ = static_cast<std::ptrdiff_t>(step_);
      resting_ = rest_;
      rest_ = std::min(kMaxRest, rest_ * 2);
      return change(step_ + 1);
    }
    return LampPace::kSame;
  }
  late_ = 0;
  const std::size_t window = climbing_ ? kClimbWindow : kSettledWindow;
  if (step_ == smallest && times_.size() >= window) {
    fixed_ = quartile(newest(times_, window), 0.25);
  }
  if (step_ == 0 || times_.size() < window ||
      (static_cast<std::ptrdiff_t>(step_) - 1 == blocked_ && resting_ > 0)) {
    return LampPace::kSame;
  }
  const double drawing =
      std::max(0.0, quartile(newest(times_, window), 0.75) - fixed_);
  if (fixed_ + drawing * 4.0 < kLampFrameMs * kRoomToGrow) {
    return change(step_ - 1);
  }
  climbing_ = false;
  return LampPace::kSame;
}

void downsample_to_grid(const std::uint8_t* pixels, int width, int height,
                        std::vector<std::uint8_t>& into) {
  into.resize(static_cast<std::size_t>(kLightingGridWidth) *
              static_cast<std::size_t>(kLightingGridHeight) * 3);
  const double block_x = static_cast<double>(width) / kLightingGridWidth;
  const double block_y = static_cast<double>(height) / kLightingGridHeight;
  for (int gy = 0; gy < kLightingGridHeight; ++gy) {
    const int top = static_cast<int>(std::floor(gy * block_y));
    const int bottom =
        std::max(top + 1, static_cast<int>(std::floor((gy + 1) * block_y)));
    for (int gx = 0; gx < kLightingGridWidth; ++gx) {
      const int left = static_cast<int>(std::floor(gx * block_x));
      const int right =
          std::max(left + 1, static_cast<int>(std::floor((gx + 1) * block_x)));
      double r = 0.0;
      double g = 0.0;
      double b = 0.0;
      double total = 0.0;
      for (int py = top; py < bottom; ++py) {
        const auto row = static_cast<std::size_t>(height - 1 - py) *
                         static_cast<std::size_t>(width);
        for (int px = left; px < right; ++px) {
          const std::size_t at = (row + static_cast<std::size_t>(px)) * 4;
          const double pr = pixels[at];
          const double pg = pixels[at + 1];
          const double pb = pixels[at + 2];
          const double luma = (54.0 * pr + 183.0 * pg + 19.0 * pb) / 65025.0;
          const double weight = luma * luma + 0.0004;
          r += pr * weight;
          g += pg * weight;
          b += pb * weight;
          total += weight;
        }
      }
      const auto cell = (static_cast<std::size_t>(gy) * kLightingGridWidth +
                         static_cast<std::size_t>(gx)) *
                        3;
      into[cell] = static_cast<std::uint8_t>(js_round(r / total));
      into[cell + 1] = static_cast<std::uint8_t>(js_round(g / total));
      into[cell + 2] = static_cast<std::uint8_t>(js_round(b / total));
    }
  }
}

}  // namespace feq::scene
