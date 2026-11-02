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
#include <utility>

namespace feq::scene {
namespace {

using namespace gl;

/** `glGetError` is drained this far at most: a lost context answers each. */
constexpr int kErrorsRead = 8;
/** The smallest share of the monitor a scene is drawn at (`scenePerformance.ts`). */
constexpr double kSmallestScale = 0.25;

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
  window_ = window;
  window_width_ = std::max(1, width);
  window_height_ = std::max(1, height);
  return true;
}

void DesktopPainter::set_scale(double scale) {
  scale_ = std::clamp(scale, kSmallestScale, 1.0);
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

bool DesktopPainter::paint(HeardLampFrame heard, double daylight) {
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
  const Api& gl = context_->gl();
  SceneFrame& frame = heard.frame;
  tuner_->apply(frame, heard.delta_ms, daylight_.next(daylight, heard.delta_ms));
  // `frameStepMs`: nothing on the program's first frame, then the frame's
  // own time, held to a tenth of a second.
  slow_.ease(frame.spectrum,
             slow_started_ ? std::clamp(heard.delta_ms, 0.0, 100.0) : 0.0);
  slow_started_ = true;
  frame.spectrum_slow = slow_.bytes();

  const int width =
      std::max(1, static_cast<int>(std::lround(window_width_ * scale_)));
  const int height =
      std::max(1, static_cast<int>(std::lround(window_height_ * scale_)));
  bool lost = !ensure_target(width, height);
  if (!lost) {
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
      drop();
      fail(0, wire::FailReason::kNoGuard, "the flash limiter could not run");
      return true;
    }
    // Drawn at its own resolution, scaled to the whole monitor.
    gl.BindFramebuffer(kReadFramebuffer, target_);
    gl.BindFramebuffer(kDrawFramebuffer, 0);
    gl.BlitFramebuffer(0, 0, width, height, 0, 0, window_width_, window_height_,
                       kColorBufferBit, static_cast<GLenum>(kLinear));
    gl.BindFramebuffer(kFramebuffer, 0);
    for (int read = 0; read < kErrorsRead; ++read) {
      const GLenum error = gl.GetError();
      if (error == 0) {
        break;
      }
      lost = lost || error == kContextLost;
    }
  }
  if (lost || !context_->present()) {
    // Sleep, a driver update, another program's crash: reported, and main
    // starts this monitor afresh, which builds a new context.
    drop();
    pending_.reset();
    retiring_.clear();
    release_target();
    context_.reset();
    fail(0, wire::FailReason::kLost, "the GPU was reset");
    return false;
  }
  if (told_drawn_ != drawn_id_) {
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
  context_.reset();
  window_ = nullptr;
  told_drawn_ = 0;
}

}  // namespace feq::scene
