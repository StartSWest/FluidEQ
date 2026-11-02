/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "gpu_clock.h"

namespace feq::scene {

using namespace gl;

GLuint GpuClock::start_query() {
  if (!timed()) {
    return 0;
  }
  GLuint query = 0;
  if (spare_.empty()) {
    gl_.GenQueries(1, &query);
  } else {
    query = spare_.back();
    spare_.pop_back();
  }
  if (query != 0) {
    gl_.BeginQuery(kTimeElapsed, query);
    open_ = true;
  }
  return query;
}

void GpuClock::stop_query() {
  if (open_) {
    gl_.EndQuery(kTimeElapsed);
    open_ = false;
  }
}

void GpuClock::retire(const InFlight& frame) {
  gl_.DeleteSync(frame.sync);
  for (const GLuint query : {frame.scene, frame.post}) {
    if (query != 0) {
      spare_.push_back(query);
    }
  }
}

bool GpuClock::available(GLuint query) const {
  if (query == 0) {
    return true;
  }
  GLuint ready = 0;
  gl_.GetQueryObjectuiv(query, kQueryResultAvailable, &ready);
  return ready != 0;
}

double GpuClock::read_ms(GLuint query) const {
  if (query == 0) {
    return 0.0;
  }
  GLuint64 nanoseconds = 0;
  gl_.GetQueryObjectui64v(query, kQueryResult, &nanoseconds);
  return static_cast<double>(nanoseconds) / 1e6;
}

void GpuClock::begin() {
  scene_ = start_query();
  post_ = 0;
}

void GpuClock::mark() {
  stop_query();
  post_ = start_query();
}

void GpuClock::end() {
  stop_query();
  const GLsync sync = gl_.FenceSync(kSyncGpuCommandsComplete, 0);
  // Queued behind the frame; flushed, or the driver may hold the whole
  // frame back until its buffer fills.
  gl_.Flush();
  if (sync != nullptr) {
    in_flight_.push_back({sync, scene_, post_});
  } else {
    for (const GLuint query : {scene_, post_}) {
      if (query != 0) {
        spare_.push_back(query);
      }
    }
  }
  scene_ = 0;
  post_ = 0;
}

CostReading GpuClock::poll() {
  CostReading reading;
  // A disturbed clock makes every pending answer meaningless, and reading
  // the flag clears it, so it is read once per poll, first.
  bool disjoint = false;
  if (timed()) {
    GLint flag = 0;
    gl_.GetIntegerv(kGpuDisjoint, &flag);
    disjoint = flag != 0;
  }
  while (!in_flight_.empty()) {
    const InFlight oldest = in_flight_.front();
    GLint status = 0;
    gl_.GetSynciv(oldest.sync, kSyncStatus, 1, nullptr, &status);
    if (status != kSignaled) {
      break;
    }
    // Finished on the GPU, but its answers may not be readable yet: kept,
    // and asked again on the next poll.
    if (!available(oldest.scene) || !available(oldest.post)) {
      break;
    }
    if (!disjoint && oldest.scene != 0) {
      const double scene_ms = read_ms(oldest.scene);
      if (oldest.post != 0) {
        const double post_ms = read_ms(oldest.post);
        reading.cost_ms = scene_ms + post_ms;
        reading.post_ms = post_ms;
      } else {
        reading.cost_ms = scene_ms;
        reading.post_ms.reset();
      }
    }
    in_flight_.pop_front();
    retire(oldest);
  }
  reading.behind = static_cast<int>(in_flight_.size());
  return reading;
}

void GpuClock::release() {
  stop_query();
  for (const InFlight& frame : in_flight_) {
    retire(frame);
  }
  in_flight_.clear();
  for (const GLuint query : {scene_, post_}) {
    if (query != 0) {
      spare_.push_back(query);
    }
  }
  scene_ = 0;
  post_ = 0;
  if (!spare_.empty()) {
    gl_.DeleteQueries(static_cast<GLsizei>(spare_.size()), spare_.data());
  }
  spare_.clear();
}

}  // namespace feq::scene
