/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

// What the app sends the lighting helper, and how the helper reads it.
//
// App → helper is binary: a colour frame for one device, about thirty times a
// second. Helper → app is one line of JSON per event (a device appeared, went
// away, or stopped being FluidEQ's to light); those are rare, and JSON is what
// the main process reads without a second parser.
//
// Held to the TypeScript side (`src/main/lighting/lightingWire.ts`) by
// `tests/wire_test.cpp` and `lightingWire.test.ts`. A field one side lays out
// differently does not fail loudly — it lights the wrong lamps in the wrong
// colours — so both are extended in the same commit.

#include <cstddef>
#include <cstdint>
#include <cstring>
#include <span>
#include <vector>

namespace fluideq_lighting {

// "FLH1", little-endian.
inline constexpr std::uint32_t kWireMagic = 0x31484C46U;
inline constexpr std::uint32_t kProtocolVersion = 1;

// Payload: u32 device index, u32 lamp count, then three bytes (R, G, B) per
// lamp, in lamp index order.
inline constexpr std::uint32_t kColoursFrame = 1;

inline constexpr std::size_t kHeaderBytes = 12;
// A keyboard is about a hundred and thirty lamps; nothing Windows describes
// comes near this. It bounds what a corrupt header can make the reader wait
// for.
inline constexpr std::uint32_t kMaxLamps = 4096;
inline constexpr std::uint32_t kMaxPayloadBytes = 8 + kMaxLamps * 3;

struct ColoursFrame {
  std::uint32_t device = 0;
  std::uint32_t lamp_count = 0;
  // Points into the reader's buffer; valid until the next `feed`.
  const std::uint8_t* rgb = nullptr;
};

enum class ReadResult {
  // Nothing complete yet.
  kNeedMore,
  kColours,
  // The stream cannot be trusted from here on. Never resynchronised: a
  // guess at where the next frame starts is how the wrong lamps get lit.
  kBroken,
};

inline std::uint32_t read_u32(const std::uint8_t* at) {
  std::uint32_t value = 0;
  std::memcpy(&value, at, sizeof(value));
  return value;
}

// Accumulates bytes from a pipe and hands back one frame at a time.
class FrameReader final {
 public:
  void feed(std::span<const std::uint8_t> bytes) {
    // Drop what the previous frame consumed before growing the buffer, so
    // the buffer never holds more than one partial frame.
    if (consumed_ > 0) {
      buffer_.erase(buffer_.begin(),
                    buffer_.begin() + static_cast<std::ptrdiff_t>(consumed_));
      consumed_ = 0;
    }
    buffer_.insert(buffer_.end(), bytes.begin(), bytes.end());
  }

  ReadResult next(ColoursFrame& out) {
    if (broken_) {
      return ReadResult::kBroken;
    }
    const std::size_t available = buffer_.size() - consumed_;
    if (available < kHeaderBytes) {
      return ReadResult::kNeedMore;
    }
    const std::uint8_t* head = buffer_.data() + consumed_;
    const std::uint32_t magic = read_u32(head);
    const std::uint32_t kind = read_u32(head + 4);
    const std::uint32_t payload = read_u32(head + 8);
    if (magic != kWireMagic || kind != kColoursFrame ||
        payload > kMaxPayloadBytes || payload < 8) {
      broken_ = true;
      return ReadResult::kBroken;
    }
    if (available < kHeaderBytes + payload) {
      return ReadResult::kNeedMore;
    }
    const std::uint8_t* body = head + kHeaderBytes;
    const std::uint32_t lamps = read_u32(body + 4);
    if (lamps > kMaxLamps || payload != 8 + lamps * 3) {
      broken_ = true;
      return ReadResult::kBroken;
    }
    out.device = read_u32(body);
    out.lamp_count = lamps;
    out.rgb = body + 8;
    consumed_ += kHeaderBytes + payload;
    return ReadResult::kColours;
  }

 private:
  std::vector<std::uint8_t> buffer_;
  std::size_t consumed_ = 0;
  bool broken_ = false;
};

}  // namespace fluideq_lighting
