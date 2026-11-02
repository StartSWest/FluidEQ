/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>

// What a scene is handed for one frame, wherever it is drawn: the C++ twin of
// `ISceneFrame` and `frameSignals` (`src/renderer/graph/sceneGl.ts`,
// `sceneSignals.ts`).

namespace feq::scene {

inline constexpr std::size_t kSpectrumTexels = 512;
inline constexpr std::size_t kWaveformTexels = 128;

/** What a scene is handed for one frame (`ISceneFrame`, `frameSignals`). */
struct SceneFrame {
  double time_seconds = 0.0;
  double level = 0.0;
  double beat = 0.0;
  std::array<double, 3> bands{};
  std::array<double, 2> music_accent{};
  std::array<double, 2> music_run{};
  std::array<double, 3> accent{};
  double fade = 0.0;
  std::array<std::uint8_t, kSpectrumTexels> spectrum{};
  std::array<std::uint8_t, kSpectrumTexels> spectrum_slow{};
  std::array<std::uint8_t, kWaveformTexels> waveform{};
  std::array<double, 4> rhythm{};
  std::array<double, 3> drums{};
  std::array<double, 4> song{};
  std::array<double, 2> stereo{};
  std::array<double, 3> voice{};
  /** The pack's sliders, in the order `ScenePack::params` names them. */
  std::vector<double> params;
};

}  // namespace feq::scene
