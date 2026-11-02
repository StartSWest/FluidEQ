/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The desktop scenes' finishing passes on the ANGLE Electron ships, each
// beside the plain operation it replaces as its control: a supersampled
// checkerboard averaged to grey where a nearest pick keeps it black and
// white; a one-pixel line brought up by FSR keeping more of its peak than a
// bilinear stretch; a hard diagonal smoothed by FXAA where a copy leaves it
// stepped; a canvas smaller than the window stretched to fill it. And the
// GPU clock: a frame retired once the GPU is through with it, timed where
// Direct3D times it.

#define NOMINMAX
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <algorithm>
#include <cstdio>
#include <memory>
#include <string>
#include <vector>

#include "angle_api.h"
#include "gpu_clock.h"
#include "scene_finish.h"

namespace {

namespace scene = feq::scene;
using namespace feq::scene::gl;

constexpr GLint kNearest = 0x2600;

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

struct Picture {
  GLuint texture = 0;
  GLuint framebuffer = 0;
  scene::DrawSize size;
};

/** A linear-filtered RGBA picture of `size`, from grey levels, row 0 first. */
Picture picture(const Api& gl, scene::DrawSize size,
                const std::vector<std::uint8_t>& grey) {
  std::vector<std::uint8_t> rgba;
  for (const std::uint8_t level : grey) {
    rgba.insert(rgba.end(), {level, level, level, 255});
  }
  Picture made;
  made.size = size;
  gl.GenTextures(1, &made.texture);
  gl.BindTexture(kTexture2D, made.texture);
  gl.PixelStorei(kUnpackAlignment, 1);
  gl.TexImage2D(kTexture2D, 0, static_cast<GLint>(kRgba8), size.width,
                size.height, 0, kRgba, kUnsignedByte,
                grey.empty() ? nullptr : rgba.data());
  gl.TexParameteri(kTexture2D, kTextureMinFilter, kLinear);
  gl.TexParameteri(kTexture2D, kTextureMagFilter, kLinear);
  gl.TexParameteri(kTexture2D, kTextureWrapS, kClampToEdge);
  gl.TexParameteri(kTexture2D, kTextureWrapT, kClampToEdge);
  gl.GenFramebuffers(1, &made.framebuffer);
  gl.BindFramebuffer(kFramebuffer, made.framebuffer);
  gl.FramebufferTexture2D(kFramebuffer, kColorAttachment0, kTexture2D,
                          made.texture, 0);
  gl.BindFramebuffer(kFramebuffer, 0);
  return made;
}

void free_picture(const Api& gl, Picture& made) {
  gl.DeleteFramebuffers(1, &made.framebuffer);
  gl.DeleteTextures(1, &made.texture);
}

/** The red channel of every pixel of `from`, row 0 first. */
std::vector<int> reds(const Api& gl, const Picture& from) {
  std::vector<std::uint8_t> rgba(
      static_cast<std::size_t>(from.size.width * from.size.height * 4));
  gl.BindFramebuffer(kFramebuffer, from.framebuffer);
  gl.ReadPixels(0, 0, from.size.width, from.size.height, kRgba, kUnsignedByte,
                rgba.data());
  gl.BindFramebuffer(kFramebuffer, 0);
  std::vector<int> out;
  for (std::size_t at = 0; at < rgba.size(); at += 4) {
    out.push_back(rgba[at]);
  }
  return out;
}

scene::PresentPlan plan_of(scene::PresentStep step) {
  scene::PresentPlan plan;
  plan.steps[0] = step;
  plan.count = 1;
  return plan;
}

/** `input` finished by `step` into a new picture of `size`, and read back. */
std::vector<int> finished(const Api& gl, scene::SceneFinish& finish,
                          const Picture& input, scene::DrawSize canvas,
                          scene::DrawSize size, scene::PresentStep step) {
  Picture out = picture(gl, size, {});
  finish.present({input.texture, input.framebuffer, input.size}, canvas, size,
                 plan_of(step), out.framebuffer);
  auto read = reds(gl, out);
  free_picture(gl, out);
  return read;
}

/** `input` stretched by a plain blit, filtered as asked, and read back. */
std::vector<int> blitted(const Api& gl, const Picture& input,
                         scene::DrawSize size, GLint filter) {
  Picture out = picture(gl, size, {});
  gl.BindFramebuffer(kReadFramebuffer, input.framebuffer);
  gl.BindFramebuffer(kDrawFramebuffer, out.framebuffer);
  gl.BlitFramebuffer(0, 0, input.size.width, input.size.height, 0, 0,
                     size.width, size.height, kColorBufferBit,
                     static_cast<GLenum>(filter));
  gl.BindFramebuffer(kFramebuffer, 0);
  auto read = reds(gl, out);
  free_picture(gl, out);
  return read;
}

bool between(int value, int low, int high) {
  return value >= low && value <= high;
}

}  // namespace

int main() {
  std::string why;
  std::unique_ptr<Context> context(
      Context::create(FEQ_TEST_ANGLE_DIR, 64, 64, why));
  if (!context) {
    std::printf("FAIL: no ANGLE context: %s\n", why.c_str());
    return 1;
  }
  const Api& gl = context->gl();
  auto finish = scene::SceneFinish::create(gl, why);
  check(finish != nullptr, "the finishing passes link on ANGLE");
  if (!finish) {
    std::printf("%s\n", why.c_str());
    return 1;
  }

  {
    // Best smoothing: twice the panel each way, averaged down.
    std::vector<std::uint8_t> checker;
    for (int y = 0; y < 8; ++y) {
      for (int x = 0; x < 8; ++x) {
        checker.push_back((x + y) % 2 == 0 ? 255 : 0);
      }
    }
    Picture large = picture(gl, {8, 8}, checker);
    const auto grey = finished(gl, *finish, large, {4, 4}, {4, 4},
                               scene::PresentStep::kDownsample);
    const auto picked = blitted(gl, large, {4, 4}, kNearest);
    check(std::all_of(grey.begin(), grey.end(),
                      [](int red) { return between(red, 120, 135); }),
          "a supersampled checkerboard averages to grey");
    check(std::all_of(picked.begin(), picked.end(),
                      [](int red) { return red == 0 || red == 255; }),
          "where a nearest pick keeps it black and white (the control)");
    free_picture(gl, large);

    // Each output pixel reads its own two-by-two footprint, and no other:
    // the white half stays where it was, the black half too.
    std::vector<std::uint8_t> halves(8 * 8, 0);
    for (int y = 0; y < 8; ++y) {
      for (int x = 0; x < 4; ++x) {
        halves[static_cast<std::size_t>(y * 8 + x)] = 255;
      }
    }
    Picture split = picture(gl, {8, 8}, halves);
    const auto kept = finished(gl, *finish, split, {4, 4}, {4, 4},
                               scene::PresentStep::kDownsample);
    bool in_place = true;
    for (int y = 0; y < 4; ++y) {
      for (int x = 0; x < 4; ++x) {
        const int red = kept[static_cast<std::size_t>(y * 4 + x)];
        in_place = in_place && (x < 2 ? red == 255 : red == 0);
      }
    }
    check(in_place, "an average keeps each half of the picture where it was");
    free_picture(gl, split);
  }

  {
    // A one-pixel line at half size, brought up to the panel.
    std::vector<std::uint8_t> line(16 * 8, 0);
    for (int y = 0; y < 8; ++y) {
      line[static_cast<std::size_t>(y * 16 + 8)] = 255;
    }
    Picture small = picture(gl, {16, 8}, line);
    const auto sharp =
        finished(gl, *finish, small, {32, 16}, {32, 16}, scene::PresentStep::kFsr);
    const auto soft = blitted(gl, small, {32, 16}, kLinear);
    const auto peak = [](const std::vector<int>& row) {
      return *std::max_element(row.begin() + 32 * 8, row.begin() + 32 * 9);
    };
    std::printf("a one-pixel line at twice the size: FSR %d, bilinear %d\n",
                peak(sharp), peak(soft));
    check(peak(sharp) >= peak(soft) + 20,
          "FSR keeps more of a thin line's peak than a bilinear stretch");
    free_picture(gl, small);
  }

  {
    // A hard diagonal, smoothed where a copy leaves it stepped.
    std::vector<std::uint8_t> diagonal;
    for (int y = 0; y < 16; ++y) {
      for (int x = 0; x < 16; ++x) {
        diagonal.push_back(x * 2 > y ? 255 : 0);
      }
    }
    Picture edge = picture(gl, {16, 16}, diagonal);
    const auto smooth =
        finished(gl, *finish, edge, {16, 16}, {16, 16}, scene::PresentStep::kFxaa);
    const auto copied =
        finished(gl, *finish, edge, {16, 16}, {16, 16}, scene::PresentStep::kCopy);
    const auto softened = [](const std::vector<int>& pixels) {
      return std::count_if(pixels.begin(), pixels.end(),
                           [](int red) { return between(red, 20, 235); });
    };
    std::printf("pixels between black and white on the diagonal: FXAA %d, copy %d\n",
                static_cast<int>(softened(smooth)),
                static_cast<int>(softened(copied)));
    check(softened(smooth) >= 8, "FXAA smooths a hard diagonal");
    check(softened(copied) == 0, "a copy leaves it stepped (the control)");
    free_picture(gl, edge);
  }

  {
    // A canvas smaller than the window: stretched to fill it.
    std::vector<std::uint8_t> halves(8 * 8, 0);
    for (int y = 0; y < 8; ++y) {
      for (int x = 4; x < 8; ++x) {
        halves[static_cast<std::size_t>(y * 8 + x)] = 255;
      }
    }
    Picture small = picture(gl, {8, 8}, halves);
    const auto filled =
        finished(gl, *finish, small, {8, 8}, {32, 32}, scene::PresentStep::kCopy);
    check(filled.size() == 32 * 32 && filled[0] == 0 && filled[31] == 255 &&
              filled[32 * 31] == 0 && filled[32 * 32 - 1] == 255,
          "a canvas smaller than the window is stretched over all of it");
    free_picture(gl, small);
  }

  {
    scene::GpuClock clock(gl);
    std::vector<std::uint8_t> flat(64 * 64, 128);
    Picture input = picture(gl, {64, 64}, flat);
    clock.begin();
    finished(gl, *finish, input, {64, 64}, {64, 64}, scene::PresentStep::kFxaa);
    clock.mark();
    finished(gl, *finish, input, {64, 64}, {64, 64}, scene::PresentStep::kFxaa);
    clock.end();
    gl.Finish();
    // Answers become readable a poll or two after the GPU is through.
    scene::CostReading reading = clock.poll();
    for (int poll = 0; poll < 100 && clock.timed() && !reading.cost_ms; ++poll) {
      gl.Finish();
      reading = clock.poll();
    }
    std::printf("GPU clock: %s; frame %.3f ms, finishing %.3f ms\n",
                clock.timed() ? "timed by the GPU" : "fences only",
                reading.cost_ms.value_or(-1.0), reading.post_ms.value_or(-1.0));
    check(reading.behind == 0, "a frame the GPU is through with is retired");
    check(!clock.timed() || (reading.cost_ms && reading.post_ms &&
                             *reading.cost_ms >= *reading.post_ms),
          "and timed in two parts where Direct3D times it");
    clock.release();
    free_picture(gl, input);
  }

  finish->release();
  finish.reset();
  context.reset();
  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("scene finishing: averaged, sharpened, smoothed, stretched, timed\n");
  return 0;
}
