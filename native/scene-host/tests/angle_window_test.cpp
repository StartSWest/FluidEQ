/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The ANGLE context drawing into a window instead of off screen, as a
// desktop background draws: made current on a window that is never shown,
// a frame cleared and read back from it, presented, and the window let go
// with the context still able to draw off screen.

#define NOMINMAX
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <array>
#include <cstdio>
#include <memory>
#include <string>

#include "angle_api.h"

namespace {

namespace gl = feq::scene::gl;

int failures = 0;

void check(bool ok, const std::string& what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what.c_str());
    ++failures;
  }
}

HWND hidden_window(int width, int height) {
  WNDCLASSEXW type{};
  type.cbSize = sizeof(type);
  type.lpfnWndProc = DefWindowProcW;
  type.hInstance = GetModuleHandleW(nullptr);
  type.lpszClassName = L"FluidEQ-Angle-Window-Test";
  RegisterClassExW(&type);
  return CreateWindowExW(0, type.lpszClassName, L"", WS_POPUP, 0, 0, width,
                         height, nullptr, nullptr, type.hInstance, nullptr);
}

/** The colour at the window's middle after clearing to `rgb`. */
std::array<unsigned char, 4> cleared(const gl::Api& api, float r, float g,
                                     float b, int width, int height) {
  api.BindFramebuffer(gl::kFramebuffer, 0);
  api.Viewport(0, 0, width, height);
  api.ClearColor(r, g, b, 1.0F);
  api.Clear(gl::kColorBufferBit);
  std::array<unsigned char, 4> pixel{};
  api.ReadPixels(width / 2, height / 2, 1, 1, gl::kRgba, gl::kUnsignedByte,
                 pixel.data());
  return pixel;
}

}  // namespace

int main() {
  std::string why;
  std::unique_ptr<gl::Context> context(
      gl::Context::create(FEQ_TEST_ANGLE_DIR, 64, 36, why));
  if (!context) {
    std::printf("FAIL: no context: %s\n", why.c_str());
    return 1;
  }
  const HWND window = hidden_window(320, 180);
  check(window != nullptr, "a window to draw into");
  check(context->draw_into(window), "the context draws into the window");
  const auto pixel = cleared(context->gl(), 1.0F, 0.0F, 0.5F, 320, 180);
  check(pixel[0] == 255 && pixel[1] == 0 && pixel[2] >= 126 && pixel[2] <= 129,
        "what is drawn into the window is what is read back from it");
  check(context->present(), "the frame is presented");
  check(context->gl().GetError() == 0, "and nothing went wrong on the way");

  // Back off screen, as a monitor that goes away leaves it.
  check(context->resize(64, 36), "the context draws off screen again");
  const auto after = cleared(context->gl(), 0.0F, 1.0F, 0.0F, 64, 36);
  check(after[1] == 255 && after[0] == 0, "and what it draws there is read back");
  DestroyWindow(window);
  context.reset();
  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("angle window: drawn into a window, presented, and back off screen\n");
  return 0;
}
