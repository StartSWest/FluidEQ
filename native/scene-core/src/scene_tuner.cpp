/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/scene/scene_tuner.h"

#include <algorithm>
#include <cmath>

#include "fluideq/scene/energy_levels.h"
#include "fluideq/scene/rhythm.h"

namespace feq::scene {
namespace {

/** `SCENE_DAYLIGHT_PARAM`. */
constexpr const char* kDaylightParam = "daylight";

double half_life_of(double ms) { return ms / std::log2(10.0); }

double gate(double value, const SceneResponse& response) {
  const double gained = std::min(1.0, value * response.sensitivity);
  return gained <= response.threshold
             ? 0.0
             : (gained - response.threshold) / (1.0 - response.threshold);
}

double follow(double from, double to, double elapsed_ms,
              const SceneResponse& response) {
  return from + (to - from) *
                    ease_factor(elapsed_ms,
                                half_life_of(to > from ? response.attack
                                                       : response.release));
}

}  // namespace

SceneTuner::SceneTuner(const SceneResponse& response,
                       std::vector<SceneParam> params)
    : response_(response),
      neutral_(response.sensitivity == 1.0 && response.threshold == 0.0 &&
               response.attack == 0.0 && response.release == 0.0),
      params_(std::move(params)) {}

void SceneTuner::apply(SceneFrame& frame, double delta_ms,
                       std::optional<double> daylight) {
  if (!neutral_) {
    const double gated_level = gate(frame.level, response_);
    level_ = follow(level_, gated_level, delta_ms, response_);
    for (std::size_t index = 0; index < 3; ++index) {
      bands_[index] = follow(bands_[index], gate(frame.bands[index], response_),
                             delta_ms, response_);
    }
    for (std::size_t texel = 0; texel < kSpectrumTexels; ++texel) {
      spectrum_[texel] = static_cast<float>(follow(
          spectrum_[texel], gate(frame.spectrum[texel] / 255.0, response_),
          delta_ms, response_));
      frame.spectrum[texel] =
          static_cast<std::uint8_t>(js_round(spectrum_[texel] * 255.0));
    }
    for (std::uint8_t& sample : frame.waveform) {
      sample = static_cast<std::uint8_t>(
          std::min(255.0, js_round(sample * response_.sensitivity)));
    }
    const bool resting = gated_level <= 0.0;
    frame.level = level_;
    if (resting) {
      frame.beat = 0.0;
      frame.drums = {0.0, 0.0, 0.0};
    }
    frame.bands = bands_;
  }
  frame.params.resize(params_.size());
  for (std::size_t at = 0; at < params_.size(); ++at) {
    const SceneParam& param = params_[at];
    frame.params[at] = param.id == kDaylightParam && daylight.has_value()
                           ? std::min(param.max, std::max(param.min, *daylight))
                           : param.value;
  }
}

}  // namespace feq::scene
