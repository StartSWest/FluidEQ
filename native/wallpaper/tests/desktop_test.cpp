/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The two decisions the desktop helper takes on its own: whether the window in
 * front covers a monitor (the background then pauses for a full-screen app),
 * and whether a background already sits between the icons and the backdrop.
 *
 * The second one had a bug worth pinning. Each monitor has its own background
 * window between the same two shell windows, and a helper that demanded the
 * slot directly under the icons took it from the other monitor's helper, which
 * took it back on the next reorder event, forever. Being anywhere between the
 * two is enough, so two backgrounds side by side both count as placed.
 */

#include "../desktop.h"

#include <cstdio>
#include <initializer_list>

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

const wchar_t kClass[] = L"FluidEQWallpaperDesktopTest";

void covering_a_monitor() {
  std::printf("a window covering a monitor, and one that does not\n");
  const RECT monitor{0, 0, 2560, 1440};
  CHECK(wallpaper::covers(RECT{0, 0, 2560, 1440}, monitor));
  // A maximised window's frame reaches past the monitor's edges.
  CHECK(wallpaper::covers(RECT{-8, -8, 2568, 1448}, monitor));
  // An ordinary maximised window leaves the taskbar showing.
  CHECK(!wallpaper::covers(RECT{0, 0, 2560, 1392}, monitor));
  CHECK(!wallpaper::covers(RECT{2560, 0, 5120, 1440}, monitor));
}

/** `covered` over a list, the way the helper hands it the windows it found. */
bool hidden_by(const RECT& work, std::initializer_list<RECT> windows) {
  RECT rects[16]{};
  int count = 0;
  for (const RECT& window : windows) rects[count++] = window;
  return wallpaper::covered(work, rects, count);
}

void nothing_of_the_desktop_in_sight() {
  std::printf("a desk whose windows leave nothing of the desktop showing\n");
  // The work area: the monitor without its taskbar strip.
  const RECT work{0, 0, 2560, 1392};

  // Nothing at all, and a window over half of it: the desktop is in sight.
  CHECK(!hidden_by(work, {}));
  CHECK(!hidden_by(work, {RECT{0, 0, 1280, 1392}}));
  // One maximised window, and one full-screen window past the edges.
  CHECK(hidden_by(work, {RECT{0, 0, 2560, 1392}}));
  CHECK(hidden_by(work, {RECT{-8, -8, 2568, 1448}}));
  // Two side by side, which is what a desk looks like most of the day.
  CHECK(hidden_by(work, {RECT{0, 0, 1280, 1392}, RECT{1280, 0, 2560, 1392}}));
  // A hair of desktop between them is desktop somebody can see.
  CHECK(!hidden_by(work, {RECT{0, 0, 1279, 1392}, RECT{1280, 0, 2560, 1392}}));
  // Overlapping windows in four corners, together covering everything.
  CHECK(hidden_by(work, {RECT{0, 0, 1300, 700}, RECT{1200, 0, 2560, 700},
                         RECT{0, 650, 1300, 1392}, RECT{1200, 650, 2560, 1392}}));
  // The same four, one of them short of the bottom edge.
  CHECK(!hidden_by(work, {RECT{0, 0, 1300, 700}, RECT{1200, 0, 2560, 700},
                          RECT{0, 650, 1300, 1300}, RECT{1200, 650, 2560, 1392}}));
  // A window on the monitor next door covers nothing of this one.
  CHECK(!hidden_by(work, {RECT{2560, 0, 5120, 1392}}));
  // A window covering the taskbar strip alone leaves the desktop showing.
  CHECK(!hidden_by(work, {RECT{0, 1392, 2560, 1440}}));
  // A monitor with no work area at all is never called hidden.
  CHECK(!hidden_by(RECT{0, 0, 0, 0}, {RECT{0, 0, 2560, 1392}}));
}

HWND child(HWND parent) {
  return CreateWindowExW(0, kClass, L"", WS_CHILD, 0, 0, 10, 10, parent,
                         nullptr, GetModuleHandleW(nullptr), nullptr);
}

/** Stacks `windows` top to bottom, and says whether Windows kept that order. */
bool stack(HWND parent, std::initializer_list<HWND> windows) {
  HWND above = HWND_TOP;
  for (HWND window : windows) {
    SetWindowPos(window, above, 0, 0, 0, 0,
                 SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
    above = window;
  }
  HWND sibling = GetWindow(parent, GW_CHILD);
  for (HWND window : windows) {
    if (sibling != window) return false;
    sibling = GetWindow(sibling, GW_HWNDNEXT);
  }
  return true;
}

void between_the_icons_and_the_backdrop() {
  std::printf("a background between the icons and the backdrop\n");
  WNDCLASSW type{};
  type.lpfnWndProc = DefWindowProcW;
  type.hInstance = GetModuleHandleW(nullptr);
  type.lpszClassName = kClass;
  CHECK(RegisterClassW(&type) != 0);
  // Never shown: stacking works the same on windows nobody can see.
  const HWND desktop =
      CreateWindowExW(0, kClass, L"", WS_OVERLAPPED, 0, 0, 100, 100, nullptr,
                      nullptr, GetModuleHandleW(nullptr), nullptr);
  CHECK(desktop != nullptr);
  const HWND icons = child(desktop);
  const HWND mine = child(desktop);
  const HWND neighbour = child(desktop);
  const HWND backdrop = child(desktop);

  CHECK(stack(desktop, {icons, mine, backdrop, neighbour}));
  CHECK(wallpaper::stacked_between(icons, mine, backdrop));

  // Another monitor's background directly under the icons: both are placed,
  // so neither helper moves anything and neither takes the slot back.
  CHECK(stack(desktop, {icons, neighbour, mine, backdrop}));
  CHECK(wallpaper::stacked_between(icons, mine, backdrop));
  CHECK(wallpaper::stacked_between(icons, neighbour, backdrop));

  CHECK(stack(desktop, {mine, icons, neighbour, backdrop}));
  CHECK(!wallpaper::stacked_between(icons, mine, backdrop));

  CHECK(stack(desktop, {icons, neighbour, backdrop, mine}));
  CHECK(!wallpaper::stacked_between(icons, mine, backdrop));

  DestroyWindow(desktop);
  UnregisterClassW(kClass, GetModuleHandleW(nullptr));
}

}  // namespace

int main() {
  covering_a_monitor();
  nothing_of_the_desktop_in_sight();
  between_the_icons_and_the_backdrop();
  if (g_failures != 0) {
    std::printf("%d check(s) failed\n", g_failures);
    return 1;
  }
  std::printf("all checks passed\n");
  return 0;
}
