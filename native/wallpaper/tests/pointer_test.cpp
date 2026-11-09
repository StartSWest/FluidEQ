/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the desktop helper passes on of the mouse (`pointer.h`): only what
 * happens over its monitor's bare desktop, in that monitor's own pixels; a
 * press begun there followed until it is let go; and nothing of a press that
 * began on an icon or a window, which belongs to Explorer or that window.
 *
 * Each case that says "nothing" stands beside one that says something from
 * the same router, so a router that passed nothing on at all fails here.
 */

#include "../pointer.h"

#include <cstdio>
#include <cstring>
#include <string>

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

const RECT kMonitor{0, 0, 2560, 1440};

/** The router's lines for a run of reports, joined. */
struct Heard {
  std::string text;
  void operator()(const char* line) { text += line; }
};

wallpaper::PointerSample at(long x, long y, bool bare) {
  wallpaper::PointerSample sample;
  sample.at = POINT{x, y};
  sample.bare = bare;
  return sample;
}

wallpaper::PointerSample pressed(wallpaper::PointerSample sample, unsigned downs,
                                 unsigned ups = 0) {
  sample.downs = downs;
  sample.ups = ups;
  return sample;
}

void hovering_the_bare_desktop() {
  std::printf("hovering the bare desktop, then an icon, then back\n");
  wallpaper::PointerRouter router(kMonitor);
  Heard heard;
  router.feed(at(100, 200, true), heard);
  router.feed(at(101, 200, true), heard);
  // The cursor did not move: nothing new to tell.
  router.feed(at(101, 200, true), heard);
  router.feed(at(140, 200, false), heard);
  router.feed(at(150, 200, false), heard);
  router.feed(at(300, 400, true), heard);
  CHECK(heard.text ==
        "pointer:move 100 200 0 0\n"
        "pointer:move 101 200 0 0\n"
        "pointer:leave\n"
        "pointer:move 300 400 0 0\n");
}

void a_monitor_left_of_the_main_one() {
  std::printf("coordinates are the monitor's own, from its own corner\n");
  wallpaper::PointerRouter router(RECT{-1920, -200, 0, 880});
  Heard heard;
  router.feed(at(-1900, -190, true), heard);
  CHECK(heard.text == "pointer:move 20 10 0 0\n");
}

void a_drag_begun_on_the_desktop_is_followed() {
  std::printf("a drag begun on the bare desktop goes on over a window\n");
  wallpaper::PointerRouter router(kMonitor);
  Heard heard;
  auto press = pressed(at(500, 500, true), wallpaper::kLeftButton);
  press.ctrl = true;
  router.feed(press, heard);
  CHECK(router.holding());
  auto over_window = at(900, 520, false);
  over_window.ctrl = true;
  router.feed(over_window, heard);
  router.feed(pressed(at(910, 520, false), 0, wallpaper::kLeftButton), heard);
  CHECK(!router.holding());
  CHECK(heard.text ==
        "pointer:move 500 500 1 0\n"
        "pointer:down 500 500 1 1 0\n"
        "pointer:move 900 520 1 1\n"
        "pointer:move 910 520 0 1\n"
        "pointer:up 910 520 0 0 0\n"
        "pointer:leave\n");
}

void a_press_on_an_icon_is_never_passed_on() {
  std::printf("a press on an icon, dragged across the desktop, is Explorer's alone\n");
  wallpaper::PointerRouter router(kMonitor);
  Heard heard;
  router.feed(pressed(at(40, 40, false), wallpaper::kLeftButton), heard);
  // Dragged over bare desktop with the button down: still the icon's.
  router.feed(at(600, 300, true), heard);
  router.feed(at(610, 300, true), heard);
  router.feed(pressed(at(620, 300, true), 0, wallpaper::kLeftButton), heard);
  CHECK(heard.text.empty());
  CHECK(!router.holding());
  // The control: let go, the same spot is the scene's again.
  router.feed(at(621, 300, true), heard);
  CHECK(heard.text == "pointer:move 621 300 0 0\n");
}

void the_right_and_middle_buttons() {
  std::printf("the right and the middle button, numbered as a page numbers them\n");
  wallpaper::PointerRouter router(kMonitor);
  Heard heard;
  router.feed(pressed(at(10, 10, true), wallpaper::kRightButton), heard);
  router.feed(pressed(at(10, 10, true), wallpaper::kMiddleButton), heard);
  router.feed(pressed(at(10, 10, true), 0, wallpaper::kRightButton | wallpaper::kMiddleButton),
              heard);
  CHECK(heard.text ==
        "pointer:move 10 10 0 0\n"
        "pointer:down 10 10 0 2 2\n"
        "pointer:down 10 10 0 6 1\n"
        "pointer:up 10 10 0 2 1\n"
        "pointer:up 10 10 0 0 2\n");
}

void the_wheel() {
  std::printf("the wheel over the desktop, and over a window\n");
  wallpaper::PointerRouter router(kMonitor);
  Heard heard;
  auto over_window = at(10, 10, false);
  over_window.wheel = 120;
  router.feed(over_window, heard);
  CHECK(heard.text.empty());
  auto notch = at(20, 20, true);
  notch.wheel = -120;
  notch.ctrl = true;
  router.feed(notch, heard);
  CHECK(heard.text ==
        "pointer:move 20 20 1 0\n"
        "pointer:wheel 20 20 1 0 -120\n");
}

void stopping_mid_drag() {
  std::printf("stopping mid-drag: the page hears it leave, never a release\n");
  wallpaper::PointerRouter router(kMonitor);
  Heard heard;
  router.feed(pressed(at(300, 300, true), wallpaper::kLeftButton), heard);
  heard.text.clear();
  router.cancel(heard);
  CHECK(heard.text == "pointer:leave\n");
  CHECK(!router.holding());
  // The release of the press it stopped in the middle of is nobody's.
  router.feed(pressed(at(300, 300, false), 0, wallpaper::kLeftButton), heard);
  CHECK(heard.text == "pointer:leave\n");
  // Stopping with nothing passed on says nothing.
  wallpaper::PointerRouter quiet(kMonitor);
  Heard none;
  quiet.cancel(none);
  CHECK(none.text.empty());
}

void the_commands_main_writes() {
  std::printf("the commands main writes, and nothing else\n");
  const auto read = [](const char* text) {
    wallpaper::CommandReader reader;
    wallpaper::Command last = wallpaper::Command::none;
    for (const char* each = text; *each != '\0'; ++each) {
      const wallpaper::Command command = reader.feed(*each);
      if (command != wallpaper::Command::none) last = command;
      if (command == wallpaper::Command::invalid) break;
    }
    return last;
  };
  CHECK(read("show\n") == wallpaper::Command::show);
  CHECK(read("hide\n") == wallpaper::Command::hide);
  CHECK(read("touch\n") == wallpaper::Command::touch);
  CHECK(read("still\n") == wallpaper::Command::still);
  CHECK(read("show\nstill\n") == wallpaper::Command::still);
  CHECK(read("touc") == wallpaper::Command::none);
  CHECK(read("tou\n") == wallpaper::Command::invalid);
  CHECK(read("touches\n") == wallpaper::Command::invalid);
  // Too long is refused outright, never cut down to whatever command its
  // tail happens to spell.
  CHECK(read("abcde-show\n") == wallpaper::Command::invalid);
  CHECK(read("Show\n") == wallpaper::Command::invalid);
  CHECK(read("\n") == wallpaper::Command::invalid);
}

void raw_input_buttons() {
  std::printf("Raw Input's button flags\n");
  unsigned downs = 0;
  unsigned ups = 0;
  wallpaper::raw_buttons(RI_MOUSE_LEFT_BUTTON_DOWN | RI_MOUSE_RIGHT_BUTTON_UP, downs, ups);
  CHECK(downs == wallpaper::kLeftButton);
  CHECK(ups == wallpaper::kRightButton);
  wallpaper::raw_buttons(RI_MOUSE_MIDDLE_BUTTON_DOWN | RI_MOUSE_WHEEL, downs, ups);
  CHECK(downs == wallpaper::kMiddleButton);
  CHECK(ups == 0);
}

void icons_under_the_point() {
  std::printf("a point on an icon, and one beside it\n");
  const RECT icons[]{{0, 0, 75, 100}, {0, 100, 75, 200}};
  CHECK(wallpaper::over_any(POINT{10, 150}, icons, 2));
  CHECK(!wallpaper::over_any(POINT{80, 150}, icons, 2));
  CHECK(!wallpaper::over_any(POINT{10, 150}, icons, 0));
}

}  // namespace

int main() {
  hovering_the_bare_desktop();
  a_monitor_left_of_the_main_one();
  a_drag_begun_on_the_desktop_is_followed();
  a_press_on_an_icon_is_never_passed_on();
  the_right_and_middle_buttons();
  the_wheel();
  stopping_mid_drag();
  the_commands_main_writes();
  raw_input_buttons();
  icons_under_the_point();
  if (g_failures != 0) {
    std::printf("%d check(s) failed\n", g_failures);
    return 1;
  }
  std::printf("all checks passed\n");
  return 0;
}
