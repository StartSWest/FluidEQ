/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
#include <cstddef>
#include <optional>
#include <vector>

#include "fluideq/scene/sound_hops.h"

/*
 * The music's level and its bass, mid and treble, as a scene is handed them:
 * the C++ twin of `src/common/energyLevels.ts` (with `bassNotes.ts` and
 * `smoothing.ts`'s ease). What that file stores in a Float32Array is stored
 * as a float here, and summed as a double, as JavaScript sums it, so the two
 * land on the same numbers (`scene_core_parity_test.cpp`).
 */

namespace feq::scene {

/** `getEaseFactor`: how far to move towards a target in `delta_ms`. */
double ease_factor(double delta_ms, double half_life_ms);

/** `isBassBin`: whether the note `bin` belongs to is a bass note. */
bool is_bass_bin(const std::vector<float>& bins, double bin_hz,
                 std::size_t bin);

enum class LevelPart : std::size_t { kBass = 0, kMid = 1, kTreble = 2 };

struct LevelState {
  double level = 0.0;
  double bass = 0.0;
  double mid = 0.0;
  double treble = 0.0;
  /** The loudest the music has been lately, in dB, falling slowly. */
  std::optional<double> ceiling;
  /** Each part's usual level, in dB, once it has been heard. */
  std::array<std::optional<double>, 3> usual{};
  /** The mid's bins over the last few hops, for their median. */
  std::vector<float> mid_history;
  std::size_t mid_at = 0;
};

/** `followLevels`, from a hop's bands and its two windows' bins. */
void follow_levels(LevelState& state, const SoundHop& hop, double step_ms);

}  // namespace feq::scene
