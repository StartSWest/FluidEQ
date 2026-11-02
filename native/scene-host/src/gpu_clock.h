/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <deque>
#include <vector>

#include "angle_api.h"
#include "fluideq/scene/size_ladder.h"

/*
 * What a scene's frames cost the GPU, without ever waiting for the GPU: the
 * window's clock (`src/renderer/graph/sceneGpuClock.ts`) on the C++ host.
 * Every frame is followed by a fence, and where ANGLE offers timer queries
 * (`EXT_disjoint_timer_query`, Direct3D's own timestamps) its GL work is
 * wrapped in them — the scene, then the finishing after `mark`, because the
 * size ladder decides those differently. Both are asked, on a later frame,
 * whether they have finished; never waited on.
 */

namespace feq::scene {

/** Frames that may be on the GPU at once; a third is skipped, not queued. */
inline constexpr int kFramesInFlight = 2;

class GpuClock {
 public:
  explicit GpuClock(const gl::Api& gl) : gl_(gl) {}
  ~GpuClock() = default;
  GpuClock(const GpuClock&) = delete;
  GpuClock& operator=(const GpuClock&) = delete;

  /** Whether the GPU times frames itself, or only fences say they are done. */
  bool timed() const { return gl_.GetQueryObjectui64v != nullptr; }
  /** Around one frame's GL work; `end` submits the fence. */
  void begin();
  /** The scene is drawn; what follows is finishing. */
  void mark();
  void end();
  /**
   * Retires every frame the GPU has finished, and answers the reading for
   * the frame about to be drawn: the newest finished cost, and how many
   * frames are still in flight.
   */
  CostReading poll();
  /** Every query and fence let go; on the thread whose context made them. */
  void release();

 private:
  struct InFlight {
    gl::GLsync sync = nullptr;
    gl::GLuint scene = 0;
    gl::GLuint post = 0;
  };

  gl::GLuint start_query();
  void stop_query();
  void retire(const InFlight& frame);
  bool available(gl::GLuint query) const;
  double read_ms(gl::GLuint query) const;

  const gl::Api& gl_;
  std::deque<InFlight> in_flight_;
  std::vector<gl::GLuint> spare_;
  gl::GLuint scene_ = 0;
  gl::GLuint post_ = 0;
  bool open_ = false;
};

}  // namespace feq::scene
