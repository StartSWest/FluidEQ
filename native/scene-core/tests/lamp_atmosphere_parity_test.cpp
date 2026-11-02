/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The lamps' atmosphere, time of day and swatch in C++, against what the
// window's own TypeScript answers to the same inputs (`lamp_fixture.h`,
// written by `src/renderer/lighting/lampFixture.ts`). The ease, the sine and
// the exponential go through each language's maths library, so those are
// held to a millionth of a millionth; the swatch is bytes and held exactly.

#include <array>
#include <cmath>
#include <cstdio>
#include <span>
#include <vector>

#include "fluideq/scene/lamp_atmosphere.h"
#include "lamp_fixture.h"

namespace {

namespace fixture = feq::scene::fixture;

constexpr double kTolerance = 1e-12;

int failures = 0;

void near(double got, double want, const char* what, std::size_t row) {
  if (!(std::abs(got - want) <= kTolerance * std::max(1.0, std::abs(want)))) {
    if (failures < 20) {
      std::printf("FAIL: %s at row %zu: got %.17g, want %.17g\n", what, row,
                  got, want);
    }
    ++failures;
  }
}

template <std::size_t Rows>
void check_atmosphere(const double (&expected)[Rows][7], std::size_t profile) {
  static_assert(Rows == std::size(fixture::kAtmosphereHeard));
  feq::scene::LampProfile lamp;
  lamp.hold = fixture::kAtmosphereProfiles[profile][0] != 0.0;
  lamp.idle_speed = fixture::kAtmosphereProfiles[profile][1];
  feq::scene::LampAtmosphere atmosphere;
  for (std::size_t row = 0; row < Rows; ++row) {
    const auto& heard = fixture::kAtmosphereHeard[row];
    feq::scene::SceneFrame frame;
    frame.level = heard[2];
    frame.beat = heard[3];
    frame.bands = {heard[4], heard[5], heard[6]};
    atmosphere.apply(frame, heard[0], heard[1] != 0.0, lamp);
    const auto& want = expected[row];
    near(frame.time_seconds, want[0], "time", row);
    near(atmosphere.activity(), want[1], "activity", row);
    near(frame.level, want[2], "level", row);
    near(frame.beat, want[3], "beat", row);
    near(frame.bands[0], want[4], "bass", row);
    near(frame.bands[1], want[5], "mid", row);
    near(frame.bands[2], want[6], "treble", row);
  }
}

template <std::size_t Colours, std::size_t Cells>
void check_swatch(const std::array<std::uint8_t, 3> (&colours)[Colours],
                  const std::uint8_t (&spectrum)[512],
                  const std::uint8_t (&grid)[Cells], int width, int height,
                  const char* what) {
  std::vector<feq::scene::Rgb> rgb(std::begin(colours), std::end(colours));
  std::vector<std::uint8_t> into;
  feq::scene::fill_swatch_grid(rgb, spectrum, width, height, into);
  if (into.size() != Cells) {
    std::printf("FAIL: %s is %zu bytes, want %zu\n", what, into.size(), Cells);
    ++failures;
    return;
  }
  for (std::size_t at = 0; at < Cells; ++at) {
    if (into[at] != grid[at]) {
      std::printf("FAIL: %s byte %zu: got %d, want %d\n", what, at, into[at],
                  grid[at]);
      ++failures;
      return;
    }
  }
}

}  // namespace

int main() {
  check_atmosphere(fixture::kAtmosphere0, 0);
  check_atmosphere(fixture::kAtmosphere1, 1);
  check_atmosphere(fixture::kAtmosphere2, 2);

  for (std::size_t row = 0; row < std::size(fixture::kClockDaylight); ++row) {
    const auto& reading = fixture::kClockDaylight[row];
    near(feq::scene::clock_daylight(static_cast<int>(reading[0]),
                                    static_cast<int>(reading[1]),
                                    static_cast<int>(reading[2])),
         reading[3], "clock daylight", row);
  }

  feq::scene::DaylightFollower follower;
  for (std::size_t row = 0; row < std::size(fixture::kFollower); ++row) {
    const auto& step = fixture::kFollower[row];
    near(follower.next(step[0], step[1]), step[2], "follower", row);
  }

  check_swatch(fixture::kSwatch0Colours, fixture::kSwatch0Spectrum,
               fixture::kSwatch0Grid, fixture::kSwatch0Width,
               fixture::kSwatch0Height, "swatch 0");
  check_swatch(fixture::kSwatch1Colours, fixture::kSwatch1Spectrum,
               fixture::kSwatch1Grid, fixture::kSwatch1Width,
               fixture::kSwatch1Height, "swatch 1");
  check_swatch(fixture::kSwatch2Colours, fixture::kSwatch2Spectrum,
               fixture::kSwatch2Grid, fixture::kSwatch2Width,
               fixture::kSwatch2Height, "swatch 2");
  check_swatch(fixture::kSwatch3Colours, fixture::kSwatch3Spectrum,
               fixture::kSwatch3Grid, fixture::kSwatch3Width,
               fixture::kSwatch3Height, "swatch 3");

  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("lamp atmosphere: the window's desk, in C++\n");
  return 0;
}
