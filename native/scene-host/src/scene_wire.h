/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

// What main and the scene host say to each other, framed as the lighting
// helper's wire is: a magic word, the message's kind and its length, then
// the message (`src/main/lighting/sceneHostWire.ts` is the other end, and
// `lamp_messages_test.cpp` holds the two to the same bytes). Little-endian,
// as both ends run on the same machine.
//
// Main to host:
//   kShow     u32 id, u32 n + n * 3 swatch bytes, u32 1 with a scene, then:
//             u32 flags (1: guarded), f64 sensitivity, threshold, attack,
//             release, u32 params, each [u32 n + id, f64 value, min, max],
//             u32 n + vertex source, u32 n + fragment source,
//             f64 view x 4, f64 spectrum rect x 4,
//             u32 width, u32 height, u32 n + n WebP bytes (0: no artwork).
//             Without a scene the desk takes the swatch.
//   kDaylight u32 `DaylightMode`, f64 the time of day it holds.
//   kPause    u32 0 or 1.
//   kProfile  u32 hold, f64 idle speed.
//   kAccent   f64 red, green, blue, 0 to 1.
//   kPreview  u32 0 or 1: send the drawn picture too.
// Host to main:
//   kGrid     u32 width, u32 height, f64 level, beat, bass, mid, treble,
//             delta ms, time s, activity, u32 drawn (1: the scene, 0: its
//             swatch), width * height * 3 RGB bytes.
//   kPicture  u32 width, u32 height, width * height * 3 RGB bytes, top row
//             first: the scene of the grid just sent.
//   kLoaded   u32 id: that scene now draws.
//   kFailed   u32 id (0: the scene being drawn), u32 `FailReason`,
//             u32 n + what went wrong.
//
// The desktop backgrounds (`--mode desktop`, `desktop_messages.h`), each
// message naming its monitor first; kAccent and kProfile as above:
//   kMonitorOpen     u32 monitor, i32 x, i32 y, u32 width, u32 height,
//                    then kMonitorChoice's payload: a window over that
//                    rectangle, and how its scenes are drawn.
//   kMonitorShow     u32 monitor, u32 1 when FluidEQ measured the scene
//                    before release, then kShow's payload (no swatch drawn).
//   kMonitorDaylight u32 monitor, then kDaylight's payload.
//   kMonitorChoice   u32 monitor, then how its scenes are drawn: f64 the
//                    share a preset pins (negative: the ladder decides), f64
//                    the smallest share the ladder may take, u32 FSR, u32
//                    smoothing (0 off, 1 fast, 2 best), f64 the least ms
//                    between frames (0: every refresh).
//   kMonitorPause    u32 monitor, u32 0 or 1.
//   kMonitorClose    u32 monitor.
//   kMonitorWindow   u32 monitor, u64 its window (HWND), to be placed.
//   kMonitorLoaded   u32 monitor, u32 id.
//   kMonitorDrawn    u32 monitor, u32 id: its first frame is on screen.
//   kMonitorFailed   u32 monitor, then kFailed's payload.

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <optional>
#include <span>
#include <string>
#include <vector>

namespace feq::scene::wire {

inline constexpr std::uint32_t kMagic = 0x484E4353U;  // "SCNH"
inline constexpr std::size_t kHeaderBytes = 12;
/** No message is larger: an artwork of 2048 by 2048 and its scene. */
inline constexpr std::uint32_t kMaxPayloadBytes = 20U * 1024U * 1024U;

enum class Kind : std::uint32_t {
  kShow = 1,
  kDaylight = 2,
  kPause = 3,
  kProfile = 4,
  kAccent = 5,
  kPreview = 6,
  kMonitorOpen = 20,
  kMonitorShow = 21,
  kMonitorDaylight = 22,
  kMonitorChoice = 23,
  kMonitorPause = 24,
  kMonitorClose = 25,
  kGrid = 101,
  kPicture = 102,
  kLoaded = 103,
  kFailed = 104,
  kMonitorWindow = 120,
  kMonitorLoaded = 121,
  kMonitorDrawn = 122,
  kMonitorFailed = 123,
};

enum class DaylightMode : std::uint32_t {
  /** The value sent: the Brightness's, or the listener's own. */
  kFixed = 1,
  /** The computer's clock, read on every frame (`clockDaylight`). */
  kClock = 2,
};

/** `TLightingWorkerReply`'s reasons, by number. */
enum class FailReason : std::uint32_t {
  kNoContext = 1,
  kCompile = 2,
  kNoGuard = 3,
  kTooHeavy = 4,
  kArtwork = 5,
  /** The scene's own frame held the GPU until Windows reset it. */
  kGpuReset = 6,
  /** The GPU was reset under the scene: ask for it again. */
  kLost = 7,
};

/** Appends little-endian values and length-prefixed text to a message. */
class Writer final {
 public:
  explicit Writer(Kind kind) : kind_(kind) {}
  void u32(std::uint32_t value) { raw(&value, sizeof(value)); }
  void f64(double value) { raw(&value, sizeof(value)); }
  void text(const std::string& value) {
    u32(static_cast<std::uint32_t>(value.size()));
    raw(value.data(), value.size());
  }
  void bytes(std::span<const std::uint8_t> value) {
    raw(value.data(), value.size());
  }
  /** The whole message, header first. */
  std::vector<std::uint8_t> finish() const {
    std::vector<std::uint8_t> out(kHeaderBytes + payload_.size());
    const auto kind = static_cast<std::uint32_t>(kind_);
    const auto length = static_cast<std::uint32_t>(payload_.size());
    std::memcpy(out.data(), &kMagic, 4);
    std::memcpy(out.data() + 4, &kind, 4);
    std::memcpy(out.data() + 8, &length, 4);
    std::memcpy(out.data() + kHeaderBytes, payload_.data(), payload_.size());
    return out;
  }

 private:
  void raw(const void* data, std::size_t size) {
    const auto* begin = static_cast<const std::uint8_t*>(data);
    payload_.insert(payload_.end(), begin, begin + size);
  }
  Kind kind_;
  std::vector<std::uint8_t> payload_;
};

/** Reads one message's payload, refusing to read past its end. */
class Reader final {
 public:
  explicit Reader(std::span<const std::uint8_t> payload) : payload_(payload) {}
  bool ok() const { return ok_; }
  bool at_end() const { return at_ == payload_.size(); }
  std::uint32_t u32() {
    std::uint32_t value = 0;
    take(&value, sizeof(value));
    return value;
  }
  double f64() {
    double value = 0.0;
    take(&value, sizeof(value));
    return value;
  }
  std::string text() {
    const std::uint32_t size = u32();
    if (!ok_ || size > payload_.size() - at_) {
      ok_ = false;
      return {};
    }
    std::string value(reinterpret_cast<const char*>(payload_.data() + at_),
                      size);
    at_ += size;
    return value;
  }
  std::span<const std::uint8_t> bytes(std::size_t size) {
    if (!ok_ || size > payload_.size() - at_) {
      ok_ = false;
      return {};
    }
    const auto value = payload_.subspan(at_, size);
    at_ += size;
    return value;
  }

 private:
  void take(void* into, std::size_t size) {
    if (!ok_ || size > payload_.size() - at_) {
      ok_ = false;
      return;
    }
    std::memcpy(into, payload_.data() + at_, size);
    at_ += size;
  }
  std::span<const std::uint8_t> payload_;
  std::size_t at_ = 0;
  bool ok_ = true;
};

/** Collects bytes from a stream and hands out whole messages. */
class Framer final {
 public:
  void feed(std::span<const std::uint8_t> bytes) {
    if (consumed_ > 0) {
      buffer_.erase(buffer_.begin(),
                    buffer_.begin() + static_cast<std::ptrdiff_t>(consumed_));
      consumed_ = 0;
    }
    buffer_.insert(buffer_.end(), bytes.begin(), bytes.end());
  }
  /** The next whole message, or nothing yet; `broken` on a bad header. */
  std::optional<std::pair<Kind, std::span<const std::uint8_t>>> next(
      bool& broken) {
    broken = false;
    const std::size_t left = buffer_.size() - consumed_;
    if (left < kHeaderBytes) {
      return std::nullopt;
    }
    const std::uint8_t* at = buffer_.data() + consumed_;
    std::uint32_t magic = 0;
    std::uint32_t kind = 0;
    std::uint32_t length = 0;
    std::memcpy(&magic, at, 4);
    std::memcpy(&kind, at + 4, 4);
    std::memcpy(&length, at + 8, 4);
    if (magic != kMagic || length > kMaxPayloadBytes) {
      broken = true;
      return std::nullopt;
    }
    if (left < kHeaderBytes + length) {
      return std::nullopt;
    }
    consumed_ += kHeaderBytes + length;
    return std::make_pair(static_cast<Kind>(kind),
                          std::span<const std::uint8_t>(at + kHeaderBytes,
                                                        length));
  }

 private:
  std::vector<std::uint8_t> buffer_;
  std::size_t consumed_ = 0;
};

}  // namespace feq::scene::wire
