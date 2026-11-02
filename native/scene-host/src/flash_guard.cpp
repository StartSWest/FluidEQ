/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "flash_guard.h"

#include <algorithm>
#include <cmath>
#include <cstring>

#include "flash_guard_sources.h"

namespace feq::scene {
namespace {

using namespace gl;

/** `sceneFlashGuard.ts`'s small functions, from the numbers it exports. */
double clamp_frame(double delta_ms) {
  return std::max(0.0, std::min(flash::kMaxFrameMs, delta_ms));
}
double travel_decay(double delta_ms) {
  return std::exp(-clamp_frame(delta_ms) / 1000.0 / flash::kTravelSeconds);
}
double flashing_decay(double delta_ms) {
  return std::exp(-clamp_frame(delta_ms) / 1000.0 / flash::kFlashingMemoryS);
}
double allowance(double delta_ms) {
  return (flash::kLimitPerSecond * clamp_frame(delta_ms)) / 1000.0;
}
double calm_lod(int width, int height) {
  return std::max(0.0, std::log2(static_cast<double>(std::max(width, height)) /
                                 flash::kCalmTexels));
}
double area_lod(int width, int height) {
  return std::max(0.0, std::log2(static_cast<double>(std::max(width, height)) /
                                 (flash::kAreaWindow * 4.0)));
}

GLuint link(const Api& gl, const char* fragment) {
  const auto compile = [&gl](GLenum kind, const char* source) {
    const GLuint shader = gl.CreateShader(kind);
    gl.ShaderSource(shader, 1, &source, nullptr);
    gl.CompileShader(shader);
    GLint ok = 0;
    gl.GetShaderiv(shader, kCompileStatus, &ok);
    if (ok == 0) {
      gl.DeleteShader(shader);
      return GLuint{0};
    }
    return shader;
  };
  const GLuint vertex = compile(kVertexShader, flash::kVertexSource);
  const GLuint pixels = compile(kFragmentShader, fragment);
  if (vertex == 0 || pixels == 0) {
    gl.DeleteShader(vertex);
    gl.DeleteShader(pixels);
    return 0;
  }
  const GLuint program = gl.CreateProgram();
  gl.AttachShader(program, vertex);
  gl.AttachShader(program, pixels);
  gl.LinkProgram(program);
  gl.DeleteShader(vertex);
  gl.DeleteShader(pixels);
  GLint linked = 0;
  gl.GetProgramiv(program, kLinkStatus, &linked);
  if (linked == 0) {
    gl.DeleteProgram(program);
    return 0;
  }
  return program;
}

bool has_extension(const Api& gl, const char* name) {
  const auto* list = reinterpret_cast<const char*>(gl.GetString(kExtensions));
  return list != nullptr && std::strstr(list, name) != nullptr;
}

}  // namespace

std::unique_ptr<FlashGuard> FlashGuard::create(const gl::Api& api,
                                               std::string& why) {
  // The pressure and the calm copy are half floats, as in the window.
  if (!has_extension(api, "GL_EXT_color_buffer_float") &&
      !has_extension(api, "GL_EXT_color_buffer_half_float")) {
    why = "half-float render targets are not available";
    return nullptr;
  }
  auto guard = std::unique_ptr<FlashGuard>(new FlashGuard(api));
  guard->composite_ = link(api, flash::kCompositeSource);
  guard->state_ = link(api, flash::kStateSource);
  guard->calm_program_ = link(api, flash::kCalmSource);
  if (guard->composite_ == 0 || guard->state_ == 0 ||
      guard->calm_program_ == 0) {
    why = "the flash limiter's programs did not link";
    return nullptr;
  }
  api.GenVertexArrays(1, &guard->vao_);
  const auto at = [&api](GLuint program, const char* name) {
    return api.GetUniformLocation(program, name);
  };
  guard->composite_at_ = {at(guard->composite_, "uCurrent"),
                          at(guard->composite_, "uCalm"),
                          at(guard->composite_, "uState"),
                          at(guard->composite_, "uAreaLod")};
  guard->state_at_ = {at(guard->state_, "uCurrent"),
                      at(guard->state_, "uLastFrame"),
                      at(guard->state_, "uState"),
                      at(guard->state_, "uDecay"),
                      at(guard->state_, "uElapsed"),
                      at(guard->state_, "uFlashDecay")};
  guard->calm_at_ = {at(guard->calm_program_, "uCurrent"),
                     at(guard->calm_program_, "uCalm"),
                     at(guard->calm_program_, "uLod"),
                     at(guard->calm_program_, "uAllowance"),
                     at(guard->calm_program_, "uFirst")};
  return guard;
}

std::optional<FlashGuard::Target> FlashGuard::make_target(
    int width, int height, bool mipmapped, bool precise,
    const std::array<float, 4>& clear) {
  const Api& gl = gl_;
  Target target{0, 0, width, height};
  gl.GenTextures(1, &target.texture);
  gl.GenFramebuffers(1, &target.framebuffer);
  if (target.texture == 0 || target.framebuffer == 0) {
    release(target);
    return std::nullopt;
  }
  gl.BindTexture(kTexture2D, target.texture);
  gl.TexImage2D(kTexture2D, 0,
                static_cast<GLint>(precise ? kRgba16f : kRgba8), width, height,
                0, kRgba, precise ? kHalfFloat : kUnsignedByte, nullptr);
  gl.TexParameteri(kTexture2D, kTextureMinFilter,
                   mipmapped ? kLinearMipmapLinear : kLinear);
  gl.TexParameteri(kTexture2D, kTextureMagFilter, kLinear);
  gl.TexParameteri(kTexture2D, kTextureWrapS, kClampToEdge);
  gl.TexParameteri(kTexture2D, kTextureWrapT, kClampToEdge);
  gl.BindFramebuffer(kFramebuffer, target.framebuffer);
  gl.FramebufferTexture2D(kFramebuffer, kColorAttachment0, kTexture2D,
                          target.texture, 0);
  if (gl.CheckFramebufferStatus(kFramebuffer) != kFramebufferComplete) {
    release(target);
    return std::nullopt;
  }
  gl.ClearColor(clear[0], clear[1], clear[2], clear[3]);
  gl.Clear(kColorBufferBit);
  if (mipmapped) {
    gl.GenerateMipmap(kTexture2D);
  }
  return target;
}

std::optional<FlashGuard::Pair> FlashGuard::make_pair(
    int width, int height, bool mipmapped, bool precise,
    const std::array<float, 4>& clear) {
  auto a = make_target(width, height, mipmapped, precise, clear);
  auto b = make_target(width, height, mipmapped, precise, clear);
  if (a && b) {
    return Pair{*a, *b};
  }
  if (a) {
    release(*a);
  }
  if (b) {
    release(*b);
  }
  return std::nullopt;
}

void FlashGuard::release(const Target& target) {
  gl_.DeleteFramebuffers(1, &target.framebuffer);
  gl_.DeleteTextures(1, &target.texture);
}

void FlashGuard::release(const std::optional<Pair>& pair) {
  if (pair) {
    release((*pair)[0]);
    release((*pair)[1]);
  }
}

void FlashGuard::carry(const Target& from, const Target& to, bool mipmapped) {
  const Api& gl = gl_;
  gl.BindFramebuffer(kReadFramebuffer, from.framebuffer);
  gl.BindFramebuffer(kDrawFramebuffer, to.framebuffer);
  gl.BlitFramebuffer(0, 0, from.width, from.height, 0, 0, to.width, to.height,
                     kColorBufferBit, static_cast<GLenum>(kLinear));
  if (mipmapped) {
    gl.BindTexture(kTexture2D, to.texture);
    gl.GenerateMipmap(kTexture2D);
  }
}

void FlashGuard::resize(int width, int height) {
  auto old_frames = std::move(frames_);
  auto old_pressure = std::move(pressure_);
  const std::size_t old_drawn = drawn_;
  const std::size_t old_pressure_latest = pressure_latest_;
  width_ = width;
  height_ = height;
  frames_ = make_pair(width, height, true, false);
  pressure_ = make_pair(std::max(1, (width + 1) / 2),
                        std::max(1, (height + 1) / 2), true, true,
                        {static_cast<float>(flash::kRestSinceTurn), 0.5F,
                         static_cast<float>(flash::kRestFlashing), 0.0F});
  if (!calm_) {
    calm_ = make_pair(static_cast<int>(flash::kCalmTexels),
                      static_cast<int>(flash::kCalmTexels), false, true);
  }
  if (has_frame_ && old_frames && frames_) {
    carry((*old_frames)[old_drawn], (*frames_)[drawn_], true);
  } else {
    has_frame_ = false;
  }
  if (old_pressure && pressure_) {
    carry((*old_pressure)[old_pressure_latest],
          (*pressure_)[pressure_latest_], true);
  }
  release(old_frames);
  release(old_pressure);
  gl_.BindFramebuffer(kFramebuffer, 0);
}

void FlashGuard::update_pressure(const Target& current, const Target& last,
                                 double delta_ms) {
  const Api& gl = gl_;
  const Target& before = (*pressure_)[pressure_latest_];
  const Target& after = (*pressure_)[1 - pressure_latest_];
  gl.ActiveTexture(kTexture0);
  gl.BindTexture(kTexture2D, current.texture);
  gl.ActiveTexture(kTexture0 + 1);
  gl.BindTexture(kTexture2D, last.texture);
  gl.ActiveTexture(kTexture0 + 2);
  gl.BindTexture(kTexture2D, before.texture);
  gl.BindFramebuffer(kFramebuffer, after.framebuffer);
  gl.Viewport(0, 0, after.width, after.height);
  gl.UseProgram(state_);
  gl.BindVertexArray(vao_);
  gl.Uniform1i(state_at_.current, 0);
  gl.Uniform1i(state_at_.last_frame, 1);
  gl.Uniform1i(state_at_.state, 2);
  gl.Uniform1f(state_at_.decay, static_cast<GLfloat>(travel_decay(delta_ms)));
  gl.Uniform1f(state_at_.elapsed,
               static_cast<GLfloat>(clamp_frame(delta_ms) / 1000.0));
  gl.Uniform1f(state_at_.flash_decay,
               static_cast<GLfloat>(flashing_decay(delta_ms)));
  gl.DrawArrays(kTriangles, 0, 3);
  gl.BindTexture(kTexture2D, after.texture);
  gl.GenerateMipmap(kTexture2D);
  pressure_latest_ = 1 - pressure_latest_;
}

void FlashGuard::update_calm(const Target& current, double delta_ms) {
  const Api& gl = gl_;
  const Target& before = (*calm_)[calm_latest_];
  const Target& after = (*calm_)[1 - calm_latest_];
  gl.ActiveTexture(kTexture0);
  gl.BindTexture(kTexture2D, current.texture);
  gl.ActiveTexture(kTexture0 + 1);
  gl.BindTexture(kTexture2D, before.texture);
  gl.BindFramebuffer(kFramebuffer, after.framebuffer);
  gl.Viewport(0, 0, after.width, after.height);
  gl.UseProgram(calm_program_);
  gl.BindVertexArray(vao_);
  gl.Uniform1i(calm_at_.current, 0);
  gl.Uniform1i(calm_at_.calm, 1);
  gl.Uniform1f(calm_at_.lod, static_cast<GLfloat>(calm_lod(width_, height_)));
  gl.Uniform1f(calm_at_.allowance, static_cast<GLfloat>(allowance(delta_ms)));
  gl.Uniform1f(calm_at_.first, has_calm_ ? 0.0F : 1.0F);
  gl.DrawArrays(kTriangles, 0, 3);
  calm_latest_ = 1 - calm_latest_;
  has_calm_ = true;
}

void FlashGuard::begin(int width, int height) {
  if (width != width_ || height != height_ || !frames_) {
    resize(width, height);
  }
  if (frames_) {
    gl_.BindFramebuffer(kFramebuffer, (*frames_)[1 - drawn_].framebuffer);
  }
}

bool FlashGuard::end(double delta_ms, gl::GLuint destination) {
  if (!frames_ || !pressure_ || !calm_) {
    return false;
  }
  const Api& gl = gl_;
  const Target& current = (*frames_)[1 - drawn_];
  const Target& last = (*frames_)[drawn_];
  gl.ActiveTexture(kTexture0);
  gl.BindTexture(kTexture2D, current.texture);
  gl.GenerateMipmap(kTexture2D);
  if (has_frame_) {
    update_pressure(current, last, delta_ms);
  }
  update_calm(current, delta_ms);
  gl.ActiveTexture(kTexture0);
  gl.BindTexture(kTexture2D, current.texture);
  gl.ActiveTexture(kTexture0 + 1);
  gl.BindTexture(kTexture2D, (*calm_)[calm_latest_].texture);
  gl.ActiveTexture(kTexture0 + 2);
  gl.BindTexture(kTexture2D, (*pressure_)[pressure_latest_].texture);
  gl.BindFramebuffer(kFramebuffer, destination);
  gl.Viewport(0, 0, width_, height_);
  gl.UseProgram(composite_);
  gl.BindVertexArray(vao_);
  gl.Uniform1i(composite_at_.current, 0);
  gl.Uniform1i(composite_at_.calm, 1);
  gl.Uniform1i(composite_at_.state, 2);
  gl.Uniform1f(composite_at_.area_lod,
               static_cast<GLfloat>(area_lod(width_, height_)));
  gl.DrawArrays(kTriangles, 0, 3);
  gl.BindFramebuffer(kFramebuffer, 0);
  gl.ActiveTexture(kTexture0);
  drawn_ = 1 - drawn_;
  has_frame_ = true;
  return true;
}

FlashGuard::~FlashGuard() {
  release(frames_);
  release(pressure_);
  release(calm_);
  gl_.DeleteVertexArrays(1, &vao_);
  gl_.DeleteProgram(composite_);
  gl_.DeleteProgram(state_);
  gl_.DeleteProgram(calm_program_);
}

}  // namespace feq::scene
