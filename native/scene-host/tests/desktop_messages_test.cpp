/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The desktop backgrounds' messages as `scene_wire.h` lays them out: a
// monitor's rectangle read (left of the main monitor too) and refused out of
// bounds, the monitor every message starts with, how its scenes are drawn,
// who made a scene, and the four answers written byte for byte. `smoke-desktop-host.ts` holds main's
// encoder to these against the real program.

#include <cstdio>
#include <cstring>
#include <vector>

#include "desktop_messages.h"
#include "lamp_wire_fixture.h"

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

/** A lamps' message's payload, after its 12-byte header. */
template <std::size_t N>
std::vector<std::uint8_t> payload_of(const std::uint8_t (&message)[N]) {
  return {message + 12, message + N};
}

/** A choice: pinned share, auto floor, FSR, smoothing, pace. */
Bytes& choice(Bytes& bytes, double pinned, double floor, std::uint32_t fsr,
              std::uint32_t smoothing, double pace) {
  return bytes.f64(pinned).f64(floor).u32(fsr).u32(smoothing).f64(pace);
}

Bytes rect(std::uint32_t width) {
  return Bytes{}.u32(2).u32(0).u32(0).u32(width).u32(1080);
}

}  // namespace

int main() {
  wire::MonitorOpen open;
  auto left = Bytes{}
                  .u32(2)
                  .u32(static_cast<std::uint32_t>(-1920))
                  .u32(0)
                  .u32(1920)
                  .u32(1080);
  choice(left, -1.0, 0.35, 1, 2, 0.0);
  check(wire::read_monitor_open(left.data, open) && open.monitor == 2 &&
            open.x == -1920 && open.y == 0 && open.width == 1920 &&
            open.height == 1080 && !open.choice.pinned &&
            open.choice.auto_floor == 0.35 && open.choice.fsr &&
            open.choice.smoothing == feq::scene::Smoothing::kBest &&
            open.choice.pace_ms == 0.0,
        "a monitor left of the main one is read with its signed corner");
  {
    auto no_width = rect(0);
    check(!wire::read_monitor_open(choice(no_width, -1.0, 0.35, 1, 2, 0.0).data,
                                   open),
          "a monitor with no width is refused");
    auto too_wide = rect(40000);
    check(!wire::read_monitor_open(
              choice(too_wide, -1.0, 0.35, 1, 2, 0.0).data, open),
          "a monitor wider than any is refused");
    auto tiny = rect(1920);
    check(!wire::read_monitor_open(choice(tiny, 0.1, 0.35, 1, 2, 0.0).data, open),
          "a pinned share under a quarter is refused");
    auto smoothing = rect(1920);
    check(!wire::read_monitor_open(
              choice(smoothing, -1.0, 0.35, 1, 3, 0.0).data, open),
          "a smoothing nobody can choose is refused");
    auto fsr = rect(1920);
    check(!wire::read_monitor_open(choice(fsr, -1.0, 0.35, 2, 2, 0.0).data, open),
          "an upscaler flag past one is refused");
    auto pace = rect(1920);
    check(!wire::read_monitor_open(choice(pace, -1.0, 0.35, 1, 2, -1.0).data,
                                   open),
          "a negative pace is refused");
    auto floor = rect(1920);
    check(!wire::read_monitor_open(choice(floor, -1.0, 1.5, 1, 2, 0.0).data,
                                   open),
          "a floor past the whole picture is refused");
  }
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

  feq::scene::DrawChoice chosen;
  Bytes balanced;
  check(wire::read_choice(choice(balanced, 0.67, 0.5, 0, 0, 1000.0 / 30.0).data,
                          chosen) &&
            chosen.pinned == 0.67 && chosen.auto_floor == 0.5 && !chosen.fsr &&
            chosen.smoothing == feq::scene::Smoothing::kOff &&
            chosen.pace_ms == 1000.0 / 30.0,
        "a preset's share, the plain scaler and thirty a second are read");
  Bytes whole_and_more;
  check(!wire::read_choice(choice(whole_and_more, 1.5, 0.5, 0, 0, 0.0).data,
                           chosen),
        "more than the whole monitor is refused");

  bool measured = false;
  wire::Show show;
  auto measured_show = Bytes{}.u32(1);
  const auto scene = payload_of(feq::scene::fixture::kShowScene);
  measured_show.data.insert(measured_show.data.end(), scene.begin(), scene.end());
  check(wire::read_monitor_show(measured_show.data, measured, show) && measured &&
            show.scene.has_value() && show.scene->guarded,
        "a scene FluidEQ measured is read with the lamps' show after it");
  auto unknown = Bytes{}.u32(2);
  unknown.data.insert(unknown.data.end(), scene.begin(), scene.end());
  check(!wire::read_monitor_show(unknown.data, measured, show),
        "a maker past one is refused");
  auto swatch_only = Bytes{}.u32(0);
  const auto swatch = payload_of(feq::scene::fixture::kShowSwatch);
  swatch_only.data.insert(swatch_only.data.end(), swatch.begin(), swatch.end());
  check(!wire::read_monitor_show(swatch_only.data, measured, show),
        "a show with no scene is refused: a monitor never falls back to colours");

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
