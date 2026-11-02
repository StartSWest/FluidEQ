/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "lamp_painter.h"

#include <algorithm>
#include <chrono>
#include <utility>

namespace feq::scene {
namespace {

using namespace gl;

/**
 * `BLAMED_FRAME_MS`: a frame this long is the scene holding the GPU, and a
 * context lost right after one is the scene's doing.
 */
constexpr double kBlamedFrameMs = 500.0;
/** The page's preview is never wider than this: it is a swatch on a card. */
constexpr int kPreviewWidth = 192;
/** `glGetError` is drained this far at most: a lost context answers each. */
constexpr int kErrorsRead = 8;

double elapsed_ms(std::chrono::steady_clock::time_point since) {
  return std::chrono::duration<double, std::milli>(
             std::chrono::steady_clock::now() - since)
      .count();
}

}  // namespace

LampPainter::LampPainter(std::wstring angle_dir, Output output)
    : angle_dir_(std::move(angle_dir)), output_(std::move(output)) {}

LampPainter::~LampPainter() { close(); }

void LampPainter::close() {
  // Every GL object goes before the context it lives in.
  drop();
  pending_.reset();
  retiring_.clear();
  context_.reset();
}

bool LampPainter::links_in_parallel() const {
  return context_ != nullptr && context_->gl().MaxShaderCompilerThreads != nullptr;
}

bool LampPainter::ensure_context(std::string& why) {
  if (context_) {
    return true;
  }
  const auto& [width, height] = pacing_.size();
  context_.reset(gl::Context::create(angle_dir_, width, height, why));
  if (!context_) {
    return false;
  }
  surface_width_ = width;
  surface_height_ = height;
  return true;
}

void LampPainter::fail(std::uint32_t id, wire::FailReason reason,
                       const std::string& words) {
  failed_.store(true, std::memory_order_release);
  if (output_.failed) {
    output_.failed(id, reason, words);
  }
}

void LampPainter::drop() {
  program_.reset();
  guard_.reset();
  tuner_.reset();
  drawn_id_ = 0;
}

void LampPainter::load(LampScene scene) {
  wanted_id_ = scene.id;
  if (pending_) {
    // Given up on, never waited for: freed once ANGLE has finished it.
    retiring_.push_back(std::move(pending_->link));
    pending_.reset();
  }
  std::string why;
  if (!ensure_context(why)) {
    drop();
    fail(scene.id, wire::FailReason::kNoContext, why);
    return;
  }
  std::unique_ptr<FlashGuard> guard;
  if (scene.guarded) {
    guard = FlashGuard::create(context_->gl(), why);
    if (!guard) {
      // No limiter, no member's scene on the lamps: the swatch instead.
      drop();
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

void LampPainter::unload() {
  wanted_id_ = 0;
  if (pending_) {
    retiring_.push_back(std::move(pending_->link));
    pending_.reset();
  }
  drop();
  failed_.store(true, std::memory_order_release);
}

void LampPainter::settle() {
  std::erase_if(retiring_, [](const std::unique_ptr<SceneLink>& link) {
    return link->done();
  });
  if (pending_ && pending_->link->done()) {
    finish_link();
  }
}

void LampPainter::finish_link() {
  if (!pending_) {
    return;
  }
  Pending next = std::move(*pending_);
  pending_.reset();
  std::string log;
  auto program = next.link->finish(log);
  next.link.reset();
  if (!program) {
    drop();
    fail(next.id, wire::FailReason::kCompile, log);
    return;
  }
  drop();
  program_ = std::move(program);
  guard_ = std::move(next.guard);
  tuner_.emplace(next.response, std::move(next.params));
  slow_ = {};
  slow_started_ = false;
  // A program of its own costs what it costs: the size is found afresh.
  pacing_ = {};
  drawn_id_ = next.id;
  failed_.store(false, std::memory_order_release);
  if (output_.loaded) {
    output_.loaded(next.id);
  }
}

void LampPainter::lose_context(bool blamed) {
  // Lost while its own frame held the GPU: the reset was the scene's, and
  // main keeps it off the lamps for the session. Any other loss — sleep, a
  // driver update, another program's crash — is reported as one, and main
  // asks for the scene again, which builds a new context.
  drop();
  pending_.reset();
  retiring_.clear();
  context_.reset();
  wanted_id_ = 0;
  fail(0, blamed ? wire::FailReason::kGpuReset : wire::FailReason::kLost,
       blamed ? "the scene's frame held the GPU until Windows reset it"
              : "the GPU was reset");
}

void LampPainter::paint(HeardLampFrame heard, double daylight) {
  if (!program_ || !context_ || !tuner_) {
    return;
  }
  const Api& gl = context_->gl();
  SceneFrame& frame = heard.frame;
  // The clock the frame was heard at, as the window reports it: the scene's
  // response may move what it draws, never when.
  const double heard_at = frame.time_seconds;
  tuner_->apply(frame, heard.delta_ms, daylight_.next(daylight, heard.delta_ms));
  // `frameStepMs`: nothing on the program's first frame, then the frame's
  // own time, held to a tenth of a second.
  slow_.ease(frame.spectrum,
             slow_started_ ? std::clamp(heard.delta_ms, 0.0, 100.0) : 0.0);
  slow_started_ = true;
  frame.spectrum_slow = slow_.bytes();

  const auto& [width, height] = pacing_.size();
  if (width != surface_width_ || height != surface_height_) {
    if (!context_->resize(width, height)) {
      lose_context(false);
      return;
    }
    surface_width_ = width;
    surface_height_ = height;
  }
  const auto started = std::chrono::steady_clock::now();
  if (guard_) {
    guard_->begin(width, height);
  } else {
    gl.BindFramebuffer(kFramebuffer, 0);
  }
  program_->draw(frame, width, height);
  // A guard that cannot limit the frame is a guard that is not there: the
  // swatch, never a stranger's scene on the lamps in the room.
  if (guard_ && !guard_->end(heard.delta_ms, 0)) {
    drop();
    fail(0, wire::FailReason::kNoGuard, "the flash limiter could not run");
    return;
  }
  // One pixel back waits for the GPU to finish this frame, so the time is
  // the GPU's, and each frame reaches it as its own job.
  gl.ReadPixels(0, 0, 1, 1, kRgba, kUnsignedByte, pixel_.data());
  const double cost = elapsed_ms(started);
  bool lost = false;
  for (int read = 0; read < kErrorsRead; ++read) {
    const GLenum error = gl.GetError();
    if (error == 0) {
      break;
    }
    lost = lost || error == kContextLost;
  }
  if (lost) {
    lose_context(cost > kBlamedFrameMs && drawn_id_ == wanted_id_);
    return;
  }
  if (pacing_.record(cost) == LampPace::kGiveUp) {
    // Holding the GPU even at the smallest size, frame after frame: the
    // lamps take the scene's colours, and main does not hand this scene
    // back this session.
    drop();
    fail(0, wire::FailReason::kTooHeavy, "too heavy at the smallest size");
    return;
  }
  pixels_.resize(static_cast<std::size_t>(width) *
                 static_cast<std::size_t>(height) * 4);
  gl.ReadPixels(0, 0, width, height, kRgba, kUnsignedByte, pixels_.data());
  PaintedGrid grid;
  downsample_to_grid(pixels_.data(), width, height, grid.rgb);
  // What the scene answered to, after its own response: the lamps move with
  // the music the picture moved with.
  grid.level = frame.level;
  grid.beat = frame.beat;
  grid.bands = frame.bands;
  grid.delta_ms = heard.delta_ms;
  grid.time_seconds = heard_at;
  grid.activity = heard.activity;
  if (preview_wanted_) {
    make_preview(pixels_, width, height, grid);
  }
  if (output_.painted) {
    output_.painted(grid);
  }
}

void LampPainter::make_preview(const std::vector<std::uint8_t>& pixels,
                               int width, int height, PaintedGrid& grid) {
  // Every lamp size is a whole multiple of the preview's, or under it.
  const int step = std::max(1, width / kPreviewWidth);
  const int out_width = width / step;
  const int out_height = height / step;
  grid.preview_width = out_width;
  grid.preview_height = out_height;
  grid.preview.assign(static_cast<std::size_t>(out_width) *
                          static_cast<std::size_t>(out_height) * 3,
                      0);
  const auto area = static_cast<unsigned>(step * step);
  for (int y = 0; y < out_height; ++y) {
    for (int x = 0; x < out_width; ++x) {
      std::array<unsigned, 3> sum{};
      for (int dy = 0; dy < step; ++dy) {
        // Read bottom row first; the preview is top row first.
        const auto row = static_cast<std::size_t>(height - 1 - (y * step + dy));
        for (int dx = 0; dx < step; ++dx) {
          const std::size_t at =
              (row * static_cast<std::size_t>(width) +
               static_cast<std::size_t>(x * step + dx)) *
              4;
          sum[0] += pixels[at];
          sum[1] += pixels[at + 1];
          sum[2] += pixels[at + 2];
        }
      }
      const std::size_t out = (static_cast<std::size_t>(y) *
                                   static_cast<std::size_t>(out_width) +
                               static_cast<std::size_t>(x)) *
                              3;
      for (std::size_t channel = 0; channel < 3; ++channel) {
        grid.preview[out + channel] =
            static_cast<std::uint8_t>((sum[channel] + area / 2) / area);
      }
    }
  }
}

}  // namespace feq::scene
