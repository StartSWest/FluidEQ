/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/scene/draw_plan.h"

#include <algorithm>
#include <cmath>

namespace feq::scene {
namespace {

/** A 4K panel's pixels: the most any picture is drawn at. */
constexpr double kPixelBudget = 3840.0 * 2160.0;

/** `Math.round` for the positive sizes here: halves go up. */
int rounded(double value) { return static_cast<int>(std::floor(value + 0.5)); }

}  // namespace

DrawSize output_size(int panel_width, int panel_height) {
  const double pixels = std::max(
      1.0, static_cast<double>(panel_width) * static_cast<double>(panel_height));
  const double cap = std::min(1.0, std::sqrt(kPixelBudget / pixels));
  return {std::max(1, rounded(panel_width * cap)),
          std::max(1, rounded(panel_height * cap))};
}

double ladder_top(Smoothing smoothing, DrawSize output) {
  if (smoothing != Smoothing::kBest) {
    return 1.0;
  }
  const double supersample = std::min(
      kSupersample,
      std::sqrt(kPixelBudget / (static_cast<double>(output.width) *
                                static_cast<double>(output.height))));
  return supersample > 1.05 ? supersample : 1.0;
}

DrawSize drawn_size(DrawSize output, double scale) {
  return {std::max(1, rounded(output.width * scale)),
          std::max(1, rounded(output.height * scale))};
}

double chosen_scale(const DrawChoice& choice, double top, double ladder_scale) {
  if (!choice.pinned) {
    return ladder_scale;
  }
  // Full size is the only pin of 1; `best` smoothing draws it larger still.
  return *choice.pinned >= 1.0 ? top : *choice.pinned;
}

Finish finish_for(const DrawChoice& choice, double scale, bool cheap) {
  const bool supersampled = scale >= kSupersample - 0.05;
  return {choice.fsr && !cheap,
          choice.smoothing != Smoothing::kOff && !supersampled};
}

DrawSize canvas_size(DrawSize drawn, DrawSize output, Finish finish) {
  const bool smaller = drawn.width < output.width || drawn.height < output.height;
  return smaller && !finish.fsr ? drawn : output;
}

PresentPlan present_plan(DrawSize drawn, DrawSize canvas, Finish finish) {
  PresentPlan plan;
  const auto add = [&plan](PresentStep step) {
    plan.steps[static_cast<std::size_t>(plan.count)] = step;
    plan.count += 1;
  };
  const bool larger = drawn.width > canvas.width || drawn.height > canvas.height;
  const bool smaller = drawn.width < canvas.width || drawn.height < canvas.height;
  if (larger) {
    add(PresentStep::kDownsample);
  } else if (smaller && finish.fsr) {
    add(PresentStep::kFsr);
  }
  if (finish.fxaa) {
    add(PresentStep::kFxaa);
  } else if (plan.count == 0) {
    add(PresentStep::kCopy);
  }
  return plan;
}

}  // namespace feq::scene
