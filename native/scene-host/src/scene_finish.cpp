/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "scene_finish.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <utility>
#include <vector>

#include "scene_finish_sources.h"

namespace feq::scene {
namespace {

using namespace gl;

GLuint compile(const Api& gl, GLenum kind, const char* source,
               std::string& why) {
  const GLuint shader = gl.CreateShader(kind);
  gl.ShaderSource(shader, 1, &source, nullptr);
  gl.CompileShader(shader);
  GLint compiled = 0;
  gl.GetShaderiv(shader, kCompileStatus, &compiled);
  if (compiled == 0) {
    GLint length = 0;
    gl.GetShaderiv(shader, kInfoLogLength, &length);
    std::vector<GLchar> log(static_cast<std::size_t>(std::max(1, length)));
    gl.GetShaderInfoLog(shader, static_cast<GLsizei>(log.size()), nullptr,
                        log.data());
    why = std::string("a finishing pass does not compile: ") + log.data();
    gl.DeleteShader(shader);
    return 0;
  }
  return shader;
}

/** EASU's constants for `input` brought to `output` (`easuConstants`). */
std::array<float, 4> easu_constants(DrawSize input, DrawSize output) {
  const double in_w = input.width;
  const double in_h = input.height;
  const double out_w = output.width;
  const double out_h = output.height;
  return {static_cast<float>(in_w / out_w), static_cast<float>(in_h / out_h),
          static_cast<float>((0.5 * in_w) / out_w - 0.5),
          static_cast<float>((0.5 * in_h) / out_h - 0.5)};
}

}  // namespace

std::unique_ptr<SceneFinish> SceneFinish::create(const Api& gl,
                                                 std::string& why) {
  auto finish = std::unique_ptr<SceneFinish>(new SceneFinish(gl));
  gl.GenVertexArrays(1, &finish->vao_);
  if (finish->vao_ == 0 ||
      !finish->link(finish->downsample_, finish::kDownsampleSource, "uStep",
                    why) ||
      !finish->link(finish->fxaa_, finish::kFxaaSource, "uRcpFrame", why) ||
      !finish->link(finish->easu_, finish::kEasuSource, "uCon", why) ||
      !finish->link(finish->rcas_, finish::kRcasSource, "uSharp", why)) {
    if (why.empty()) {
      why = "the finishing passes have nothing to draw with";
    }
    finish->release();
    return nullptr;
  }
  return finish;
}

SceneFinish::~SceneFinish() { release(); }

bool SceneFinish::link(Pass& pass, const char* source, const char* knob,
                       std::string& why) {
  const GLuint vertex = compile(gl_, kVertexShader, finish::kVertexSource, why);
  if (vertex == 0) {
    return false;
  }
  const GLuint fragment = compile(gl_, kFragmentShader, source, why);
  if (fragment == 0) {
    gl_.DeleteShader(vertex);
    return false;
  }
  const GLuint program = gl_.CreateProgram();
  gl_.AttachShader(program, vertex);
  gl_.AttachShader(program, fragment);
  gl_.LinkProgram(program);
  gl_.DeleteShader(vertex);
  gl_.DeleteShader(fragment);
  GLint linked = 0;
  gl_.GetProgramiv(program, kLinkStatus, &linked);
  if (linked == 0) {
    why = "a finishing pass does not link";
    gl_.DeleteProgram(program);
    return false;
  }
  pass.program = program;
  pass.input = gl_.GetUniformLocation(program, "uInput");
  pass.knob = gl_.GetUniformLocation(program, knob);
  return true;
}

void SceneFinish::free_target(Target& target) {
  if (target.framebuffer != 0) {
    gl_.DeleteFramebuffers(1, &target.framebuffer);
  }
  if (target.texture != 0) {
    gl_.DeleteTextures(1, &target.texture);
  }
  target = {};
}

bool SceneFinish::fit(Target& target, DrawSize size) {
  if (target.framebuffer != 0 && target.size == size) {
    return true;
  }
  free_target(target);
  // Linear: FXAA's edge search and the supersample average read between
  // texels on purpose; EASU and RCAS fetch whole texels by index.
  gl_.GenTextures(1, &target.texture);
  gl_.BindTexture(kTexture2D, target.texture);
  gl_.TexImage2D(kTexture2D, 0, static_cast<GLint>(kRgba8), size.width,
                 size.height, 0, kRgba, kUnsignedByte, nullptr);
  gl_.TexParameteri(kTexture2D, kTextureMinFilter, kLinear);
  gl_.TexParameteri(kTexture2D, kTextureMagFilter, kLinear);
  gl_.TexParameteri(kTexture2D, kTextureWrapS, kClampToEdge);
  gl_.TexParameteri(kTexture2D, kTextureWrapT, kClampToEdge);
  gl_.GenFramebuffers(1, &target.framebuffer);
  gl_.BindFramebuffer(kFramebuffer, target.framebuffer);
  gl_.FramebufferTexture2D(kFramebuffer, kColorAttachment0, kTexture2D,
                           target.texture, 0);
  const bool complete =
      gl_.CheckFramebufferStatus(kFramebuffer) == kFramebufferComplete;
  gl_.BindFramebuffer(kFramebuffer, 0);
  if (!complete) {
    free_target(target);
    return false;
  }
  target.size = size;
  return true;
}

void SceneFinish::run(const Pass& pass, GLuint input, GLuint framebuffer,
                      DrawSize size) {
  gl_.BindFramebuffer(kFramebuffer, framebuffer);
  gl_.Viewport(0, 0, size.width, size.height);
  gl_.UseProgram(pass.program);
  gl_.BindVertexArray(vao_);
  gl_.ActiveTexture(kTexture0);
  gl_.BindTexture(kTexture2D, input);
  gl_.Uniform1i(pass.input, 0);
}

bool SceneFinish::present(const Input& input, DrawSize canvas, DrawSize window,
                          const PresentPlan& plan, GLuint out) {
  const bool to_window = canvas == window;
  Input current = input;
  bool wrote_window = false;
  for (int at = 0; at < plan.count; ++at) {
    const PresentStep step = plan.steps[static_cast<std::size_t>(at)];
    // A copy is the stretch below: the picture as it is, onto the window.
    if (step == PresentStep::kCopy) {
      continue;
    }
    const bool last = at == plan.count - 1 && to_window;
    if (!last && !fit(a_, canvas)) {
      return false;
    }
    const GLuint into = last ? out : a_.framebuffer;
    if (step == PresentStep::kFsr) {
      // EASU needs a target of its own even on the last step: RCAS reads it.
      if (!fit(b_, canvas)) {
        return false;
      }
      run(easu_, current.texture, b_.framebuffer, canvas);
      const auto con = easu_constants(current.size, canvas);
      gl_.Uniform4f(easu_.knob, con[0], con[1], con[2], con[3]);
      gl_.DrawArrays(kTriangles, 0, 3);
      run(rcas_, b_.texture, into, canvas);
      gl_.Uniform1f(rcas_.knob,
                    static_cast<float>(std::exp2(-finish::kRcasSharpnessStops)));
    } else if (step == PresentStep::kDownsample) {
      run(downsample_, current.texture, into, canvas);
      gl_.Uniform2f(downsample_.knob,
                    static_cast<float>(static_cast<double>(current.size.width) /
                                       canvas.width),
                    static_cast<float>(static_cast<double>(current.size.height) /
                                       canvas.height));
    } else {
      run(fxaa_, current.texture, into, canvas);
      gl_.Uniform2f(fxaa_.knob, static_cast<float>(1.0 / current.size.width),
                    static_cast<float>(1.0 / current.size.height));
    }
    gl_.DrawArrays(kTriangles, 0, 3);
    if (last) {
      wrote_window = true;
    } else {
      current = {a_.texture, a_.framebuffer, canvas};
      // The next pass writes the other intermediate.
      std::swap(a_, b_);
    }
  }
  if (!wrote_window) {
    gl_.BindFramebuffer(kReadFramebuffer, current.framebuffer);
    gl_.BindFramebuffer(kDrawFramebuffer, out);
    gl_.BlitFramebuffer(0, 0, current.size.width, current.size.height, 0, 0,
                        window.width, window.height, kColorBufferBit,
                        static_cast<GLenum>(kLinear));
  }
  gl_.BindFramebuffer(kFramebuffer, 0);
  return true;
}

void SceneFinish::shed() {
  free_target(a_);
  free_target(b_);
}

void SceneFinish::release() {
  shed();
  for (Pass* pass : {&downsample_, &fxaa_, &easu_, &rcas_}) {
    if (pass->program != 0) {
      gl_.DeleteProgram(pass->program);
    }
    *pass = {};
  }
  if (vao_ != 0) {
    gl_.DeleteVertexArrays(1, &vao_);
    vao_ = 0;
  }
}

}  // namespace feq::scene
