/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "desktop_painter.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <Windows.h>

#include <algorithm>
#include <cmath>
#include <functional>
#include <string_view>
#include <utility>

namespace feq::scene {
namespace {

using namespace gl;

/** `glGetError` is drained this far at most: a lost context answers each. */
constexpr int kErrorsRead = 8;

/** A program by its sources: what a size it proves is remembered under. */
std::size_t program_of(const ScenePack& pack) {
  const std::hash<std::string_view> hash;
  return hash(pack.vertex_source) ^ (hash(pack.fragment_source) << 1U);
}

}  // namespace

DesktopPainter::DesktopPainter(std::wstring angle_dir, Output output)
    : angle_dir_(std::move(angle_dir)), output_(std::move(output)) {}

DesktopPainter::~DesktopPainter() { close(); }

bool DesktopPainter::open(void* window, int width, int height,
                          std::string& why) {
  close();
  std::unique_ptr<gl::Context> context(
      gl::Context::create(angle_dir_, 1, 1, why));
  if (!context) {
    return false;
  }
  if (!context->draw_into(window)) {
    why = "the monitor's window could not be drawn into";
    return false;
  }
  context_ = std::move(context);
  clock_ = std::make_unique<GpuClock>(context_->gl());
  std::string unfinished;
  // Without the finishing passes a scene is still drawn: stretched, as the
  // page's canvas was when its own passes would not link.
  finish_ = SceneFinish::create(context_->gl(), unfinished);
  window_ = window;
  window_width_ = std::max(1, width);
  window_height_ = std::max(1, height);
  return true;
}

void DesktopPainter::fail(std::uint32_t id, wire::FailReason reason,
                          const std::string& words) {
  if (output_.failed) {
    output_.failed(id, reason, words);
  }
}

void DesktopPainter::drop() {
  program_.reset();
  guard_.reset();
  tuner_.reset();
  drawn_id_ = 0;
}

void DesktopPainter::load(DesktopScene scene) {
  if (pending_) {
    // Given up on, never waited for: freed once ANGLE has finished it.
    retiring_.push_back(std::move(pending_->link));
    pending_.reset();
  }
  if (!context_) {
    fail(scene.id, wire::FailReason::kNoContext, "no monitor to draw on");
    return;
  }
  std::string why;
  std::unique_ptr<FlashGuard> guard;
  if (scene.guarded) {
    guard = FlashGuard::create(context_->gl(), why);
    if (!guard) {
      // No limiter, no member's scene on the desktop.
      fail(scene.id, wire::FailReason::kNoGuard, why);
      return;
    }
  }
  Pending next;
  next.id = scene.id;
  next.measured = scene.measured;
  next.program = program_of(scene.pack);
  next.response = scene.response;
  next.params = std::move(scene.params);
  next.guard = std::move(guard);
  next.link = SceneProgram::start(context_->gl(), std::move(scene.pack));
  pending_ = std::move(next);
}

void DesktopPainter::settle() {
  std::erase_if(retiring_, [](const std::unique_ptr<SceneLink>& link) {
    return link->done();
  });
  if (pending_ && pending_->link->done()) {
    finish_link();
  }
}

void DesktopPainter::finish_link() {
  if (!pending_) {
    return;
  }
  Pending next = std::move(*pending_);
  pending_.reset();
  std::string log;
  auto program = next.link->finish(log);
  next.link.reset();
  if (!program) {
    // The scene on the monitor stays: a newer one that does not compile is
    // no reason to blank the desktop.
    fail(next.id, wire::FailReason::kCompile, log);
    return;
  }
  drop();
  program_ = std::move(program);
  guard_ = std::move(next.guard);
  tuner_.emplace(next.response, std::move(next.params));
  sizing_.start(next.program, next.measured);
  slow_ = {};
  slow_started_ = false;
  drawn_id_ = next.id;
  if (output_.loaded) {
    output_.loaded(next.id);
  }
}

bool DesktopPainter::frame_pixel(int x, int y,
                                 std::array<std::uint8_t, 4>& rgba) const {
  if (!context_ || target_ == 0 || x < 0 || y < 0 || x >= target_width_ ||
      y >= target_height_) {
    return false;
  }
  const Api& gl = context_->gl();
  gl.BindFramebuffer(kFramebuffer, target_);
  gl.ReadPixels(x, y, 1, 1, kRgba, kUnsignedByte, rgba.data());
  gl.BindFramebuffer(kFramebuffer, 0);
  return true;
}

bool DesktopPainter::ensure_target(int width, int height) {
  if (target_ != 0 && width == target_width_ && height == target_height_) {
    return true;
  }
  release_target();
  const Api& gl = context_->gl();
  gl.GenTextures(1, &target_texture_);
  gl.BindTexture(kTexture2D, target_texture_);
  gl.TexImage2D(kTexture2D, 0, static_cast<GLint>(kRgba8), width, height, 0,
                kRgba, kUnsignedByte, nullptr);
  gl.TexParameteri(kTexture2D, kTextureMinFilter, kLinear);
  gl.TexParameteri(kTexture2D, kTextureMagFilter, kLinear);
  gl.TexParameteri(kTexture2D, kTextureWrapS, kClampToEdge);
  gl.TexParameteri(kTexture2D, kTextureWrapT, kClampToEdge);
  gl.GenFramebuffers(1, &target_);
  gl.BindFramebuffer(kFramebuffer, target_);
  gl.FramebufferTexture2D(kFramebuffer, kColorAttachment0, kTexture2D,
                          target_texture_, 0);
  const bool complete = gl.CheckFramebufferStatus(kFramebuffer) == kFramebufferComplete;
  gl.BindFramebuffer(kFramebuffer, 0);
  if (!complete) {
    release_target();
    return false;
  }
  target_width_ = width;
  target_height_ = height;
  return true;
}

void DesktopPainter::release_target() {
  if (!context_) {
    target_ = 0;
    target_texture_ = 0;
    return;
  }
  const Api& gl = context_->gl();
  if (target_ != 0) {
    gl.DeleteFramebuffers(1, &target_);
    target_ = 0;
  }
  if (target_texture_ != 0) {
    gl.DeleteTextures(1, &target_texture_);
    target_texture_ = 0;
  }
  target_width_ = 0;
  target_height_ = 0;
}

bool DesktopPainter::lose() {
  // Sleep, a driver update, another program's crash: reported, and main
  // starts this monitor afresh, which builds a new context.
  drop();
  pending_.reset();
  retiring_.clear();
  release_target();
  finish_.reset();
  clock_.reset();
  context_.reset();
  fail(0, wire::FailReason::kLost, "the GPU was reset");
  return false;
}

bool DesktopPainter::paint(HeardLampFrame heard, double daylight,
                           double now_ms) {
  if (!context_) {
    return false;
  }
  if (!program_ || !tuner_) {
    return true;
  }
  // The desktop helper stretches the window over the whole monitor once it
  // is placed, so its size is read where it is drawn, every frame.
  RECT client{};
  if (window_ != nullptr &&
      GetClientRect(static_cast<HWND>(window_), &client) != FALSE &&
      client.right > 0 && client.bottom > 0) {
    window_width_ = client.right;
    window_height_ = client.bottom;
  }
  // The music moves on whether or not this frame reaches the monitor, as the
  // page's does when its worker skips one.
  SceneFrame& frame = heard.frame;
  tuner_->apply(frame, heard.delta_ms, daylight_.next(daylight, heard.delta_ms));
  // `frameStepMs`: nothing on the program's first frame, then the frame's
  // own time, held to a tenth of a second.
  slow_.ease(frame.spectrum,
             slow_started_ ? std::clamp(heard.delta_ms, 0.0, 100.0) : 0.0);
  slow_started_ = true;
  frame.spectrum_slow = slow_.bytes();

  const CostReading reading = clock_->poll();
  // Two frames still on the GPU: a third is skipped, never queued — a queue
  // is latency, and the picture would lag the music.
  const bool draws = reading.behind < kFramesInFlight;
  const FramePlan plan =
      sizing_.plan({std::max(1, window_width_), std::max(1, window_height_)});
  if (draws) {
    const Api& gl = context_->gl();
    const int width = plan.drawn.width;
    const int height = plan.drawn.height;
    if (!ensure_target(width, height)) {
      return lose();
    }
    clock_->begin();
    if (guard_) {
      guard_->begin(width, height);
    } else {
      gl.BindFramebuffer(kFramebuffer, target_);
      gl.Viewport(0, 0, width, height);
    }
    program_->draw(frame, width, height);
    // A guard that cannot limit the frame is a guard that is not there: a
    // stranger's scene is never on the desktop unlimited.
    if (guard_ && !guard_->end(heard.delta_ms, target_)) {
      clock_->end();
      drop();
      fail(0, wire::FailReason::kNoGuard, "the flash limiter could not run");
      return true;
    }
    clock_->mark();
    const DrawSize window{window_width_, window_height_};
    const bool finished =
        finish_ != nullptr &&
        finish_->present({target_texture_, target_, plan.drawn}, plan.canvas,
                         window, plan.steps);
    if (!finished) {
      // No passes here, or none could be made: the picture stretched.
      gl.BindFramebuffer(kReadFramebuffer, target_);
      gl.BindFramebuffer(kDrawFramebuffer, 0);
      gl.BlitFramebuffer(0, 0, width, height, 0, 0, window_width_,
                         window_height_, kColorBufferBit,
                         static_cast<GLenum>(kLinear));
      gl.BindFramebuffer(kFramebuffer, 0);
    }
    clock_->end();
    bool lost = false;
    for (int read = 0; read < kErrorsRead; ++read) {
      const GLenum error = gl.GetError();
      if (error == 0) {
        break;
      }
      lost = lost || error == kContextLost;
    }
    if (lost || !context_->present()) {
      return lose();
    }
  }
  if (sizing_.judged(reading, now_ms, draws, heard.quiet)) {
    // Too slow even at the smallest size the listener allows: handed over,
    // as the page hands its scene over, rather than a slide show.
    drop();
    fail(0, wire::FailReason::kTooHeavy,
         "the scene ran too slowly even at its smallest size");
    return true;
  }
  if (draws && told_drawn_ != drawn_id_) {
    told_drawn_ = drawn_id_;
    if (output_.drawn) {
      output_.drawn(drawn_id_);
    }
  }
  return true;
}

void DesktopPainter::close() {
  // Every GL object goes before the context it lives in.
  drop();
  pending_.reset();
  retiring_.clear();
  release_target();
  if (finish_) {
    finish_->release();
    finish_.reset();
  }
  if (clock_) {
    clock_->release();
    clock_.reset();
  }
  context_.reset();
  window_ = nullptr;
  told_drawn_ = 0;
}

}  // namespace feq::scene
