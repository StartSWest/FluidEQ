/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <optional>
#include <string>
#include <vector>

#include "fluideq/scene/scene_frame.h"

/*
 * A scene's own response to the music, and its sliders, put on a frame
 * before it is drawn: the C++ twin of `src/common/sceneResponse.ts` and of
 * `src/renderer/graph/sceneTuner.ts` as the lamps use it (no viewer's
 * tuning; the Brightness the window sets as `daylight`).
 */

namespace feq::scene {

struct SceneResponse {
  double sensitivity = 1.0;
  double threshold = 0.0;
  double attack = 0.0;
  double release = 0.0;
};

/** One of the pack's sliders, as `IScenePack.params` lists it. */
struct SceneParam {
  std::string id;
  double value = 0.0;
  double min = 0.0;
  double max = 1.0;
};

class SceneTuner {
 public:
  /** For a pack answering with `response`, sliders `params` in order. */
  SceneTuner(const SceneResponse& response, std::vector<SceneParam> params);

  /**
   * The frame as the scene answers it, `delta_ms` of audio after the last;
   * `daylight` the window's time of day, for a scene that has the slider.
   */
  void apply(SceneFrame& frame, double delta_ms,
             std::optional<double> daylight);

 private:
  SceneResponse response_;
  bool neutral_;
  std::vector<SceneParam> params_;
  double level_ = 0.0;
  std::array<double, 3> bands_{};
  std::array<float, kSpectrumTexels> spectrum_{};
};

}  // namespace feq::scene
