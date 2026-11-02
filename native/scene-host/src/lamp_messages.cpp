/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "lamp_messages.h"

#include <cmath>

#include "fluideq/scene/lamp_pacing.h"

namespace feq::scene::wire {
namespace {

/** Main never sends a scene's text past this; a shader is kilobytes. */
constexpr std::size_t kMaxSourceBytes = 4U * 1024U * 1024U;
constexpr std::size_t kMaxIdBytes = 256;

bool finite(double value) { return std::isfinite(value); }

}  // namespace

bool read_show(std::span<const std::uint8_t> payload, Show& show) {
  Reader reader(payload);
  show = {};
  show.id = reader.u32();
  const std::uint32_t colours = reader.u32();
  if (!reader.ok() || colours > kMaxSwatch) {
    return false;
  }
  const auto swatch = reader.bytes(static_cast<std::size_t>(colours) * 3);
  for (std::uint32_t at = 0; reader.ok() && at < colours; ++at) {
    show.swatch.push_back(
        {swatch[at * 3], swatch[at * 3 + 1], swatch[at * 3 + 2]});
  }
  const std::uint32_t has_scene = reader.u32();
  if (!reader.ok() || has_scene > 1) {
    return false;
  }
  if (has_scene == 0) {
    return reader.at_end();
  }
  ShownScene scene;
  const std::uint32_t flags = reader.u32();
  scene.guarded = (flags & 1U) != 0;
  scene.response.sensitivity = reader.f64();
  scene.response.threshold = reader.f64();
  scene.response.attack = reader.f64();
  scene.response.release = reader.f64();
  const std::uint32_t params = reader.u32();
  if (!reader.ok() || flags > 1 || params > kMaxParams ||
      !finite(scene.response.sensitivity) ||
      !finite(scene.response.threshold) || !finite(scene.response.attack) ||
      !finite(scene.response.release)) {
    return false;
  }
  for (std::uint32_t at = 0; at < params; ++at) {
    SceneParam param;
    param.id = reader.text();
    param.value = reader.f64();
    param.min = reader.f64();
    param.max = reader.f64();
    if (!reader.ok() || param.id.empty() || param.id.size() > kMaxIdBytes ||
        !finite(param.value) || !finite(param.min) || !finite(param.max)) {
      return false;
    }
    scene.params.push_back(std::move(param));
  }
  scene.vertex_source = reader.text();
  scene.fragment_source = reader.text();
  for (float& value : scene.view) {
    value = static_cast<float>(reader.f64());
  }
  for (float& value : scene.spectrum_rect) {
    value = static_cast<float>(reader.f64());
  }
  const std::uint32_t width = reader.u32();
  const std::uint32_t height = reader.u32();
  const std::uint32_t artwork_bytes = reader.u32();
  if (!reader.ok() || scene.vertex_source.size() > kMaxSourceBytes ||
      scene.fragment_source.size() > kMaxSourceBytes ||
      artwork_bytes > kMaxArtworkBytes || width > kMaxArtworkEdge ||
      height > kMaxArtworkEdge ||
      static_cast<std::uint64_t>(width) * height > kMaxArtworkPixels ||
      (artwork_bytes == 0) != (width == 0 || height == 0)) {
    return false;
  }
  for (const float value : scene.view) {
    if (!std::isfinite(value)) {
      return false;
    }
  }
  for (const float value : scene.spectrum_rect) {
    if (!std::isfinite(value)) {
      return false;
    }
  }
  const auto webp = reader.bytes(artwork_bytes);
  if (!reader.ok() || !reader.at_end()) {
    return false;
  }
  scene.artwork_width = static_cast<int>(width);
  scene.artwork_height = static_cast<int>(height);
  scene.webp.assign(webp.begin(), webp.end());
  show.scene = std::move(scene);
  return true;
}

bool read_daylight(std::span<const std::uint8_t> payload, Daylight& daylight) {
  Reader reader(payload);
  const std::uint32_t mode = reader.u32();
  daylight.value = reader.f64();
  if (!reader.ok() || !reader.at_end() || !finite(daylight.value) ||
      (mode != static_cast<std::uint32_t>(DaylightMode::kFixed) &&
       mode != static_cast<std::uint32_t>(DaylightMode::kClock))) {
    return false;
  }
  daylight.mode = static_cast<DaylightMode>(mode);
  return true;
}

bool read_flag(std::span<const std::uint8_t> payload, bool& flag) {
  Reader reader(payload);
  const std::uint32_t value = reader.u32();
  if (!reader.ok() || !reader.at_end() || value > 1) {
    return false;
  }
  flag = value == 1;
  return true;
}

bool read_profile(std::span<const std::uint8_t> payload, LampProfile& profile) {
  Reader reader(payload);
  const std::uint32_t hold = reader.u32();
  const double speed = reader.f64();
  if (!reader.ok() || !reader.at_end() || hold > 1 || !finite(speed)) {
    return false;
  }
  profile.hold = hold == 1;
  profile.idle_speed = speed;
  return true;
}

bool read_accent(std::span<const std::uint8_t> payload,
                 std::array<double, 3>& accent) {
  Reader reader(payload);
  std::array<double, 3> read{};
  for (double& value : read) {
    value = reader.f64();
  }
  if (!reader.ok() || !reader.at_end()) {
    return false;
  }
  for (const double value : read) {
    if (!finite(value)) {
      return false;
    }
  }
  accent = read;
  return true;
}

std::vector<std::uint8_t> grid_message(std::span<const std::uint8_t> rgb,
                                       const GridReading& reading) {
  Writer writer(Kind::kGrid);
  writer.u32(static_cast<std::uint32_t>(kLightingGridWidth));
  writer.u32(static_cast<std::uint32_t>(kLightingGridHeight));
  writer.f64(reading.level);
  writer.f64(reading.beat);
  writer.f64(reading.bands[0]);
  writer.f64(reading.bands[1]);
  writer.f64(reading.bands[2]);
  writer.f64(reading.delta_ms);
  writer.f64(reading.time_seconds);
  writer.f64(reading.activity);
  writer.u32(reading.drawn ? 1U : 0U);
  writer.bytes(rgb);
  return writer.finish();
}

std::vector<std::uint8_t> picture_message(std::span<const std::uint8_t> rgb,
                                          int width, int height) {
  Writer writer(Kind::kPicture);
  writer.u32(static_cast<std::uint32_t>(width));
  writer.u32(static_cast<std::uint32_t>(height));
  writer.bytes(rgb);
  return writer.finish();
}

std::vector<std::uint8_t> loaded_message(std::uint32_t id) {
  Writer writer(Kind::kLoaded);
  writer.u32(id);
  return writer.finish();
}

std::vector<std::uint8_t> failed_message(std::uint32_t id, FailReason reason,
                                         const std::string& words) {
  Writer writer(Kind::kFailed);
  writer.u32(id);
  writer.u32(static_cast<std::uint32_t>(reason));
  // The compiler's words are for the log: a page of them is plenty.
  writer.text(words.substr(0, 4096));
  return writer.finish();
}

}  // namespace feq::scene::wire
