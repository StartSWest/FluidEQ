/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The music as the C++ hears it against the TypeScript's: twelve seconds of
// the made-up song, read here in blocks of odd sizes, must land on the level,
// bands, pulse, accent, flywheel, tempo, beat and bar, drums, song shape and
// voice `spectrumEnergy.ts` heard (`scene_energy_fixture.h`, written by that
// module). The control: matched one kept reading late, it fails.

#include "fluideq/scene/spectrum_energy.h"
#include "scene_energy_fixture.h"
#include "fixture_song.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <memory>
#include <numbers>
#include <vector>

namespace {

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

/** Sample `n` of the song the fixture was read from, as floats. */
void fixture_sample(std::int64_t n, double rate, float& left, float& right) {
  double l = 0.0;
  double r = 0.0;
  feq::scene::fixture::shaped_sample(n, rate, l, r);
  left = static_cast<float>(l);
  right = static_cast<float>(r);
}

using Row = std::array<double, 25>;

Row row_of(double at_ms, const feq::scene::SpectrumEnergy& e) {
  const auto& r = e.rhythm;
  return {at_ms,        e.level,      e.bass,       e.mid,
          e.treble,     e.beat,       e.accent,     e.accent_serial,
          e.run,        e.run_speed,  r.beat_phase, r.bar_phase,
          r.tempo,      r.confidence, r.kick,       r.snare,
          r.hat,        r.intensity,  r.build,      r.drop,
          r.drop_serial, r.running ? 1.0 : 0.0,     e.voice.open,
          e.voice.pitch, e.voice.sure};
}

std::vector<Row> hear() {
  const double rate = feq::scene::fixture::kEnergyRate;
  const auto total = static_cast<std::int64_t>(
      std::round(rate * feq::scene::fixture::kEnergySeconds));
  feq::scene::SoundHops hops(rate);
  auto state = std::make_unique<feq::scene::EnergyState>();
  constexpr std::size_t kBlocks[] = {137, 480, 1, 1023, 333};
  std::vector<Row> kept;
  std::vector<float> left;
  std::vector<float> right;
  int heard = 0;
  std::int64_t n = 0;
  for (std::size_t turn = 0; n < total; ++turn) {
    const auto size = std::min<std::int64_t>(
        static_cast<std::int64_t>(kBlocks[turn % 5]), total - n);
    left.resize(static_cast<std::size_t>(size));
    right.resize(static_cast<std::size_t>(size));
    for (std::int64_t i = 0; i < size; ++i) {
      fixture_sample(n + i, rate, left[static_cast<std::size_t>(i)],
                     right[static_cast<std::size_t>(i)]);
    }
    n += size;
    hops.push(left.data(), right.data(), left.size(),
              static_cast<double>(n - 1) * 1000.0 / rate,
              [&](const feq::scene::SoundHop& hop) {
                // The TypeScript's first read only learns where the clock
                // is; it hears from the hop after.
                if (hop.at_ms < feq::scene::fixture::kEnergyFirstAtMs - 1e-6) {
                  return;
                }
                feq::scene::hear_hop(*state, hop, 0.0);
                ++heard;
                if (heard % feq::scene::fixture::kEnergyKeepEvery == 0) {
                  kept.push_back(row_of(hop.at_ms, feq::scene::read_energy(*state)));
                }
              });
  }
  return kept;
}

constexpr const char* kNames[25] = {
    "at_ms",      "level", "bass",     "mid",         "treble",
    "beat",       "accent", "accent serial", "run",   "run speed",
    "beat phase", "bar phase", "tempo", "confidence", "kick",
    "snare",      "hat",   "intensity", "build",      "drop",
    "drop serial", "running", "voice open", "voice pitch", "voice sure"};

}  // namespace

int main() {
  const auto heard = hear();
  const auto& rows = feq::scene::fixture::kEnergy;
  const std::size_t count = std::size(rows);
  check(heard.size() == count, "every kept reading is read here");
  std::array<double, 25> worst{};
  std::array<double, 25> late{};
  for (std::size_t at = 0; at < std::min(count, heard.size()); ++at) {
    for (std::size_t field = 0; field < 25; ++field) {
      worst[field] =
          std::max(worst[field], std::abs(heard[at][field] - rows[at][field]));
      if (at + 1 < heard.size()) {
        late[field] = std::max(late[field],
                               std::abs(heard[at + 1][field] - rows[at][field]));
      }
    }
  }
  double worst_all = 0.0;
  for (std::size_t field = 0; field < 25; ++field) {
    std::printf("%-12s worst %.3e   one late %.3e\n", kNames[field],
                worst[field], late[field]);
    worst_all = std::max(worst_all, worst[field]);
  }
  // Two maths libraries' pow, exp and log apart, carried through twelve
  // seconds of state: a millionth, never a different beat.
  check(worst_all < 1e-6, "the music heard is the TypeScript's");
  check(late[0] > 50.0 && late[8] > 1e-3 && late[10] > 1e-3,
        "one reading late is told apart");
  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("scene energy: the TypeScript's numbers\n");
  return 0;
}
