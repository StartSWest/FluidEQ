/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/scene/live_frames.h"

#include <algorithm>
#include <cmath>
#include <limits>

namespace feq::scene {
namespace {

constexpr double kMinFrequency = 20.0;
constexpr double kMaxFrequency = 20000.0;

}  // namespace

std::vector<double> frequency_axis(double rate) {
  const double log_min = std::log10(kMinFrequency);
  const double log_max = std::log10(std::min(kMaxFrequency, rate / 2.0));
  std::vector<double> axis(kPointCount);
  for (std::size_t index = 0; index < kPointCount; ++index) {
    axis[index] = std::pow(
        10.0, log_min + (static_cast<double>(index) /
                         static_cast<double>(kPointCount - 1)) *
                            (log_max - log_min));
  }
  return axis;
}

std::vector<AxisCell> axis_cells(const std::vector<double>& axis, double rate,
                                 std::size_t fft_size) {
  const double bin_width = rate / static_cast<double>(fft_size);
  const double max_bin =
      std::max(1.0, static_cast<double>(fft_size) / 2.0 - 1.0);
  const auto clamp_bin = [max_bin](double bin, double low) {
    return std::min(max_bin, std::max(low, bin));
  };
  std::vector<AxisCell> cells(axis.size());
  for (std::size_t index = 0; index < axis.size(); ++index) {
    const double frequency = axis[index];
    const double lower =
        index == 0 ? frequency : std::sqrt(axis[index - 1] * frequency);
    const double upper = index == axis.size() - 1
                             ? frequency
                             : std::sqrt(frequency * axis[index + 1]);
    const double first = clamp_bin(js_round(lower / bin_width), 1.0);
    const double last = clamp_bin(js_round(upper / bin_width), first);
    cells[index] = {static_cast<std::size_t>(first),
                    static_cast<std::size_t>(last)};
  }
  return cells;
}

void absolute_levels(const std::vector<float>& frequency_data,
                     const std::vector<AxisCell>& cells,
                     std::vector<double>& out) {
  out.resize(cells.size());
  for (std::size_t index = 0; index < cells.size(); ++index) {
    const AxisCell& cell = cells[index];
    double power = 0.0;
    double count = 0.0;
    const std::size_t last =
        std::min(cell.last_bin, frequency_data.size() - 1);
    for (std::size_t bin = cell.first_bin; bin <= last; ++bin) {
      const double level = frequency_data[bin];
      if (std::isfinite(level)) {
        power += std::pow(10.0, level / 10.0);
        count += 1.0;
      }
    }
    out[index] = count > 0.0 ? 10.0 * std::log10(power / count)
                             : -std::numeric_limits<double>::infinity();
  }
}

std::optional<double> peak_level(const std::vector<float>& frequency_data) {
  double peak = -std::numeric_limits<double>::infinity();
  for (const float level : frequency_data) {
    if (std::isfinite(level) && level > peak) {
      peak = level;
    }
  }
  if (peak > kLiveSilenceDb) {
    return peak;
  }
  return std::nullopt;
}

void frequency_points(const std::vector<double>& levels,
                      double track_reference_db, std::vector<double>& out) {
  out.resize(levels.size());
  for (std::size_t index = 0; index < levels.size(); ++index) {
    const double level = levels[index];
    const double plotted = std::isfinite(level)
                               ? level - track_reference_db + kMaxGain
                               : kMinGain;
    out[index] = std::min(kMaxGain, std::max(kMinGain, plotted));
  }
}

void waveform_points(const std::vector<const std::vector<float>*>& channels,
                     std::vector<double>& out) {
  std::size_t samples = std::numeric_limits<std::size_t>::max();
  for (const auto* channel : channels) {
    samples = std::min(samples, channel->size());
  }
  if (channels.empty() || samples == 0) {
    std::fill(out.begin(), out.end(), 0.0);
    return;
  }
  const double bucket =
      static_cast<double>(samples) / static_cast<double>(out.size());
  for (std::size_t index = 0; index < out.size(); ++index) {
    const auto start =
        static_cast<std::size_t>(std::floor(static_cast<double>(index) * bucket));
    const std::size_t end = std::max(
        start + 1, static_cast<std::size_t>(
                       std::floor(static_cast<double>(index + 1) * bucket)));
    double peak = 0.0;
    for (std::size_t sample = start; sample < end; ++sample) {
      for (const auto* channel : channels) {
        peak = std::max(peak, std::abs(static_cast<double>((*channel)[sample])));
      }
    }
    out[index] = peak;
  }
}

}  // namespace feq::scene
