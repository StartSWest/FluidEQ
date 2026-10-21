/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The shared oversampler gives the same samples it always gave, to the last
 * bit, for about half the work.
 *
 * Its filters were written the plain way: every output summed all 63 taps,
 * half of them meeting stuffed zeros on the way up, and the way down summed
 * a sample it then threw away. They now sum only what counts (2026-10-14).
 * The plain filter is kept here, built as it was, and both run the same
 * noise; every sample must match exactly. Control: the plain filter one
 * sample out of step — what a tap or a phase taken wrongly looks like —
 * differs, so the match is not something any filter would pass.
 */

#include "fluideq/oversample.h"
#include "dsp_test_support.h"

#include <array>
#include <cmath>
#include <cstdio>
#include <vector>

namespace {

using feq_test::check;

constexpr int kTaps = FEQ_OVERSAMPLE_TAPS;
constexpr uint32_t kBlock = 480;
constexpr uint32_t kBlocks = 40;

/** The half-band as `oversample.cpp` designs it. */
std::array<double, kTaps> half_band() {
  std::array<double, kTaps> taps{};
  const double middle = (kTaps - 1) / 2.0;
  double sum = 0.0;
  for (int at = 0; at < kTaps; ++at) {
    const double n = static_cast<double>(at) - middle;
    const double ideal =
        n == 0.0 ? 0.5
                 : std::sin(3.14159265358979323846 * 0.5 * n) /
                       (3.14159265358979323846 * n);
    const double window =
        0.42 -
        0.5 * std::cos((2.0 * 3.14159265358979323846 * at) / (kTaps - 1)) +
        0.08 * std::cos((4.0 * 3.14159265358979323846 * at) / (kTaps - 1));
    taps[static_cast<size_t>(at)] = ideal * window;
    sum += taps[static_cast<size_t>(at)];
  }
  for (double& tap : taps) {
    tap /= sum;
  }
  return taps;
}

/** The plain filter, as it was: one circular history, every tap summed. */
struct Plain {
  std::array<double, kTaps> taps = half_band();
  std::array<double, kTaps> history{};
  int position = 0;
  /** For the control: every sum read one sample further back. */
  bool late = false;

  double push(double sample) {
    history[static_cast<size_t>(position)] = sample;
    double sum = 0.0;
    for (int tap = 0; tap < kTaps; ++tap) {
      int read = position - tap - (late ? 1 : 0);
      if (read < 0) read += kTaps;
      sum += history[static_cast<size_t>(read)] * taps[static_cast<size_t>(tap)];
    }
    position = position + 1 == kTaps ? 0 : position + 1;
    return sum;
  }

  void up(const float* in, float* out, uint32_t frames) {
    for (uint32_t at = 0; at < frames; ++at) {
      out[at * 2] = static_cast<float>(push(in[at]) * 2.0);
      out[at * 2 + 1] = static_cast<float>(push(0.0) * 2.0);
    }
  }

  void down(const float* in, float* out, uint32_t frames) {
    for (uint32_t at = 0; at < frames; ++at) {
      const double kept = push(in[at * 2]);
      push(in[at * 2 + 1]);
      out[at] = static_cast<float>(kept);
    }
  }
};

std::vector<float> noise(size_t count, unsigned long long seed) {
  std::vector<float> out(count);
  for (float& value : out) {
    seed = seed * 6364136223846793005ULL + 1442695040888963407ULL;
    value = static_cast<float>(static_cast<double>(seed >> 33) / 4294967296.0 - 1.0);
  }
  return out;
}

/** Samples that differ between the two, over the whole run. */
size_t differing(uint32_t factor, bool late) {
  FeqOversampler shared{};
  feq_oversampler_reset(&shared);
  Plain up_first;
  Plain up_second;
  Plain down_second;
  Plain down_first;
  for (Plain* plain : {&up_first, &up_second, &down_second, &down_first}) {
    plain->late = late;
  }
  std::vector<float> middle(kBlock * 2), wide(kBlock * 4), back(kBlock);
  std::vector<float> plain_middle(kBlock * 2), plain_wide(kBlock * 4),
      plain_back(kBlock);
  size_t count = 0;
  for (uint32_t block = 0; block < kBlocks; ++block) {
    const std::vector<float> in = noise(kBlock, 7 + block);
    // Down is fed its own noise, so it is checked on more than what up made.
    const std::vector<float> wide_in = noise(kBlock * factor, 1000 + block);
    feq_oversample_up(&shared, in.data(), wide.data(), kBlock, factor,
                      middle.data());
    feq_oversample_down(&shared, wide_in.data(), back.data(), kBlock, factor,
                        middle.data());
    if (factor == 2) {
      up_first.up(in.data(), plain_wide.data(), kBlock);
      down_first.down(wide_in.data(), plain_back.data(), kBlock);
    } else {
      up_first.up(in.data(), plain_middle.data(), kBlock);
      up_second.up(plain_middle.data(), plain_wide.data(), kBlock * 2);
      down_second.down(wide_in.data(), plain_middle.data(), kBlock * 2);
      down_first.down(plain_middle.data(), plain_back.data(), kBlock);
    }
    for (uint32_t at = 0; at < kBlock * factor; ++at) {
      if (wide[at] != plain_wide[at]) ++count;
    }
    for (uint32_t at = 0; at < kBlock; ++at) {
      if (back[at] != plain_back[at]) ++count;
    }
  }
  return count;
}

}  // namespace

int main() {
  std::printf("the oversampler gives the plain filter's samples exactly\n");
  for (const uint32_t factor : {2u, 4u}) {
    const size_t in_step = differing(factor, false);
    const size_t out_of_step = differing(factor, true);
    std::printf("  %ux: %zu samples differ; a sample out of step, %zu\n",
                factor, in_step, out_of_step);
    check(in_step == 0, "every sample, up and down, is the plain filter's");
    check(out_of_step > 0, "control: a filter a sample out of step differs");
  }
  return feq_test::finish();
}
