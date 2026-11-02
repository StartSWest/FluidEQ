/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The C++ hops against the TypeScript's: the same made-up song, read here in
// blocks of odd sizes, must land on the bands `soundHops.ts` read from it
// (`sound_hops_fixture.h`, written by that module). The control: matched one
// hop late, the same comparison fails, so a pass is not a comparison too loose
// to fail.

#include "fluideq/scene/sound_hops.h"
#include "sound_hops_fixture.h"
#include "fixture_song.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <numbers>
#include <span>
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
  feq::scene::fixture::groove_sample(n, rate, l, r);
  left = static_cast<float>(l);
  right = static_cast<float>(r);
}

struct Heard {
  double at_ms;
  std::array<float, feq::scene::kRhythmBandCount> bands;
  /** The dB of every bin summed: low, high, voice mid, voice side. */
  std::array<double, 4> sums;
};

double sum(const std::vector<float>& bins) {
  double total = 0.0;
  for (const float db : bins) {
    total += static_cast<double>(db);
  }
  return total;
}

std::vector<Heard> hear(double rate) {
  feq::scene::SoundHops hops(rate);
  const auto total =
      static_cast<std::int64_t>(std::round(rate * feq::scene::fixture::kSeconds));
  // Blocks of odd sizes, as an audio device hands them: a hop must not
  // depend on where the blocks fall.
  constexpr std::size_t kBlocks[] = {137, 480, 1, 1023, 333};
  std::vector<Heard> heard;
  std::vector<float> left;
  std::vector<float> right;
  std::int64_t n = 0;
  for (std::size_t turn = 0; n < total; ++turn) {
    const auto size = static_cast<std::int64_t>(
        std::min<std::int64_t>(static_cast<std::int64_t>(kBlocks[turn % 5]),
                               total - n));
    left.resize(static_cast<std::size_t>(size));
    right.resize(static_cast<std::size_t>(size));
    for (std::int64_t i = 0; i < size; ++i) {
      fixture_sample(n + i, rate, left[static_cast<std::size_t>(i)],
                     right[static_cast<std::size_t>(i)]);
    }
    n += size;
    const double at_ms = static_cast<double>(n - 1) * 1000.0 / rate;
    hops.push(left.data(), right.data(), left.size(), at_ms,
              [&](const feq::scene::SoundHop& hop) {
                heard.push_back({hop.at_ms, hop.bands,
                                 {sum(hop.low), sum(hop.high),
                                  sum(hop.voice_mid), sum(hop.voice_side)}});
              });
  }
  return heard;
}

struct Worst {
  /** The largest difference in a band, 0..1. */
  double bands = 0.0;
  /** The largest difference in a sum of bins, in dB. */
  double sums = 0.0;
  std::size_t matched = 0;
};

/** The largest differences with fixture row `i` matched to hop `i + shift`. */
Worst worst(std::span<const feq::scene::fixture::HopRow> rows,
            const std::vector<Heard>& heard, std::ptrdiff_t shift) {
  Worst found;
  for (const auto& row : rows) {
    const auto at = std::find_if(heard.begin(), heard.end(), [&](const Heard& h) {
      return std::abs(h.at_ms - row.at_ms) < 1e-6;
    });
    if (at == heard.end()) {
      continue;
    }
    const auto index = (at - heard.begin()) + shift;
    if (index < 0 || index >= static_cast<std::ptrdiff_t>(heard.size())) {
      continue;
    }
    ++found.matched;
    const auto& hop = heard[static_cast<std::size_t>(index)];
    for (std::size_t band = 0; band < hop.bands.size(); ++band) {
      found.bands = std::max(
          found.bands, std::abs(static_cast<double>(hop.bands[band]) -
                                static_cast<double>(row.bands[band])));
    }
    for (std::size_t which = 0; which < hop.sums.size(); ++which) {
      found.sums =
          std::max(found.sums, std::abs(hop.sums[which] - row.sums[which]));
    }
  }
  return found;
}

void holds(double rate, std::span<const feq::scene::fixture::HopRow> rows) {
  const auto heard = hear(rate);
  // 0.0002 of the 100 dB the bands span is 0.02 dB; 0.05 dB over the
  // hundreds of bins a sum adds up. Two maths libraries' sines and
  // logarithms apart, and nothing more.
  const Worst same = worst(rows, heard, 0);
  std::printf("%.0f Hz: %zu of %zu hops matched, worst band %.2e, worst sum "
              "%.2e dB\n",
              rate, same.matched, rows.size(), same.bands, same.sums);
  check(same.matched == rows.size(),
        "every hop the TypeScript read is read here");
  check(same.bands < 2e-4, "the bands are the TypeScript's");
  check(same.sums < 0.05, "every bin is the TypeScript's");

  const Worst late = worst(rows, heard, 1);
  std::printf("%.0f Hz control, one hop late: worst band %.2e, worst sum "
              "%.2e dB\n",
              rate, late.bands, late.sums);
  check(late.bands > 2e-3, "one hop late is told apart by its bands");
  check(late.sums > 1.0, "one hop late is told apart by its bins");
}

}  // namespace

int main() {
  holds(44100.0, feq::scene::fixture::kHops44100);
  holds(48000.0, feq::scene::fixture::kHops48000);
  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("sound hops: the TypeScript's numbers\n");
  return 0;
}
