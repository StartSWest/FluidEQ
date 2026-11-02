/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/scene/frame_pacing.h"

#include <algorithm>
#include <cmath>

namespace feq::scene {
namespace {

/** Faster than 250 Hz or slower than 10 Hz is a measurement error. */
constexpr double kShortestMs = 4.0;
constexpr double kLongestMs = 100.0;
constexpr double kUnknownIntervalMs = 1000.0 / 60.0;
/** The share of a display frame a pace is allowed to fall short by. */
constexpr double kJitterShare = 0.25;

}  // namespace

void FrameCadence::note(double delta_ms) {
  if (!std::isfinite(delta_ms) || delta_ms <= 0.0) {
    return;
  }
  if (count_ < kWindow) {
    gaps_[count_] = delta_ms;
    count_ += 1;
  } else {
    gaps_[next_] = delta_ms;
    next_ = (next_ + 1) % kWindow;
  }
}

double FrameCadence::interval_ms() const {
  if (count_ == 0) {
    return kUnknownIntervalMs;
  }
  std::array<double, kWindow> sorted = gaps_;
  const auto end = sorted.begin() + static_cast<std::ptrdiff_t>(count_);
  std::sort(sorted.begin(), end);
  const double low = sorted[(count_ - 1) / 4];
  return std::min(kLongestMs, std::max(kShortestMs, low));
}

void FrameCadence::reset() {
  count_ = 0;
  next_ = 0;
}

double judged_interval_ms(double display_ms, std::optional<double> drawn_ms) {
  return std::min(drawn_ms.value_or(display_ms), display_ms);
}

double display_tick_ms(double now_ms, std::optional<double> last_tick_at,
                       double previous_ms) {
  if (!last_tick_at) {
    return previous_ms;
  }
  return std::min(kLongestMs, std::max(kShortestMs, now_ms - *last_tick_at));
}

bool is_frame_due(double elapsed_ms, double pace_ms, double tick_ms) {
  return pace_ms <= 0.0 || elapsed_ms >= pace_ms - tick_ms * kJitterShare;
}

bool is_silent_waveform(std::span<const double> waveform) {
  return std::all_of(waveform.begin(), waveform.end(), [](double peak) {
    return std::abs(peak) < kSilencePeak;
  });
}

bool RestWatch::frame(double now_ms, bool silent) {
  if (!silent) {
    silent_since_ms_.reset();
    resting_ = false;
  } else {
    if (!silent_since_ms_) {
      silent_since_ms_ = now_ms;
    }
    resting_ = now_ms - *silent_since_ms_ >= kRestAfterMs;
  }
  return resting_;
}

void RestWatch::reset() {
  silent_since_ms_.reset();
  resting_ = false;
}

}  // namespace feq::scene
