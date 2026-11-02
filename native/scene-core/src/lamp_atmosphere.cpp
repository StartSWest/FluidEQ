/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/scene/lamp_atmosphere.h"

#include <algorithm>
#include <cmath>
#include <cstddef>

#include "fluideq/scene/energy_levels.h"
#include "fluideq/scene/rhythm.h"

namespace feq::scene {
namespace {

/** `SCENE_TIME_WRAP_S`. */
constexpr double kTimeWrapSeconds = 3600.0;

/** `clockDaylight`'s hours, in minutes after local midnight. */
constexpr double kDawnStarts = 5.5 * 60.0;
constexpr double kDayStarts = 8.0 * 60.0;
constexpr double kDuskStarts = 17.5 * 60.0;
constexpr double kNightStarts = 20.0 * 60.0;

/** `FOLLOW_MS` and `ARRIVED` (`sceneDaylight.ts`). */
constexpr double kFollowMs = 350.0;
constexpr double kArrived = 0.01;

double eased(double value, double from, double to) {
  const double share = std::min(1.0, std::max(0.0, (value - from) / (to - from)));
  return share * share * (3.0 - 2.0 * share);
}

}  // namespace

void LampAtmosphere::apply(SceneFrame& frame, double delta_ms, bool silent,
                           const LampProfile& profile) {
  activity_ += ((silent ? 0.0 : 1.0) - activity_) *
               ease_factor(delta_ms, silent ? 900.0 : 180.0);
  const double idle_speed = profile.hold ? 0.0 : profile.idle_speed * 0.55;
  time_seconds_ = js_mod(
      time_seconds_ + (delta_ms / 1000.0) *
                          (idle_speed + (1.0 - idle_speed) * activity_),
      kTimeWrapSeconds);
  const double breathe =
      profile.hold ? 0.5 : 0.5 + 0.5 * std::sin(time_seconds_ * 0.55);
  const double resting = 0.08 + breathe * 0.04;
  const auto blend = [this](double level, double idle) {
    return level * activity_ + idle * (1.0 - activity_);
  };
  frame.time_seconds = time_seconds_;
  frame.level = blend(frame.level, resting);
  frame.beat = frame.beat * activity_;
  frame.bands = {blend(frame.bands[0], resting * 0.8),
                 blend(frame.bands[1], resting),
                 blend(frame.bands[2], resting * 0.65)};
}

double clock_daylight(int hours, int minutes, int seconds) {
  const double at = hours * 60.0 + minutes + seconds / 60.0;
  const double light = at < kDuskStarts
                           ? eased(at, kDawnStarts, kDayStarts)
                           : 1.0 - eased(at, kDuskStarts, kNightStarts);
  return light * 100.0;
}

double DaylightFollower::next(double target, double delta_ms) {
  if (!started_ || std::abs(value_ - target) < kArrived) {
    started_ = true;
    value_ = target;
  } else {
    value_ = target + (value_ - target) *
                          std::exp(-std::max(delta_ms, 0.0) / kFollowMs);
  }
  return value_;
}

void fill_swatch_grid(std::span<const Rgb> colours,
                      std::span<const std::uint8_t> spectrum, int width,
                      int height, std::vector<std::uint8_t>& into) {
  const std::span<const Rgb> used =
      colours.empty() ? std::span<const Rgb>(&kSwatchAccent, 1) : colours;
  into.resize(static_cast<std::size_t>(width) *
              static_cast<std::size_t>(height) * 3);
  const double last_colour = static_cast<double>(used.size() - 1);
  const double last_texel = static_cast<double>(spectrum.size() - 1);
  for (int x = 0; x < width; ++x) {
    const double along =
        width == 1 ? 0.0 : static_cast<double>(x) / (width - 1);
    const double position = along * last_colour;
    const double lower = std::floor(position);
    const auto lower_at = static_cast<std::size_t>(lower);
    const std::size_t upper_at = std::min(used.size() - 1, lower_at + 1);
    const double t = position - lower;
    std::array<double, 3> colour{};
    for (std::size_t channel = 0; channel < 3; ++channel) {
      colour[channel] = used[lower_at][channel] * (1.0 - t) +
                        used[upper_at][channel] * t;
    }
    const double texel = spectrum[static_cast<std::size_t>(
        std::min(last_texel, js_round(along * last_texel)))];
    const double reach = (texel / 255.0) * height;
    for (int y = 0; y < height; ++y) {
      const double from_bottom = height - y - 0.5;
      // Lit up to the level, glowing faintly above it.
      const double light = from_bottom <= reach ? 1.0 : 0.22;
      const std::size_t at = (static_cast<std::size_t>(y) *
                                  static_cast<std::size_t>(width) +
                              static_cast<std::size_t>(x)) *
                             3;
      for (std::size_t channel = 0; channel < 3; ++channel) {
        into[at + channel] =
            static_cast<std::uint8_t>(js_round(colour[channel] * light));
      }
    }
  }
}

}  // namespace feq::scene
