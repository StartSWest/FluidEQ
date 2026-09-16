/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which channel of a stream is the subwoofer feed, from its mask.
 *
 * The masks are the ones Windows hands an effect (`KSAUDIO_SPEAKER_*` in
 * ksmedia.h), written out as numbers so the test does not depend on the
 * header it is checking the rule against.
 */

#include "../src/channel_layout.h"

#include <cstdio>

using fluideq_engine::lfe_channel_of;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

// FL | FR | FC | LFE | BL | BR
constexpr unsigned long k5point1 = 0x3F;
// FL | FR | FC | LFE | BL | BR | SL | SR
constexpr unsigned long k7point1 = 0x63F;
// FL | FR | LFE
constexpr unsigned long k2point1 = 0xB;
// FL | FR
constexpr unsigned long kStereo = 0x3;
// FL | FR | BL | BR
constexpr unsigned long kQuad = 0x33;
// FL | FR | FC | LFE | SL | SR — 5.1 with the surrounds at the side.
constexpr unsigned long k5point1Side = 0x60F;

}  // namespace

int main() {
  std::printf("channel layout\n\n");

  std::printf("the LFE is the fourth channel of 5.1 and 7.1\n");
  CHECK(lfe_channel_of(k5point1, 6) == 3);
  CHECK(lfe_channel_of(k7point1, 8) == 3);
  CHECK(lfe_channel_of(k5point1Side, 6) == 3);

  std::printf("and the third of 2.1\n");
  CHECK(lfe_channel_of(k2point1, 3) == 2);

  std::printf("a layout without one has none\n");
  CHECK(lfe_channel_of(kStereo, 2) == -1);
  CHECK(lfe_channel_of(kQuad, 4) == -1);
  CHECK(lfe_channel_of(0x1, 1) == -1);

  std::printf("no mask: Windows' own order for six and up, nothing below\n");
  CHECK(lfe_channel_of(0, 6) == 3);
  CHECK(lfe_channel_of(0, 8) == 3);
  CHECK(lfe_channel_of(0, 2) == -1);
  CHECK(lfe_channel_of(0, 3) == -1);
  CHECK(lfe_channel_of(0, 4) == -1);

  std::printf("a mask that does not fit the stream is not believed\n");
  // 5.1's mask on a two-channel stream: the LFE it names is not there.
  CHECK(lfe_channel_of(k5point1, 2) == -1);
  // FC | LFE alone on a one-channel stream.
  CHECK(lfe_channel_of(0xC, 1) == -1);

  std::printf("each channel's speaker in the room, from the mask\n");
  using fluideq_engine::speaker_of_channel;
  // 7.1 in mask order: FL FR C LFE BL BR SL SR.
  const int seven[8] = {0, 1, 2, -1, 5, 6, 3, 4};
  for (unsigned channel = 0; channel < 8; ++channel) {
    CHECK(speaker_of_channel(k7point1, 8, channel) == seven[channel]);
  }
  // 5.1 with back surrounds and with side surrounds both land on the ring.
  CHECK(speaker_of_channel(k5point1, 6, 4) == 5);
  CHECK(speaker_of_channel(k5point1, 6, 5) == 6);
  CHECK(speaker_of_channel(k5point1Side, 6, 4) == 3);
  CHECK(speaker_of_channel(k5point1Side, 6, 5) == 4);
  CHECK(speaker_of_channel(kStereo, 2, 0) == 0);
  CHECK(speaker_of_channel(kStereo, 2, 1) == 1);
  CHECK(speaker_of_channel(k2point1, 3, 2) == -1);
  // A position the room has no speaker for still takes its place: FL FR FC
  // FLC FRC — the fourth channel is front-left-of-centre, the fifth
  // front-right-of-centre, neither on the ring.
  CHECK(speaker_of_channel(0xC7, 5, 3) == -1);
  CHECK(speaker_of_channel(0xC7, 5, 4) == -1);
  CHECK(speaker_of_channel(0xC7, 5, 2) == 2);

  std::printf("no mask: Windows' own order for two, six and eight\n");
  CHECK(speaker_of_channel(0, 2, 1) == 1);
  CHECK(speaker_of_channel(0, 6, 3) == -1);
  CHECK(speaker_of_channel(0, 6, 5) == 6);
  CHECK(speaker_of_channel(0, 8, 7) == 4);
  CHECK(speaker_of_channel(0, 4, 2) == -1);
  CHECK(speaker_of_channel(kStereo, 2, 2) == -1);

  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}
