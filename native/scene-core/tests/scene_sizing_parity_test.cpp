/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The desktop scenes' size ladders, pacing, rest and draw sizes in C++,
// against what the window's own TypeScript answers to the same inputs
// (`scene_sizing_fixture.h`, written by
// `src/renderer/graph/sceneSizingFixture.ts`). Every answer is a decision or
// a size, so every one is held exactly: a ladder that steps one frame later
// than the window's is a different picture on the desktop.

#include <cmath>
#include <cstdio>
#include <memory>
#include <optional>
#include <span>

#include "fluideq/scene/draw_plan.h"
#include "fluideq/scene/frame_pacing.h"
#include "fluideq/scene/size_ladder.h"
#include "scene_sizing_fixture.h"

namespace {

using namespace feq::scene;
namespace fx = feq::scene::fixture;

int failures = 0;

void expect(bool ok, const char* what, std::size_t row) {
  if (!ok) {
    ++failures;
    if (failures <= 20) {
      std::printf("FAIL: %s (row %zu)\n", what, row);
    }
  }
}

std::optional<double> maybe(double value) {
  return value < 0.0 ? std::nullopt : std::optional<double>(value);
}

void ladders() {
  for (const auto& run : fx::kLadderRuns) {
    const bool warmup = run[0] != 0.0;
    const auto first = static_cast<std::size_t>(run[3]);
    const auto count = static_cast<std::size_t>(run[4]);
    std::unique_ptr<SizeLadder> ladder =
        warmup ? make_warmup_ladder(run[1], run[2]) : make_cost_ladder(run[1], run[2]);
    for (std::size_t at = first; at < first + count; ++at) {
      const auto& frame = fx::kLadderFrames[at];
      const int action = static_cast<int>(frame[5]);
      if (action == 1) {
        ladder->refloor(frame[6]);
      } else if (action == 2) {
        ladder->resume(frame[6]);
      } else if (action == 3) {
        ladder->reset();
      }
      const CostReading reading{maybe(frame[0]), maybe(frame[1]),
                                static_cast<int>(frame[2])};
      const bool degraded = ladder->frame(reading, frame[3], frame[4] != 0.0);
      expect(ladder->scale() == frame[7], "the ladder's scale", at);
      expect(ladder->slowed() == (frame[8] != 0.0), "slowed", at);
      expect(degraded == (frame[9] != 0.0), "handed over", at);
      expect(ladder->cheap_finish() == (frame[10] != 0.0), "cheap finish", at);
    }
  }
}

void pacing() {
  FrameCadence cadence;
  std::size_t row = 0;
  for (const auto& [gap, interval] : fx::kCadence) {
    if (gap == -1000.0) {
      cadence.reset();
    } else {
      cadence.note(gap);
    }
    expect(cadence.interval_ms() == interval, "the cadence's interval", row++);
  }
  RestWatch rest;
  row = 0;
  for (const auto& [now, silent, resting] : fx::kRest) {
    expect(rest.frame(now, silent != 0.0) == (resting != 0.0), "resting", row);
    expect(rest.resting() == (resting != 0.0), "still resting", row++);
  }
  row = 0;
  for (const auto& [elapsed, pace, tick, due] : fx::kFrameDue) {
    expect(is_frame_due(elapsed, pace, tick) == (due != 0.0), "due", row++);
  }
  row = 0;
  for (const auto& [now, last, previous, tick] : fx::kDisplayTick) {
    expect(display_tick_ms(now, maybe(last), previous) == tick, "the tick", row++);
  }
  row = 0;
  for (const auto& [display, drawn, judged] : fx::kJudgedInterval) {
    expect(judged_interval_ms(display, maybe(drawn)) == judged, "judged", row++);
  }
  row = 0;
  for (const auto& peaks : fx::kSilence) {
    expect(is_silent_waveform(std::span<const double>(peaks, 8)) ==
               (peaks[8] != 0.0),
           "silence", row++);
  }
}

constexpr Smoothing kSmoothings[]{Smoothing::kOff, Smoothing::kFast,
                                  Smoothing::kBest};

void draw_plans() {
  std::size_t row = 0;
  for (const auto& plan : fx::kDrawPlans) {
    DrawChoice choice;
    if (plan[2] >= 0.0) {
      choice.pinned = plan[2];
    }
    choice.smoothing = kSmoothings[static_cast<int>(plan[3])];
    choice.fsr = plan[4] != 0.0;
    const DrawSize output =
        output_size(static_cast<int>(plan[0]), static_cast<int>(plan[1]));
    const double top = ladder_top(choice.smoothing, output);
    const double scale = chosen_scale(choice, top, plan[5]);
    const DrawSize drawn = drawn_size(output, scale);
    const Finish finish = finish_for(choice, scale, plan[6] != 0.0);
    const DrawSize canvas = canvas_size(drawn, output, finish);
    const PresentPlan steps = present_plan(drawn, canvas, finish);
    expect(output.width == plan[7] && output.height == plan[8], "output", row);
    expect(top == plan[9], "top", row);
    expect(scale == plan[10], "scale", row);
    expect(drawn.width == plan[11] && drawn.height == plan[12], "drawn", row);
    expect(finish.fsr == (plan[13] != 0.0) && finish.fxaa == (plan[14] != 0.0),
           "finish", row);
    expect(canvas.width == plan[15] && canvas.height == plan[16], "canvas", row);
    for (int at = 0; at < 2; ++at) {
      const double wanted = plan[17 + at];
      const double got =
          at < steps.count
              ? static_cast<double>(static_cast<int>(steps.steps[static_cast<std::size_t>(at)]))
              : -1.0;
      expect(got == wanted, "a pass", row);
    }
    ++row;
  }
}

}  // namespace

int main() {
  ladders();
  pacing();
  draw_plans();
  if (failures > 0) {
    std::printf("%d answers differ from the window's\n", failures);
    return 1;
  }
  std::printf("scene sizing parity: all answers match\n");
  return 0;
}
