/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// A monitor's scene sized and paced frame by frame, as the window's scene
// runner does it: FluidEQ's own from the supersampled top and down when the
// GPU says so; anybody else's from the listener's smallest size; a size a
// program has proved taken up again when the program comes back (another
// program, the control, does not); a preset pinned whatever the ladder
// says; thirty a second when chosen, on the slow rung, and after ten
// seconds of silence; and a scene too slow even at the bottom handed over.

#include <cstdio>

#include "desktop_sizing.h"

namespace {

namespace scene = feq::scene;

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

constexpr scene::DrawSize kPanel{1920, 1080};
constexpr double kFrameMs = 1000.0 / 120.0;

/** `frames` frames of `cost_ms` each, `kFrameMs` apart from `now`. */
bool run(scene::DesktopSizing& sizing, double& now, int frames, double cost_ms,
         bool quiet = false) {
  bool handed_over = false;
  for (int at = 0; at < frames && !handed_over; ++at) {
    sizing.plan(kPanel);
    now += kFrameMs;
    handed_over = sizing.judged({cost_ms, std::nullopt, 0}, now, true, quiet);
  }
  return handed_over;
}

}  // namespace

int main() {
  double now = 0.0;
  {
    scene::DesktopSizing sizing;
    sizing.start(1, true);
    const scene::FramePlan first = sizing.plan(kPanel);
    check(first.scale == 2.0 && first.drawn.width == 3840 &&
              first.drawn.height == 2160 && !first.finish.fxaa,
          "FluidEQ's own scene starts at best smoothing's full supersample");
    run(sizing, now, 12, 30.0);
    check(sizing.plan(kPanel).scale < 1.0,
          "and steps down when the GPU cannot keep up");
  }
  {
    scene::DesktopSizing sizing;
    sizing.start(2, false);
    check(sizing.plan(kPanel).scale == 0.35,
          "anybody else's starts at the smallest size the listener allows");
    run(sizing, now, 200, 0.5);
    check(sizing.plan(kPanel).scale == 2.0, "and climbs while it runs smoothly");
    run(sizing, now, 30, 0.5);
    sizing.start(3, false);
    check(sizing.plan(kPanel).scale == 0.35,
          "another program starts from the bottom (the control)");
    sizing.start(2, false);
    check(sizing.plan(kPanel).scale == 2.0,
          "the program that proved its size starts there again");
  }
  {
    scene::DesktopSizing sizing;
    scene::DrawChoice balanced;
    balanced.pinned = 0.67;
    sizing.choose(balanced);
    sizing.start(4, true);
    run(sizing, now, 12, 30.0);
    check(sizing.plan(kPanel).scale == 0.67, "a preset holds whatever the ladder says");
    scene::DrawChoice native;
    native.pinned = 1.0;
    sizing.choose(native);
    check(sizing.plan(kPanel).scale == 2.0,
          "full size is still drawn larger for best smoothing");
  }
  {
    scene::DesktopSizing sizing;
    sizing.start(5, true);
    check(sizing.pace_ms() == 0.0, "every refresh the monitor offers, by default");
    scene::DrawChoice thirty;
    thirty.pace_ms = 1000.0 / 30.0;
    sizing.choose(thirty);
    check(sizing.pace_ms() == 1000.0 / 30.0, "thirty a second when chosen");
    sizing.choose({});
    run(sizing, now, 1300, 0.5, true);
    check(sizing.pace_ms() == scene::kRestPaceMs,
          "thirty a second after ten seconds of silence");
    run(sizing, now, 1, 0.5, false);
    check(sizing.pace_ms() == 0.0, "and every refresh again with the first sound");
  }
  {
    scene::DesktopSizing sizing;
    sizing.start(6, true);
    run(sizing, now, 120, 3000.0);
    check(sizing.pace_ms() == scene::kSlowPaceMs,
          "a scene too heavy for the smallest picture is held to thirty");
    check(run(sizing, now, 200, 3000.0),
          "and handed over when even that is too slow");
  }
  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("desktop sizing: started, stepped, proved, pinned, paced, handed over\n");
  return 0;
}
