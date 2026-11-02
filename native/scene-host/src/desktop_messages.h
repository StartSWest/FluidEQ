/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

// The desktop backgrounds' messages (`scene_wire.h` lists them), read and
// written: `src/main/wallpaper/desktopHostWire.ts` is the other end, and
// `desktop_messages_test.cpp` holds the two to the same bytes.

#include <cstdint>
#include <span>
#include <string>
#include <vector>

#include "fluideq/scene/draw_plan.h"
#include "lamp_messages.h"
#include "scene_wire.h"

namespace feq::scene::wire {

/** A monitor's window: where it stands and how its scenes are drawn. */
struct MonitorOpen {
  std::uint32_t monitor = 0;
  std::int32_t x = 0;
  std::int32_t y = 0;
  std::uint32_t width = 0;
  std::uint32_t height = 0;
  DrawChoice choice;
};

/** A message's monitor, and the payload after it. */
struct ForMonitor {
  std::uint32_t monitor = 0;
  std::span<const std::uint8_t> rest;
};

/** The monitor every desktop message starts with; false on a short one. */
bool read_monitor(std::span<const std::uint8_t> payload, ForMonitor& out);
bool read_monitor_open(std::span<const std::uint8_t> payload, MonitorOpen& out);
/** The listener's choice for how the monitor's scenes are drawn. */
bool read_choice(std::span<const std::uint8_t> payload, DrawChoice& choice);
/**
 * A scene for the monitor: whether FluidEQ made it and measured it before
 * release (drawn from full size) or nobody here has (climbed to it), and the
 * lamps' `show` after that.
 */
bool read_monitor_show(std::span<const std::uint8_t> payload, bool& measured,
                       Show& show);

std::vector<std::uint8_t> monitor_window_message(std::uint32_t monitor,
                                                 std::uint64_t window);
std::vector<std::uint8_t> monitor_loaded_message(std::uint32_t monitor,
                                                 std::uint32_t id);
std::vector<std::uint8_t> monitor_drawn_message(std::uint32_t monitor,
                                                std::uint32_t id);
std::vector<std::uint8_t> monitor_failed_message(std::uint32_t monitor,
                                                 std::uint32_t id,
                                                 FailReason reason,
                                                 const std::string& words);

}  // namespace feq::scene::wire
