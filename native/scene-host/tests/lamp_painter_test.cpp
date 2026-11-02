/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The lamps' painter on the ANGLE Electron ships: a scene loads and lights
// the grid with what the frame gave it (level, slider, time of day, framing,
// artwork the right way up), a broken scene and a missing GPU are reported
// and turn the desk to its swatch, a scene asked for over one still linking
// is the only one loaded, and a member's strobing scene is held down by the
// limiter where the same scene unguarded is not (the control).

#define NOMINMAX
#include <windows.h>
#include <objbase.h>

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <span>
#include <string>
#include <vector>

#include "artwork_decode.h"
#include "fluideq/scene/lamp_pacing.h"
#include "lamp_painter.h"
#include "webp_sample.h"

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

// The framing main worked out: the view's width and the wave's top edge.
constexpr const char* kFraming = R"(#version 300 es
precision highp float;
uniform vec4 uView;
uniform vec4 uSpectrumRect;
in vec2 vUv;
out vec4 fragColor;
void main() { fragColor = vec4(uView.z / 4.0, uSpectrumRect.w, 0.0, 1.0); }
)";

// The artwork as it lies: its top at the top of the picture.
constexpr const char* kArtwork = R"(#version 300 es
precision highp float;
uniform sampler2D uArtwork;
in vec2 vUv;
out vec4 fragColor;
void main() { fragColor = texture(uArtwork, vec2(0.5, vUv.y)); }
)";

constexpr const char* kStrobe = R"(#version 300 es
precision highp float;
uniform float uLevel;
in vec2 vUv;
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
  std::vector<std::pair<std::uint32_t, wire::FailReason>> failed;
  std::vector<scene::PaintedGrid> grids;
};

scene::LampPainter::Output output_to(Heard& heard) {
  scene::LampPainter::Output output;
  output.loaded = [&heard](std::uint32_t id) { heard.loaded.push_back(id); };
  output.failed = [&heard](std::uint32_t id, wire::FailReason reason,
                           const std::string&) {
    heard.failed.emplace_back(id, reason);
  };
  output.painted = [&heard](const scene::PaintedGrid& grid) {
    heard.grids.push_back(grid);
  };
  return output;
}

scene::LampScene scene_of(std::uint32_t id, const char* fragment,
                          bool guarded = false) {
  scene::LampScene made;
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
  heard.delta_ms = 1000.0 / 30.0;
  heard.activity = 1.0;
  return heard;
}

/** Red of the grid's cell in `row`, `column`. */
int red_at(const scene::PaintedGrid& grid, int row, int column) {
  return grid.rgb[(static_cast<std::size_t>(row) * scene::kLightingGridWidth +
                   static_cast<std::size_t>(column)) *
                  3];
}

}  // namespace

int main() {
  const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  const std::wstring angle = FEQ_TEST_ANGLE_DIR;

  {
    Heard heard;
    scene::LampPainter painter(angle, output_to(heard));
    painter.load(scene_of(1, kLevels));
    painter.finish_link();
    std::printf("links in parallel: %s\n",
                painter.links_in_parallel() ? "yes" : "no");
    check(heard.loaded == std::vector<std::uint32_t>{1}, "the scene loads");
    check(!painter.failed(), "a loaded scene is drawn, not its swatch");
    painter.set_preview(true);
    painter.paint(frame_at(0.6), 50.0);
    check(heard.grids.size() == 1, "a frame paints a grid");
    if (!heard.grids.empty()) {
      const auto& grid = heard.grids.back();
      const std::size_t middle =
          (13 * static_cast<std::size_t>(scene::kLightingGridWidth) + 24) * 3;
      std::printf("grid: %d %d %d\n", grid.rgb[middle], grid.rgb[middle + 1],
                  grid.rgb[middle + 2]);
      check(close_to(grid.rgb[middle], 153), "red is the level");
      check(close_to(grid.rgb[middle + 1], 64), "green is the slider");
      check(close_to(grid.rgb[middle + 2], 128), "blue is the time of day");
      check(std::abs(grid.level - 0.6) < 1e-12, "the grid says the level");
      check(grid.preview_width == 96 && grid.preview_height == 54,
            "the preview is the drawn size under the card's");
      check(grid.preview.size() == 96U * 54U * 3U &&
                close_to(grid.preview[(27U * 96U + 48U) * 3U], 153),
            "the preview is the picture");
    }
  }

  {
    Heard heard;
    scene::LampPainter painter(angle, output_to(heard));
    auto framed = scene_of(2, kFraming);
    framed.pack.view = {-0.5F, 0.0F, 2.0F, 1.0F};
    framed.pack.spectrum_rect = {0.25F, 0.75F, 0.0F, 0.5F};
    painter.load(std::move(framed));
    painter.finish_link();
    painter.paint(frame_at(0.0), 0.0);
    check(!heard.grids.empty() && close_to(red_at(heard.grids.back(), 13, 24), 128) &&
              close_to(heard.grids.back().rgb[(13 * 48 + 24) * 3 + 1], 128),
          "the framing main worked out reaches the scene");
  }

  {
    Heard heard;
    scene::LampPainter painter(angle, output_to(heard));
    auto pictured = scene_of(3, kArtwork);
    std::string why;
    check(scene::decode_artwork(kRedOverBlueWebp, 4, 2, pictured.pack.artwork,
                                why),
          "Windows decodes the WebP");
    pictured.pack.artwork_width = 4;
    pictured.pack.artwork_height = 2;
    painter.load(std::move(pictured));
    painter.finish_link();
    painter.set_preview(true);
    painter.paint(frame_at(0.0), 0.0);
    if (!heard.grids.empty()) {
      const auto& grid = heard.grids.back();
      const std::size_t top = (0U * 48U + 24U) * 3U;
      const std::size_t bottom = (26U * 48U + 24U) * 3U;
      std::printf("artwork top %d,%d,%d bottom %d,%d,%d\n", grid.rgb[top],
                  grid.rgb[top + 1], grid.rgb[top + 2], grid.rgb[bottom],
                  grid.rgb[bottom + 1], grid.rgb[bottom + 2]);
      check(grid.rgb[top] > 200 && grid.rgb[top + 2] < 60,
            "the artwork's top row lights the top of the desk");
      check(grid.rgb[bottom + 2] > 200 && grid.rgb[bottom] < 60,
            "the artwork's bottom row lights the bottom");
      // The page's picture is top row first too.
      const auto preview_at = [&grid](int row) {
        return (static_cast<std::size_t>(row) *
                    static_cast<std::size_t>(grid.preview_width) +
                static_cast<std::size_t>(grid.preview_width / 2)) *
               3;
      };
      check(grid.preview.size() > 0 &&
                grid.preview[preview_at(0)] > 200 &&
                grid.preview[preview_at(grid.preview_height - 1) + 2] > 200,
            "the page's picture is the right way up");
    } else {
      check(false, "the artwork scene paints");
    }
    std::vector<std::uint8_t> unused;
    check(!scene::decode_artwork(kRedOverBlueWebp, 4, 3, unused, why),
          "an artwork of another size than its header is refused");
    const std::array<std::uint8_t, 12> not_webp{'R', 'I', 'F', 'F', 0, 0,
                                               0,   0,   'W', 'A', 'V', 'E'};
    check(!scene::decode_artwork(not_webp, 4, 2, unused, why),
          "bytes that are no picture are refused");
  }

  {
    Heard heard;
    scene::LampPainter painter(angle, output_to(heard));
    painter.load(scene_of(4, kLevels));
    painter.finish_link();
    painter.load(scene_of(5, kBroken));
    painter.finish_link();
    check(heard.failed.size() == 1 && heard.failed[0].first == 5 &&
              heard.failed[0].second == wire::FailReason::kCompile,
          "a broken scene is reported as one");
    check(painter.failed(), "a broken scene turns the desk to its swatch");
    const auto painted = heard.grids.size();
    painter.paint(frame_at(0.5), 0.0);
    check(heard.grids.size() == painted,
          "nothing is drawn once the scene asked for has failed");
  }

  {
    Heard heard;
    scene::LampPainter painter(angle, output_to(heard));
    painter.load(scene_of(10, kLevels));
    painter.settle();
    painter.load(scene_of(11, kFraming));
    painter.finish_link();
    painter.settle();
    check(heard.loaded == std::vector<std::uint32_t>{11},
          "a scene asked for over one still linking is the one loaded");
  }

  {
    Heard heard;
    scene::LampPainter painter(L"C:\\nowhere\\at\\all", output_to(heard));
    painter.load(scene_of(20, kLevels));
    check(heard.failed.size() == 1 &&
              heard.failed[0].second == wire::FailReason::kNoContext,
          "no ANGLE is reported as no context");
    check(painter.failed(), "with no context the desk takes the swatch");
  }

  const auto largest_swing = [&](bool guarded) {
    Heard heard;
    scene::LampPainter painter(angle, output_to(heard));
    painter.load(scene_of(30, kStrobe, guarded));
    painter.finish_link();
    int largest = 0;
    for (int at = 0; at < 60; ++at) {
      painter.paint(frame_at(at % 2 == 0 ? 1.0 : 0.0), 0.0);
    }
    for (std::size_t at = 31; at < heard.grids.size(); ++at) {
      largest = std::max(largest, std::abs(red_at(heard.grids[at], 13, 24) -
                                           red_at(heard.grids[at - 1], 13, 24)));
    }
    check(heard.grids.size() == 60, "every strobe frame paints");
    return largest;
  };
  const int bare = largest_swing(false);
  const int guarded = largest_swing(true);
  std::printf("strobe swing on the desk: bare %d, guarded %d\n", bare, guarded);
  check(bare >= 250, "the control strobes the desk all the way");
  check(guarded <= 64, "a member's strobe is held down on the desk");

  if (SUCCEEDED(com)) {
    CoUninitialize();
  }
  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("lamp painter: the window's lamp worker, on the host\n");
  return 0;
}
