/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The colour frame as the app lays it out (`lightingWire.ts`), read back here
 * byte for byte — including split across reads, the way a pipe delivers it —
 * and every way a frame that is not one must stop the reader rather than
 * light the wrong lamps. The reference bytes below are what
 * `encodeColoursFrame(7, [255, 0, 128, 1, 2, 3])` produces;
 * `lightingWire.test.ts` pins the same bytes from the other side.
 */

#include "../src/json_text.h"
#include "../src/wire.h"

#include <array>
#include <cstdio>
#include <string>

using fluideq_lighting::ColoursFrame;
using fluideq_lighting::FrameReader;
using fluideq_lighting::JsonLine;
using fluideq_lighting::ReadResult;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

constexpr std::array<std::uint8_t, 26> kReference = {
    0x46, 0x4C, 0x48, 0x31,  // "FLH1"
    0x01, 0x00, 0x00, 0x00,  // colours
    0x0E, 0x00, 0x00, 0x00,  // payload: 8 + 2 lamps * 3
    0x07, 0x00, 0x00, 0x00,  // device 7
    0x02, 0x00, 0x00, 0x00,  // two lamps
    255,  0,    128,  1,    2, 3,
};

void a_whole_frame() {
  std::printf("a whole frame in one read\n");
  FrameReader reader;
  reader.feed(kReference);
  ColoursFrame frame;
  CHECK(reader.next(frame) == ReadResult::kColours);
  CHECK(frame.device == 7);
  CHECK(frame.lamp_count == 2);
  CHECK(frame.rgb[0] == 255 && frame.rgb[1] == 0 && frame.rgb[2] == 128);
  CHECK(frame.rgb[3] == 1 && frame.rgb[4] == 2 && frame.rgb[5] == 3);
  CHECK(reader.next(frame) == ReadResult::kNeedMore);
}

void a_frame_split_across_reads() {
  std::printf("a frame arriving one byte at a time\n");
  FrameReader reader;
  ColoursFrame frame;
  for (std::size_t index = 0; index + 1 < kReference.size(); ++index) {
    reader.feed(std::span<const std::uint8_t>(&kReference[index], 1));
    CHECK(reader.next(frame) == ReadResult::kNeedMore);
  }
  reader.feed(std::span<const std::uint8_t>(&kReference.back(), 1));
  CHECK(reader.next(frame) == ReadResult::kColours);
  CHECK(frame.device == 7 && frame.rgb[5] == 3);
}

void two_frames_in_one_read() {
  std::printf("two frames in one read\n");
  std::array<std::uint8_t, 52> both{};
  std::copy(kReference.begin(), kReference.end(), both.begin());
  std::copy(kReference.begin(), kReference.end(), both.begin() + 26);
  both[26 + 12] = 9;
  FrameReader reader;
  reader.feed(both);
  ColoursFrame frame;
  CHECK(reader.next(frame) == ReadResult::kColours && frame.device == 7);
  CHECK(reader.next(frame) == ReadResult::kColours && frame.device == 9);
  CHECK(reader.next(frame) == ReadResult::kNeedMore);
}

void a_wrong_magic_breaks_for_good() {
  std::printf("a wrong magic stops the reader, and it stays stopped\n");
  auto bad = kReference;
  bad[0] = 0x00;
  FrameReader reader;
  reader.feed(bad);
  ColoursFrame frame;
  CHECK(reader.next(frame) == ReadResult::kBroken);
  reader.feed(kReference);
  CHECK(reader.next(frame) == ReadResult::kBroken);
}

void a_lamp_count_that_disagrees_with_the_payload() {
  std::printf("a lamp count the payload does not hold\n");
  auto bad = kReference;
  bad[16] = 3;
  FrameReader reader;
  reader.feed(bad);
  ColoursFrame frame;
  CHECK(reader.next(frame) == ReadResult::kBroken);
}

void an_oversized_payload() {
  std::printf("a payload past the largest device\n");
  auto bad = kReference;
  bad[10] = 0x10;  // 1 MiB
  FrameReader reader;
  reader.feed(bad);
  ColoursFrame frame;
  CHECK(reader.next(frame) == ReadResult::kBroken);
}

void json_lines_escape_what_they_must() {
  std::printf("event lines escape quotes, backslashes and control bytes\n");
  const std::string line = JsonLine("razer")
                               .text("name", "Razer \"Kraken\"\\\n\x01")
                               .integer("productId", 1383)
                               .boolean("available", false)
                               .finish();
  CHECK(line ==
        "{\"type\":\"razer\",\"name\":\"Razer \\\"Kraken\\\"\\\\\\n\\u0001\","
        "\"productId\":1383,\"available\":false}\n");
  const float positions[] = {0.021f, 0.006f, 0.0f};
  const std::string numbers =
      JsonLine("lamparray").numbers("positions", positions, 3).finish();
  CHECK(numbers == "{\"type\":\"lamparray\",\"positions\":[0.021,0.006,0]}\n");
}

}  // namespace

int main() {
  a_whole_frame();
  a_frame_split_across_reads();
  two_frames_in_one_read();
  a_wrong_magic_breaks_for_good();
  a_lamp_count_that_disagrees_with_the_payload();
  an_oversized_payload();
  json_lines_escape_what_they_must();
  if (g_failures > 0) {
    std::printf("%d failure(s)\n", g_failures);
    return 1;
  }
  std::printf("all passed\n");
  return 0;
}
