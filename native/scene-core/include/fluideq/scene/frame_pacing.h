/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
#include <cstddef>
#include <optional>
#include <span>

#include "fluideq/scene/size_ladder.h"

/*
 * When a scene drawn without a page draws, on the window's own rules: how
 * fast frames are arriving (`frameCadence.ts`), when a frame held to a pace
 * is due (`framePace.ts`), and a scene resting at thirty a second once
 * nothing has played for a while (`sceneRest.ts`). Held to the TypeScript by
 * `scene_sizing_parity_test.cpp`. Nothing here has a timer: every decision is
 * made from the frames' own timestamps as they arrive.
 */

namespace feq::scene {

/**
 * How often frames are actually being drawn: the low quartile of the recent
 * gaps, because a few long gaps are a stall, not the display's beat.
 */
class FrameCadence {
 public:
  /** The gap since the last drawn frame. */
  void note(double delta_ms);
  /** The interval frames are arriving at, in milliseconds. */
  double interval_ms() const;
  void reset();

 private:
  static constexpr std::size_t kWindow = 24;
  std::array<double, kWindow> gaps_{};
  std::size_t count_ = 0;
  std::size_t next_ = 0;
};

/**
 * The interval a frame's GPU cost is judged against: the tighter of the
 * display's beat and the gap between the frames actually drawn, or a GPU
 * that is the bottleneck is judged against its own cost and always keeps up.
 */
double judged_interval_ms(double display_ms, std::optional<double> drawn_ms);

/** The display's frame, from this tick and the last one: `previous_ms` until two. */
double display_tick_ms(double now_ms, std::optional<double> last_tick_at,
                       double previous_ms);

/**
 * Whether a loop that last drew `elapsed_ms` ago, held to `pace_ms`, draws
 * now, on a display whose frames are `tick_ms` apart: once the pace less a
 * quarter of the display's own frame has gone by, so jitter never skips a
 * whole frame and every display settles on one rate.
 */
bool is_frame_due(double elapsed_ms, double pace_ms, double tick_ms);

/** Silence this long before the rate is eased: a gap between tracks is shorter. */
inline constexpr double kRestAfterMs = 10000.0;
/** The rate a resting scene is held to. */
inline constexpr double kRestPaceMs = kThirtyASecondMs;
/** A waveform peak under this (−50 dBFS) is no sound. */
inline constexpr double kSilencePeak = 0.003;

/** Whether a frame's waveform — per-bucket peaks, 0..1 — carries no sound. */
bool is_silent_waveform(std::span<const double> waveform);

/** A scene at rest: thirty a second once nothing has played for ten seconds. */
class RestWatch {
 public:
  /** One drawn frame at `now_ms`; whether the scene rests after it. */
  bool frame(double now_ms, bool silent);
  bool resting() const { return resting_; }
  void reset();

 private:
  std::optional<double> silent_since_ms_;
  bool resting_ = false;
};

}  // namespace feq::scene
