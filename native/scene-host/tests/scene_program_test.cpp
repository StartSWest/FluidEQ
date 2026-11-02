/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// A scene drawn by the C++ through the ANGLE Electron ships: the context
// opens on this machine's Direct3D 11, a scene compiles, the values a frame
// hands it reach its uniforms and textures, and the picture comes back. And
// a scene that does not compile comes back with the compiler's own words
// instead of a picture.

#include <array>
#include <cstdio>
#include <cstdlib>
#include <memory>
#include <string>

#include "angle_api.h"
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

// Each channel from a different input: a uniform, a slider, the spectrum
// texture and the scene's fade, so a value lost on its way is a channel off.
constexpr const char* kFragment = R"(#version 300 es
precision highp float;
uniform float uLevel;
uniform float uSceneFade;
uniform sampler2D uSpectrum;
uniform float uParam_glow;
in vec2 vUv;
out vec4 fragColor;
void main() {
  float spectrum = texture(uSpectrum, vec2(0.5, 0.5)).r;
  fragColor = vec4(uLevel, uParam_glow, spectrum, 1.0) * uSceneFade;
}
)";

bool near(std::uint8_t value, int expected) {
  return std::abs(static_cast<int>(value) - expected) <= 2;
}

}  // namespace

int main() {
  std::string why;
  std::unique_ptr<feq::scene::gl::Context> context(
      feq::scene::gl::Context::create(FEQ_TEST_ANGLE_DIR, 16, 8, why));
  if (!context) {
    std::printf("FAIL: no ANGLE context: %s\n", why.c_str());
    return 1;
  }
  const auto& gl = context->gl();

  feq::scene::ScenePack pack;
  pack.vertex_source = kVertex;
  pack.fragment_source = kFragment;
  pack.params = {{"uParam_glow", 0.25}};
  std::string log;
  auto program = feq::scene::SceneProgram::compile(gl, pack, log);
  check(program != nullptr, "a scene compiles");
  if (program) {
    feq::scene::SceneFrame frame;
    frame.level = 1.0;
    frame.fade = 1.0;
    frame.spectrum.fill(128);
    // The slider is not in the frame: the pack's 0.25 is drawn.
    program->draw(frame, 16, 8);
    std::array<std::uint8_t, 4> pixel{};
    gl.ReadPixels(8, 4, 1, 1, feq::scene::gl::kRgba,
                  feq::scene::gl::kUnsignedByte, pixel.data());
    std::printf("drawn: %d %d %d %d\n", pixel[0], pixel[1], pixel[2],
                pixel[3]);
    check(near(pixel[0], 255) && near(pixel[1], 64) && near(pixel[2], 128) &&
              near(pixel[3], 255),
          "the frame's values are the picture's");

    // The control: the same scene faded out draws nothing.
    frame.fade = 0.0;
    program->draw(frame, 16, 8);
    gl.ReadPixels(8, 4, 1, 1, feq::scene::gl::kRgba,
                  feq::scene::gl::kUnsignedByte, pixel.data());
    check(pixel[0] == 0 && pixel[1] == 0 && pixel[2] == 0,
          "a faded scene draws black");
  }

  feq::scene::ScenePack broken = pack;
  broken.fragment_source = "#version 300 es\nvoid main() { nonsense; }\n";
  std::string broken_log;
  check(feq::scene::SceneProgram::compile(gl, broken, broken_log) == nullptr,
        "a broken scene does not compile");
  check(broken_log.find("nonsense") != std::string::npos ||
            broken_log.find("undeclared") != std::string::npos,
        "the compiler's words come back");
  std::printf("compiler said: %.80s\n", broken_log.c_str());

  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("scene program: drawn through ANGLE\n");
  return 0;
}
