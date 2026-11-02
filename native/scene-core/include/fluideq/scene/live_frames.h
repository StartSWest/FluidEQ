/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <vector>

/*
 * A frame of the music as a scene's textures carry it: the twin of
 * `src/common/liveFrames.ts` (the axis, its cells, the levels against the
 * track's own loudest, the waveform's peaks) and of
 * `src/renderer/graph/sceneUniforms.ts` and `sceneSignals.ts` (the R8 rows a
 * scene samples, and the eased copy it gets as uSpectrumSlow).
 */

namespace feq::scene {

inline constexpr std::size_t kFftSize = 2048;
inline constexpr std::size_t kPointCount = 320;
inline constexpr std::size_t kWaveformPointCount = 96;
inline constexpr double kMinGain = -20.0;
inline constexpr double kMaxGain = 20.0;
/** The audio clock's ticks: thirty a second. */
inline constexpr double kUpdateIntervalMs = 1000.0 / 30.0;
inline constexpr double kTrackReferenceReleaseDb = kUpdateIntervalMs / 1000.0;
inline constexpr double kLiveSilenceDb = -95.0;

struct AxisCell {
  std::size_t first_bin;
  std::size_t last_bin;
};

std::vector<double> frequency_axis(double rate);
std::vector<AxisCell> axis_cells(const std::vector<double>& axis, double rate,
                                 std::size_t fft_size);
/** Each cell's mean power, in dB; -infinity for a cell of no finite bin. */
void absolute_levels(const std::vector<float>& frequency_data,
                     const std::vector<AxisCell>& cells,
                     std::vector<double>& out);
/** The loudest finite bin, or nothing at or under kLiveSilenceDb. */
std::optional<double> peak_level(const std::vector<float>& frequency_data);
/** The levels as plotted against the track's own loudest, in dB. */
void frequency_points(const std::vector<double>& levels,
                      double track_reference_db, std::vector<double>& out);
/** Each bucket's peak across the channels. */
void waveform_points(const std::vector<const std::vector<float>*>& channels,
                     std::vector<double>& out);

/** `fillSpectrumTexels`: dB over the gain range into 0..255, by index. */
template <std::size_t N>
void spectrum_texels(const std::vector<double>& points,
                     std::array<std::uint8_t, N>& out);
/** `fillWaveformTexels`: 0..1 into 0..255, stretched end to end. */
template <std::size_t N>
void waveform_texels(const std::vector<double>& waveform,
                     std::array<std::uint8_t, N>& out);

/** `createSlowSpectrum`: the spectrum eased, 180 ms up and 420 ms down. */
template <std::size_t N>
class SlowSpectrum {
 public:
  void ease(const std::array<std::uint8_t, N>& spectrum, double elapsed_ms);
  const std::array<std::uint8_t, N>& bytes() const { return bytes_; }

 private:
  std::array<float, N> values_{};
  std::array<std::uint8_t, N> bytes_{};
  bool started_ = false;
};

}  // namespace feq::scene

#include "fluideq/scene/live_frames_texels.h"
