/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

// The texel rows of `live_frames.h`, written out here because they are
// templates over the row's width.

#include <algorithm>
#include <cmath>

#include "fluideq/scene/energy_levels.h"
#include "fluideq/scene/rhythm.h"

namespace feq::scene {
namespace texels {

/** `clampByte`: a unit value as a byte, NaN as silence. */
inline std::uint8_t clamp_byte(double unit) {
  if (!std::isfinite(unit)) {
    return 0;
  }
  return static_cast<std::uint8_t>(
      js_round(std::min(1.0, std::max(0.0, unit)) * 255.0));
}

/** Resamples `values` to `out` by index, end to end, through `unit`. */
template <std::size_t N, typename Unit>
void resample(const std::vector<double>& values,
              std::array<std::uint8_t, N>& out, Unit&& unit) {
  const std::size_t count = values.size();
  if (count == 0) {
    out.fill(0);
    return;
  }
  if (count == 1) {
    out.fill(clamp_byte(unit(values[0])));
    return;
  }
  const auto last = static_cast<double>(N - 1);
  for (std::size_t i = 0; i < N; ++i) {
    const double position =
        (static_cast<double>(i) / last) * static_cast<double>(count - 1);
    const double lower = std::floor(position);
    const auto low = static_cast<std::size_t>(lower);
    const std::size_t high = std::min(count - 1, low + 1);
    const double t = position - lower;
    out[i] = clamp_byte(unit(values[low] * (1.0 - t) + values[high] * t));
  }
}

}  // namespace texels

template <std::size_t N>
void spectrum_texels(const std::vector<double>& points,
                     std::array<std::uint8_t, N>& out) {
  const double depth = std::max(1e-6, kMaxGain - kMinGain);
  texels::resample(points, out,
                   [depth](double y) { return (y - kMinGain) / depth; });
}

template <std::size_t N>
void waveform_texels(const std::vector<double>& waveform,
                     std::array<std::uint8_t, N>& out) {
  texels::resample(waveform, out, [](double value) { return value; });
}

template <std::size_t N>
void SlowSpectrum<N>::ease(const std::array<std::uint8_t, N>& spectrum,
                           double elapsed_ms) {
  const double attack = ease_factor(elapsed_ms, 180.0);
  const double release = ease_factor(elapsed_ms, 420.0);
  for (std::size_t i = 0; i < N; ++i) {
    const double target = spectrum[i];
    if (!started_) {
      values_[i] = static_cast<float>(target);
    }
    const double value = values_[i];
    values_[i] = static_cast<float>(
        value + (target - value) * (target > value ? attack : release));
    bytes_[i] = static_cast<std::uint8_t>(js_round(values_[i]));
  }
  started_ = true;
}

}  // namespace feq::scene
