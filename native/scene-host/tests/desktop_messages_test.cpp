/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The desktop backgrounds' messages as `scene_wire.h` lays them out: a
// monitor's rectangle read (left of the main monitor too) and refused out of
// bounds, the monitor every message starts with, the share drawn, and the
// four answers written byte for byte. `smoke-desktop-host.ts` holds main's
// encoder to these against the real program.

#include <cstdio>
#include <cstring>
#include <vector>

#include "desktop_messages.h"

namespace {

namespace wire = feq::scene::wire;

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

struct Bytes {
  std::vector<std::uint8_t> data;
  Bytes& u32(std::uint32_t value) {
    const auto* at = reinterpret_cast<const std::uint8_t*>(&value);
    data.insert(data.end(), at, at + 4);
    return *this;
  }
  Bytes& f64(double value) {
    const auto* at = reinterpret_cast<const std::uint8_t*>(&value);
    data.insert(data.end(), at, at + 8);
    return *this;
  }
};

std::uint32_t u32_at(const std::vector<std::uint8_t>& bytes, std::size_t at) {
  std::uint32_t value = 0;
  std::memcpy(&value, bytes.data() + at, 4);
  return value;
}

}  // namespace

int main() {
  wire::MonitorOpen open;
  const auto left = Bytes{}
                        .u32(2)
                        .u32(static_cast<std::uint32_t>(-1920))
                        .u32(0)
                        .u32(1920)
                        .u32(1080)
                        .f64(0.75);
  check(wire::read_monitor_open(left.data, open) && open.monitor == 2 &&
            open.x == -1920 && open.y == 0 && open.width == 1920 &&
            open.height == 1080 && open.scale == 0.75,
        "a monitor left of the main one is read with its signed corner");
  check(!wire::read_monitor_open(
            Bytes{}.u32(2).u32(0).u32(0).u32(0).u32(1080).f64(1.0).data, open),
        "a monitor with no width is refused");
  check(!wire::read_monitor_open(
            Bytes{}.u32(2).u32(0).u32(0).u32(40000).u32(1080).f64(1.0).data, open),
        "a monitor wider than any is refused");
  check(!wire::read_monitor_open(
            Bytes{}.u32(2).u32(0).u32(0).u32(1920).u32(1080).f64(0.1).data, open),
        "a share under a quarter is refused");
  auto longer = left;
  longer.u32(7);
  check(!wire::read_monitor_open(longer.data, open), "trailing bytes are refused");

  wire::ForMonitor addressed;
  const auto paused = Bytes{}.u32(5).u32(1);
  check(wire::read_monitor(paused.data, addressed) && addressed.monitor == 5 &&
            addressed.rest.size() == 4,
        "a message's monitor, and the rest after it");
  check(!wire::read_monitor(std::vector<std::uint8_t>{1, 2}, addressed),
        "a message too short for a monitor is refused");

  double scale = 0.0;
  check(wire::read_scale(Bytes{}.f64(0.5).data, scale) && scale == 0.5,
        "a share of the monitor is read");
  check(!wire::read_scale(Bytes{}.f64(1.5).data, scale),
        "more than the whole monitor is refused");

  const auto window = wire::monitor_window_message(4, 0x0000000100A0B0C0ULL);
  check(window.size() == 24 && u32_at(window, 4) == 120 && u32_at(window, 8) == 12 &&
            u32_at(window, 12) == 4 && u32_at(window, 16) == 0x00A0B0C0U &&
            u32_at(window, 20) == 1,
        "the window goes as the monitor and a little-endian u64");
  const auto drawn = wire::monitor_drawn_message(4, 9);
  check(drawn.size() == 20 && u32_at(drawn, 4) == 122 && u32_at(drawn, 12) == 4 &&
            u32_at(drawn, 16) == 9,
        "a first frame goes as the monitor and the scene");
  const auto loaded = wire::monitor_loaded_message(4, 9);
  check(u32_at(loaded, 4) == 121, "a load goes as its own kind");
  const auto failed =
      wire::monitor_failed_message(4, 9, wire::FailReason::kCompile, "no");
  check(failed.size() == 12 + 18 && u32_at(failed, 4) == 123 &&
            u32_at(failed, 12) == 4 && u32_at(failed, 16) == 9 &&
            u32_at(failed, 20) == 2 && u32_at(failed, 24) == 2 &&
            failed[28] == 'n' && failed[29] == 'o',
        "a failure goes as the monitor, then the lamps' failure");

  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("desktop messages: laid out as scene_wire.h says\n");
  return 0;
}
