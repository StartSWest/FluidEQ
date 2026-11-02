/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The flash limiter on the C++ host, with the window's own programs: a scene
// strobing black to white thirty times a second is held to a gentle swing
// once the limiter has seen it, while the same strobe drawn without it
// swings all the way (the control), and a steady scene passes untouched.

#include <array>
#include <cstdio>
#include <cstdlib>
#include <memory>
#include <string>

#include "angle_api.h"
#include "flash_guard.h"
#include "scene_program.h"

namespace {

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

constexpr const char* kVertex = R"(#version 300 es
uniform vec4 uView;
out vec2 vUv;
void main() {
  vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = (corner - uView.xy) / uView.zw;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
)";

// White or black on the level, the whole picture at once.
constexpr const char* kStrobe = R"(#version 300 es
precision highp float;
uniform float uLevel;
in vec2 vUv;
out vec4 fragColor;
void main() { fragColor = vec4(vec3(uLevel), 1.0); }
)";

constexpr int kWidth = 64;
constexpr int kHeight = 36;

int centre(const feq::scene::gl::Api& gl) {
  std::array<std::uint8_t, 4> pixel{};
  gl.ReadPixels(kWidth / 2, kHeight / 2, 1, 1, feq::scene::gl::kRgba,
                feq::scene::gl::kUnsignedByte, pixel.data());
  return pixel[0];
}

/** The largest frame-to-frame change over the last half of 60 frames. */
int largest_swing(const feq::scene::gl::Api& gl,
                  feq::scene::SceneProgram& program,
                  feq::scene::FlashGuard* guard, bool strobe) {
  feq::scene::SceneFrame frame;
  frame.fade = 1.0;
  int previous = -1;
  int largest = 0;
  for (int at = 0; at < 60; ++at) {
    frame.level = strobe ? (at % 2 == 0 ? 1.0 : 0.0) : 0.6;
    if (guard != nullptr) {
      guard->begin(kWidth, kHeight);
    } else {
      gl.BindFramebuffer(feq::scene::gl::kFramebuffer, 0);
    }
    program.draw(frame, kWidth, kHeight);
    if (guard != nullptr) {
      guard->end(1000.0 / 30.0, 0);
    }
    const int now = centre(gl);
    if (at >= 30 && previous >= 0) {
      largest = std::max(largest, std::abs(now - previous));
    }
    previous = now;
  }
  return largest;
}

}  // namespace

int main() {
  std::string why;
  std::unique_ptr<feq::scene::gl::Context> context(
      feq::scene::gl::Context::create(FEQ_TEST_ANGLE_DIR, kWidth, kHeight, why));
  if (!context) {
    std::printf("FAIL: no ANGLE context: %s\n", why.c_str());
    return 1;
  }
  const auto& gl = context->gl();
  feq::scene::ScenePack pack;
  pack.vertex_source = kVertex;
  pack.fragment_source = kStrobe;
  std::string log;
  auto program = feq::scene::SceneProgram::compile(gl, pack, log);
  auto guard = feq::scene::FlashGuard::create(gl, why);
  check(program != nullptr, "the strobe compiles");
  check(guard != nullptr, "the limiter builds on ANGLE");
  if (!program || !guard) {
    std::printf("%s %s\n", log.c_str(), why.c_str());
    return 1;
  }

  const int bare = largest_swing(gl, *program, nullptr, true);
  const int guarded = largest_swing(gl, *program, guard.get(), true);
  std::printf("strobe swing: bare %d, guarded %d (of 255)\n", bare, guarded);
  check(bare >= 250, "the control strobes all the way");
  check(guarded <= 64, "the limiter holds the strobe down");

  auto steady_guard = feq::scene::FlashGuard::create(gl, why);
  const int steady = largest_swing(gl, *program, steady_guard.get(), false);
  std::printf("steady swing guarded: %d\n", steady);
  check(steady == 0, "a steady scene passes untouched");
  // And it passes at its own brightness: 0.6 of white.
  steady_guard->begin(kWidth, kHeight);
  feq::scene::SceneFrame frame;
  frame.fade = 1.0;
  frame.level = 0.6;
  program->draw(frame, kWidth, kHeight);
  steady_guard->end(1000.0 / 30.0, 0);
  const int level = centre(gl);
  std::printf("steady level: %d\n", level);
  check(std::abs(level - 153) <= 2, "a steady scene keeps its brightness");

  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("flash guard: the window's limit, on the host\n");
  return 0;
}
