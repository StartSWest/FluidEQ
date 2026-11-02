/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "desktop_messages.h"

#include <cmath>

namespace feq::scene::wire {
namespace {

/** No monitor is larger than this in either direction (16K and then some). */
constexpr std::uint32_t kLargestSide = 32768;

}  // namespace

bool read_monitor(std::span<const std::uint8_t> payload, ForMonitor& out) {
  Reader reader(payload);
  out.monitor = reader.u32();
  if (!reader.ok()) {
    return false;
  }
  out.rest = payload.subspan(4);
  return true;
}

bool read_monitor_open(std::span<const std::uint8_t> payload, MonitorOpen& out) {
  Reader reader(payload);
  out.monitor = reader.u32();
  out.x = static_cast<std::int32_t>(reader.u32());
  out.y = static_cast<std::int32_t>(reader.u32());
  out.width = reader.u32();
  out.height = reader.u32();
  out.scale = reader.f64();
  return reader.ok() && reader.at_end() && out.width > 0 && out.height > 0 &&
         out.width <= kLargestSide && out.height <= kLargestSide &&
         std::isfinite(out.scale) && out.scale >= 0.25 && out.scale <= 1.0;
}

bool read_scale(std::span<const std::uint8_t> payload, double& scale) {
  Reader reader(payload);
  scale = reader.f64();
  return reader.ok() && reader.at_end() && std::isfinite(scale) &&
         scale >= 0.25 && scale <= 1.0;
}

std::vector<std::uint8_t> monitor_window_message(std::uint32_t monitor,
                                                 std::uint64_t window) {
  Writer writer(Kind::kMonitorWindow);
  writer.u32(monitor);
  writer.u32(static_cast<std::uint32_t>(window & 0xFFFFFFFFU));
  writer.u32(static_cast<std::uint32_t>(window >> 32U));
  return writer.finish();
}

std::vector<std::uint8_t> monitor_loaded_message(std::uint32_t monitor,
                                                 std::uint32_t id) {
  Writer writer(Kind::kMonitorLoaded);
  writer.u32(monitor);
  writer.u32(id);
  return writer.finish();
}

std::vector<std::uint8_t> monitor_drawn_message(std::uint32_t monitor,
                                                std::uint32_t id) {
  Writer writer(Kind::kMonitorDrawn);
  writer.u32(monitor);
  writer.u32(id);
  return writer.finish();
}

std::vector<std::uint8_t> monitor_failed_message(std::uint32_t monitor,
                                                 std::uint32_t id,
                                                 FailReason reason,
                                                 const std::string& words) {
  Writer writer(Kind::kMonitorFailed);
  writer.u32(monitor);
  writer.u32(id);
  writer.u32(static_cast<std::uint32_t>(reason));
  writer.text(words);
  return writer.finish();
}

}  // namespace feq::scene::wire
