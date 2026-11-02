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

namespace {

/** The slowest pace a listener can choose is thirty a second; a second is absurd. */
constexpr double kLongestPaceMs = 1000.0;

/**
 * f64 pinned share (negative: the ladder decides), f64 auto floor, u32 FSR,
 * u32 smoothing (0 off, 1 fast, 2 best), f64 pace ms.
 */
bool read_choice_from(Reader& reader, DrawChoice& choice) {
  const double pinned = reader.f64();
  choice.auto_floor = reader.f64();
  const std::uint32_t fsr = reader.u32();
  const std::uint32_t smoothing = reader.u32();
  choice.pace_ms = reader.f64();
  if (!reader.ok() || !std::isfinite(pinned) ||
      !std::isfinite(choice.auto_floor) || !std::isfinite(choice.pace_ms) ||
      fsr > 1 || smoothing > 2 || choice.auto_floor < 0.0 ||
      choice.auto_floor > 1.0 || choice.pace_ms < 0.0 ||
      choice.pace_ms > kLongestPaceMs) {
    return false;
  }
  if (pinned < 0.0) {
    choice.pinned.reset();
  } else if (pinned >= 0.25 && pinned <= 1.0) {
    choice.pinned = pinned;
  } else {
    return false;
  }
  choice.fsr = fsr == 1;
  choice.smoothing = static_cast<Smoothing>(smoothing);
  return true;
}

}  // namespace

bool read_monitor_open(std::span<const std::uint8_t> payload, MonitorOpen& out) {
  Reader reader(payload);
  out.monitor = reader.u32();
  out.x = static_cast<std::int32_t>(reader.u32());
  out.y = static_cast<std::int32_t>(reader.u32());
  out.width = reader.u32();
  out.height = reader.u32();
  return read_choice_from(reader, out.choice) && reader.at_end() &&
         out.width > 0 && out.height > 0 && out.width <= kLargestSide &&
         out.height <= kLargestSide;
}

bool read_choice(std::span<const std::uint8_t> payload, DrawChoice& choice) {
  Reader reader(payload);
  return read_choice_from(reader, choice) && reader.at_end();
}

bool read_monitor_show(std::span<const std::uint8_t> payload, bool& measured,
                       Show& show) {
  Reader reader(payload);
  const std::uint32_t flag = reader.u32();
  if (!reader.ok() || flag > 1) {
    return false;
  }
  measured = flag == 1;
  return read_show(payload.subspan(4), show) && show.scene.has_value();
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
