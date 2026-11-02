/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The lamp host's messages against the bytes main's own encoder wrote and
// the layout `scene_wire.h` documents (`lamp_wire_fixture.h`): what main
// sends is read back to the values it was made from, what the host writes is
// those bytes exactly, the framer hands whole messages out of a stream cut
// anywhere, and a message out of bounds is refused rather than read.

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <span>
#include <string>
#include <vector>

#include "lamp_messages.h"
#include "lamp_wire_fixture.h"
#include "scene_wire.h"

namespace {

namespace fixture = feq::scene::fixture;
namespace wire = feq::scene::wire;

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

/** The payload of one whole message, after its header. */
template <std::size_t N>
std::span<const std::uint8_t> payload_of(const std::uint8_t (&message)[N]) {
  return std::span<const std::uint8_t>(message).subspan(wire::kHeaderBytes);
}

template <std::size_t N>
bool same_bytes(const std::vector<std::uint8_t>& written,
                const std::uint8_t (&reference)[N]) {
  return written.size() == N &&
         std::memcmp(written.data(), reference, N) == 0;
}

}  // namespace

int main() {
  wire::Show show;
  check(wire::read_show(payload_of(fixture::kShowScene), show),
        "main's show with a scene is read");
  check(show.id == 9 && show.swatch.size() == 2 &&
            show.swatch[0] == feq::scene::Rgb{255, 0, 16} &&
            show.swatch[1] == feq::scene::Rgb{0, 229, 207},
        "the show's id and swatch");
  check(show.scene.has_value(), "the show carries its scene");
  if (show.scene) {
    const auto& scene = *show.scene;
    check(scene.guarded, "a member's scene is guarded");
    check(scene.response.sensitivity == 1.5 &&
              scene.response.threshold == 0.125 &&
              scene.response.attack == 40.0 && scene.response.release == 320.0,
          "the scene's response");
    check(scene.params.size() == 2 && scene.params[0].id == "glow" &&
              scene.params[0].value == 0.25 && scene.params[1].id == "daylight" &&
              scene.params[1].max == 100.0,
          "the scene's sliders, in order");
    check(scene.vertex_source == fixture::kShowVertex &&
              scene.fragment_source == fixture::kShowFragment,
          "the program text, UTF-8 intact");
    check(scene.view[0] == -0.5F && scene.view[2] == 2.0F &&
              scene.spectrum_rect[1] == 0.75F && scene.spectrum_rect[3] == 0.5F,
          "the framing");
    check(scene.artwork_width == 4 && scene.artwork_height == 2 &&
              scene.webp == std::vector<std::uint8_t>{1, 2, 3, 4, 5},
          "the artwork's size and bytes");
  }
  check(wire::read_show(payload_of(fixture::kShowSwatch), show) &&
            show.id == 10 && !show.scene && show.swatch.size() == 2,
        "a show without a scene is its swatch alone");

  wire::Daylight daylight;
  check(wire::read_daylight(payload_of(fixture::kDaylightClock), daylight) &&
            daylight.mode == wire::DaylightMode::kClock,
        "the clock's time of day");
  check(wire::read_daylight(payload_of(fixture::kDaylightFixed), daylight) &&
            daylight.mode == wire::DaylightMode::kFixed &&
            daylight.value == 62.5,
        "a time of day held");
  bool flag = false;
  check(wire::read_flag(payload_of(fixture::kPauseOn), flag) && flag,
        "paused");
  check(wire::read_flag(payload_of(fixture::kPreviewOn), flag) && flag,
        "the picture asked for");
  feq::scene::LampProfile profile;
  check(wire::read_profile(payload_of(fixture::kProfileHold), profile) &&
            profile.hold && profile.idle_speed == 0.5,
        "the idle profile");
  std::array<double, 3> accent{};
  check(wire::read_accent(payload_of(fixture::kAccent), accent) &&
            accent[0] == 0.25 && accent[1] == 0.5 && accent[2] == 1.0,
        "the accent");

  std::vector<std::uint8_t> rgb(48U * 27U * 3U);
  for (std::size_t at = 0; at < rgb.size(); ++at) {
    rgb[at] = static_cast<std::uint8_t>(at % 251);
  }
  wire::GridReading reading;
  reading.level = 0.5;
  reading.beat = 0.25;
  reading.bands = {0.125, 0.75, 1.0};
  reading.delta_ms = 33.375;
  reading.time_seconds = 1234.5;
  reading.activity = 0.875;
  reading.drawn = true;
  check(same_bytes(wire::grid_message(rgb, reading), fixture::kGrid),
        "a grid is the layout main reads");
  const std::vector<std::uint8_t> picture{255, 0, 0, 0, 0, 255};
  check(same_bytes(wire::picture_message(picture, 2, 1), fixture::kPicture),
        "a picture is the layout main reads");
  check(same_bytes(wire::loaded_message(42), fixture::kLoaded),
        "loaded is the layout main reads");
  check(same_bytes(wire::failed_message(7, wire::FailReason::kCompile,
                                        fixture::kFailedWords),
                   fixture::kFailed),
        "failed is the layout main reads");

  // Out of bounds, refused rather than read.
  const auto whole = payload_of(fixture::kShowScene);
  check(!wire::read_show(whole.first(whole.size() - 1), show),
        "a show cut short is refused");
  std::vector<std::uint8_t> longer(whole.begin(), whole.end());
  longer.push_back(0);
  check(!wire::read_show(longer, show), "a show with bytes over is refused");
  wire::Writer many(wire::Kind::kShow);
  many.u32(1);
  many.u32(wire::kMaxSwatch + 1);
  for (std::uint32_t at = 0; at < (wire::kMaxSwatch + 1) * 3; ++at) {
    many.bytes(std::vector<std::uint8_t>{0});
  }
  many.u32(0);
  const auto too_many = many.finish();
  check(!wire::read_show(std::span<const std::uint8_t>(too_many).subspan(
                             wire::kHeaderBytes),
                         show),
        "a swatch of more colours than any pack is refused");
  wire::Writer odd(wire::Kind::kDaylight);
  odd.u32(1);
  odd.f64(std::nan(""));
  const auto not_a_number = odd.finish();
  check(!wire::read_daylight(std::span<const std::uint8_t>(not_a_number)
                                 .subspan(wire::kHeaderBytes),
                             daylight),
        "a time of day that is no number is refused");

  // A stream cut anywhere still gives whole messages, in order.
  std::vector<std::uint8_t> stream(std::begin(fixture::kShowScene),
                                   std::end(fixture::kShowScene));
  stream.insert(stream.end(), std::begin(fixture::kPauseOn),
                std::end(fixture::kPauseOn));
  wire::Framer framer;
  std::vector<wire::Kind> kinds;
  bool broken = false;
  for (std::size_t at = 0; at < stream.size(); at += 7) {
    const std::size_t size = std::min<std::size_t>(7, stream.size() - at);
    framer.feed(std::span<const std::uint8_t>(stream).subspan(at, size));
    while (auto message = framer.next(broken)) {
      kinds.push_back(message->first);
    }
  }
  check(!broken && kinds.size() == 2 && kinds[0] == wire::Kind::kShow &&
            kinds[1] == wire::Kind::kPause,
        "the framer hands out whole messages from any cut");
  wire::Framer wrong;
  const std::vector<std::uint8_t> garbage(16, 0xAB);
  wrong.feed(garbage);
  check(!wrong.next(broken) && broken, "a stream without the magic is broken");

  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("lamp messages: one layout on both ends\n");
  return 0;
}
