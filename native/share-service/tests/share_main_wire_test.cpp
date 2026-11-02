/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// What main and the service say to each other, held to the bytes main's
// own TypeScript writes (`shareServiceWire.ts`, through
// `share_wire_fixture.h`): the service reads main's frame into the same JSON
// and the same binary parts, writes that message back to the very same
// bytes, and reads a frame however the pipe splits it — while a frame that
// says it is larger than any frame may be, or whose parts run past its end,
// is refused rather than read.

#include <cstdio>
#include <span>
#include <string>
#include <vector>

#include "fluideq/share/json.h"
#include "main_wire.h"
#include "share_wire_fixture.h"

namespace {

namespace service = feq::share::service;
namespace fixture = feq::share::fixture;
namespace json = feq::share::json;

int failures = 0;

void check(bool ok, const std::string& what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what.c_str());
    ++failures;
  }
}

std::vector<service::WireMessage> read_all(std::span<const std::uint8_t> bytes,
                                           std::size_t step, bool& readable) {
  service::FrameAssembler assembler;
  std::vector<service::WireMessage> messages;
  readable = true;
  for (std::size_t at = 0; at < bytes.size() && readable; at += step) {
    const std::size_t count = std::min(step, bytes.size() - at);
    readable = assembler.push(bytes.subspan(at, count),
                              [&messages](service::WireMessage message) {
                                messages.push_back(std::move(message));
                              });
  }
  return messages;
}

}  // namespace

int main() {
  const std::span<const std::uint8_t> frame(fixture::kMainWireFrame,
                                            sizeof fixture::kMainWireFrame);
  bool readable = false;
  const auto whole = read_all(frame, frame.size(), readable);
  check(readable && whole.size() == 1, "main's frame is read as one message");
  if (whole.size() == 1) {
    const service::WireMessage& message = whole[0];
    check(json::stringify(message.json) == fixture::kMainWireJson,
          "into main's own JSON, markers and all");
    check(message.parts.size() == 3, "with its three binary parts");
    const json::Value* args = message.json.get("args");
    const service::Bytes* text =
        args != nullptr && args->items().size() > 3
            ? message.part(&args->items()[3])
            : nullptr;
    check(text != nullptr &&
              std::string(text->begin(), text->end()) == "pipe token lan",
          "a part is found by its marker");
    check(args != nullptr && args->items().size() > 6 &&
              args->items()[6].is_null(),
          "an empty argument reads as null");
    check(service::encode_frame(message) ==
              service::Bytes(frame.begin(), frame.end()),
          "and written back to main's very bytes");
  }
  const auto split = read_all(frame, 1, readable);
  check(readable && split.size() == 1 &&
            json::stringify(split[0].json) == fixture::kMainWireJson,
        "a frame a byte at a time is the same frame");
  service::Bytes twice(frame.begin(), frame.end());
  twice.insert(twice.end(), frame.begin(), frame.end());
  const auto both = read_all(twice, twice.size(), readable);
  check(readable && both.size() == 2, "two frames in one read are two messages");

  service::Bytes oversized{0, 0, 0, 0x02};
  read_all(oversized, oversized.size(), readable);
  check(!readable, "a frame larger than any frame may be is refused");
  service::Bytes overrun(frame.begin(), frame.end());
  // The last part's length, one byte longer than what follows it.
  overrun[overrun.size() - 4 - 3] = static_cast<std::uint8_t>(4);
  read_all(overrun, overrun.size(), readable);
  check(!readable, "a part that runs past its frame is refused");
  // One byte more than the parts account for, inside the frame's own length.
  service::Bytes trailing(frame.begin(), frame.end());
  trailing.push_back(0);
  trailing[0] = static_cast<std::uint8_t>(trailing[0] + 1);
  read_all(trailing, trailing.size(), readable);
  check(!readable, "a frame holding more than its parts is refused");
  service::Bytes control(frame.begin(), frame.end());
  read_all(control, control.size(), readable);
  check(readable, "the control: the frame itself is read");

  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("share main wire: main's frames, both ways\n");
  return 0;
}
