/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// A monitor's background drawn by C++ into a window that is never shown:
// the scene answers the frame (level, slider, time of day), drawn at the
// share of the monitor the performance choice asks for; its first frame is
// told once; a scene asked for over one on the monitor takes over only once
// it has linked, and a broken one leaves the old one there; and a member's
// strobing scene is held down by the limiter where the same scene unguarded
// is not (the control).

#define NOMINMAX
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <objbase.h>

#include <array>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

#include "desktop_painter.h"

namespace {

namespace scene = feq::scene;
namespace wire = feq::scene::wire;

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

bool close_to(int value, int expected, int within = 2) {
  return std::abs(value - expected) <= within;
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

// Red the level, green a slider, blue the time of day.
constexpr const char* kLevels = R"(#version 300 es
precision highp float;
uniform float uLevel;
uniform float uParam_glow;
uniform float uParam_daylight;
in vec2 vUv;
out vec4 fragColor;
void main() {
  fragColor = vec4(uLevel, uParam_glow, uParam_daylight / 100.0, 1.0);
}
)";

constexpr const char* kBlue = R"(#version 300 es
precision highp float;
out vec4 fragColor;
void main() { fragColor = vec4(0.0, 0.0, 1.0, 1.0); }
)";

constexpr const char* kStrobe = R"(#version 300 es
precision highp float;
uniform float uLevel;
out vec4 fragColor;
void main() { fragColor = vec4(vec3(uLevel), 1.0); }
)";

constexpr const char* kBroken = R"(#version 300 es
precision highp float;
out vec4 fragColor;
void main() { fragColor = notDeclaredAnywhere; }
)";

struct Heard {
  std::vector<std::uint32_t> loaded;
  std::vector<std::uint32_t> drawn;
  std::vector<std::pair<std::uint32_t, wire::FailReason>> failed;
};

scene::DesktopPainter::Output output_to(Heard& heard) {
  scene::DesktopPainter::Output output;
  output.loaded = [&heard](std::uint32_t id) { heard.loaded.push_back(id); };
  output.drawn = [&heard](std::uint32_t id) { heard.drawn.push_back(id); };
  output.failed = [&heard](std::uint32_t id, wire::FailReason reason,
                           const std::string&) {
    heard.failed.emplace_back(id, reason);
  };
  return output;
}

scene::DesktopScene scene_of(std::uint32_t id, const char* fragment,
                             bool guarded = false) {
  scene::DesktopScene made;
  made.id = id;
  made.guarded = guarded;
  made.pack.vertex_source = kVertex;
  made.pack.fragment_source = fragment;
  made.params = {{"glow", 0.25, 0.0, 1.0}, {"daylight", 0.0, 0.0, 100.0}};
  for (const auto& param : made.params) {
    made.pack.params.emplace_back("uParam_" + param.id, param.value);
  }
  return made;
}

scene::HeardLampFrame frame_at(double level) {
  scene::HeardLampFrame heard;
  heard.frame.level = level;
  heard.frame.fade = 1.0;
  heard.delta_ms = 1000.0 / 60.0;
  heard.activity = 1.0;
  return heard;
}

HWND hidden_window(int width, int height) {
  WNDCLASSEXW type{};
  type.cbSize = sizeof(type);
  type.lpfnWndProc = DefWindowProcW;
  type.hInstance = GetModuleHandleW(nullptr);
  type.lpszClassName = L"FluidEQ-Desktop-Painter-Test";
  RegisterClassExW(&type);
  return CreateWindowExW(0, type.lpszClassName, L"", WS_POPUP, 0, 0, width,
                         height, nullptr, nullptr, type.hInstance, nullptr);
}

std::array<std::uint8_t, 4> middle(const scene::DesktopPainter& painter) {
  std::array<std::uint8_t, 4> pixel{};
  painter.frame_pixel(painter.frame_width() / 2, painter.frame_height() / 2,
                      pixel);
  return pixel;
}

}  // namespace

int main() {
  const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  const std::wstring angle = FEQ_TEST_ANGLE_DIR;
  const HWND window = hidden_window(640, 360);

  {
    Heard heard;
    scene::DesktopPainter painter(angle, output_to(heard));
    std::string why;
    check(painter.open(window, 640, 360, why), "the painter opens on the window");
    painter.set_scale(0.5);
    painter.load(scene_of(1, kLevels));
    painter.finish_link();
    check(heard.loaded == std::vector<std::uint32_t>{1}, "the scene loads");
    check(painter.paint(frame_at(0.6), 50.0), "a frame is painted and presented");
    check(painter.frame_width() == 320 && painter.frame_height() == 180,
          "drawn at the share of the monitor asked for");
    const auto pixel = middle(painter);
    check(close_to(pixel[0], 153) && close_to(pixel[1], 64) &&
              close_to(pixel[2], 128),
          "the scene answers the level, its slider and the time of day");
    painter.paint(frame_at(0.2), 50.0);
    check(heard.drawn == std::vector<std::uint32_t>{1},
          "its first frame is told, once");
    // The desktop helper stretches the window over the whole monitor once it
    // has placed it: the next frame is drawn at that size.
    SetWindowPos(window, nullptr, 0, 0, 800, 400,
                 SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE);
    painter.paint(frame_at(0.2), 50.0);
    check(painter.frame_width() == 400 && painter.frame_height() == 200,
          "a window made larger is drawn at its new size");
    SetWindowPos(window, nullptr, 0, 0, 640, 360,
                 SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE);
    check(close_to(middle(painter)[0], 51), "the next frame moves with the music");

    // Another scene: the first keeps the monitor until it links.
    painter.load(scene_of(2, kBlue));
    painter.paint(frame_at(0.6), 50.0);
    check(painter.drawing(), "the monitor is never blank between scenes");
    painter.finish_link();
    painter.paint(frame_at(0.6), 50.0);
    const auto blue = middle(painter);
    check(blue[2] == 255 && blue[0] == 0, "the new scene takes over once linked");
    check(heard.drawn == std::vector<std::uint32_t>({1, 2}),
          "and its own first frame is told");

    // A broken one: reported, and what is on the monitor stays.
    painter.load(scene_of(3, kBroken));
    painter.finish_link();
    painter.paint(frame_at(0.6), 50.0);
    check(heard.failed.size() == 1 && heard.failed[0].first == 3 &&
              heard.failed[0].second == wire::FailReason::kCompile,
          "a scene that does not compile is reported");
    check(painter.drawing() && middle(painter)[2] == 255,
          "and the scene before it stays on the monitor");
    painter.close();
  }

  // A member's strobe through the limiter, beside the same strobe bare.
  const auto swing = [&](bool guarded) {
    Heard heard;
    scene::DesktopPainter painter(angle, output_to(heard));
    std::string why;
    painter.open(window, 160, 90, why);
    painter.load(scene_of(4, kStrobe, guarded));
    painter.finish_link();
    int lowest = 255;
    int highest = 0;
    for (int at = 0; at < 30; ++at) {
      painter.paint(frame_at(at % 2 == 0 ? 1.0 : 0.0), 0.0);
      if (at >= 10) {
        const int red = middle(painter)[0];
        lowest = std::min(lowest, red);
        highest = std::max(highest, red);
      }
    }
    painter.close();
    return highest - lowest;
  };
  const int bare = swing(false);
  const int guarded = swing(true);
  std::printf("strobe swing on the desktop: bare %d, guarded %d\n", bare, guarded);
  check(bare > 200, "the bare strobe swings the whole way (the control)");
  check(guarded < bare / 4, "a member's strobe is held down by the limiter");

  {
    Heard heard;
    scene::DesktopPainter painter(angle, output_to(heard));
    painter.load(scene_of(5, kLevels));
    check(heard.failed.size() == 1 &&
              heard.failed[0].second == wire::FailReason::kNoContext,
          "a scene with no monitor open is reported, not drawn");
  }

  DestroyWindow(window);
  if (SUCCEEDED(com)) {
    CoUninitialize();
  }
  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("desktop painter: the scene on a monitor, scaled, switched, limited\n");
  return 0;
}
