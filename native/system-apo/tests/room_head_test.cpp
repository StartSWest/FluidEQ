/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The head file the app writes for the room: the block for the stream's rate
 * is taken, 192 kHz takes the 96 block with doubling, and a short or foreign
 * file is no head at all rather than a head of zeros.
 */

#include "../src/room_head.h"

#include <cstdio>
#include <string>

using fluideq_engine::parse_room_head;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

/** A block whose first tap is 1 on the left ear and 0.5 on the right. */
std::string block(int rate, int directions, int taps) {
  std::string out = "rate " + std::to_string(rate) + " directions " +
                    std::to_string(directions) + " taps " +
                    std::to_string(taps) + "\n";
  for (int direction = 0; direction < directions; ++direction) {
    for (int ear = 0; ear < 2; ++ear) {
      for (int tap = 0; tap < taps; ++tap) {
        out += tap == 0 ? (ear == 0 ? "1 " : "0.5 ") : "0 ";
      }
    }
    out += "\n";
  }
  return out;
}

}  // namespace

int main() {
  std::printf("room head file\n");
  const std::string text = "# FluidEQ room head v1 medium\n" +
                           block(44100, 24, 8) + block(48000, 24, 8) +
                           block(96000, 24, 8);

  std::printf("the block for the stream's rate\n");
  const auto head = parse_room_head(text, 48000);
  CHECK(head.has_value());
  CHECK(head && head->directions == 24 && head->taps == 8);
  CHECK(head && head->sample_rate == 48000);
  CHECK(head && head->left.size() == 24 * 8 && head->right.size() == 24 * 8);
  CHECK(head && head->left[0] == 1.0f && head->right[0] == 0.5f);
  CHECK(head && head->left[8 * 23] == 1.0f && head->right[8 * 23] == 0.5f);
  CHECK(head && !head->needs_doubling);

  std::printf("192 kHz takes the 96 block, doubled\n");
  const auto high = parse_room_head(text, 192000);
  CHECK(high && high->sample_rate == 96000 && high->needs_doubling);

  std::printf("no head for a rate the file does not carry, or a short file\n");
  CHECK(!parse_room_head(text, 22050).has_value());
  CHECK(!parse_room_head("# FluidEQ room head v1\nrate 48000 directions 24 "
                         "taps 8\n1 2 3\n",
                         48000)
             .has_value());
  CHECK(!parse_room_head("", 48000).has_value());
  CHECK(!parse_room_head("rate 48000 directions 0 taps 8\n", 48000)
             .has_value());
  CHECK(!parse_room_head("rate 48000 directions 24 taps 99999\n", 48000)
             .has_value());

  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}
