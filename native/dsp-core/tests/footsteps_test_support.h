/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What every Footsteps test measures with: the stage run a block at a time,
 * the steps band, and where a step's front and echo are.
 */
#ifndef FLUIDEQ_FOOTSTEPS_TEST_SUPPORT_H
#define FLUIDEQ_FOOTSTEPS_TEST_SUPPORT_H

#include <cstdint>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/footsteps.h"
#include "footsteps_scene.h"

namespace feq_footsteps_test {

constexpr double kStepsHz = 2400.0;
constexpr double kStepsQ = 0.75;
/** Where a sound's front is measured, and where its echo is. */
constexpr double kDirectS = 0.06;
constexpr double kTailFromS = 0.2;
constexpr double kTailToS = 0.34;

inline FeqFootstepsSettings competitive() {
  FeqFootstepsSettings settings{};
  feq_footsteps_settings_defaults(&settings);
  settings.enabled = 1;
  return settings;
}

inline uint32_t block_for(double rate) {
  return static_cast<uint32_t>(480.0 * rate / 48000.0);
}

/** A signal through a stage, a block at a time; what came out. */
inline feq_test::Signal run(const feq_test::Signal& in, double rate,
                            const FeqFootstepsSettings& settings) {
  FeqFootsteps* stage = feq_footsteps_create(rate, 2);
  feq_footsteps_configure(stage, &settings);
  feq_test::Signal out = in;
  const uint32_t block = block_for(rate);
  for (size_t at = 0; at + block <= out.left.size(); at += block) {
    float* channels[2] = {out.left.data() + at, out.right.data() + at};
    feq_footsteps_process(stage, channels, block);
  }
  feq_footsteps_destroy(stage);
  return out;
}

inline std::vector<double> starts(const Scene& scene, Kind kind) {
  std::vector<double> at;
  for (const Event& event : scene.events) {
    if (event.kind == kind) at.push_back(event.at);
  }
  return at;
}

inline double front_gain(const Scene& scene, const feq_test::Signal& out,
                         double at) {
  return band_gain_db(scene.mix, out, scene.rate, kStepsHz, kStepsQ, at,
                      at + kDirectS);
}

/** The first run of steps, in the rain and nothing else, 0.7 to 3 s. */
inline std::vector<double> quiet_steps(const Scene& scene) {
  std::vector<double> at;
  for (const double t : starts(scene, Kind::kStep)) {
    if (t < 3.0) at.push_back(t);
  }
  return at;
}

}  // namespace feq_footsteps_test

#endif  // FLUIDEQ_FOOTSTEPS_TEST_SUPPORT_H
