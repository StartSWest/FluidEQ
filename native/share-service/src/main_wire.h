/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * What main and this service say to each other, on the service's standard
 * input and output: the same requests, answers and events the Node service
 * exchanged over its message port (`shareAudio/protocol.ts`), each a frame
 * of JSON with its binary parts beside it rather than inside it.
 *
 *   frame  := u32 body length, body          (little-endian throughout)
 *   body   := u32 JSON length, JSON, u32 part count, part*
 *   part   := u32 length, bytes
 *
 * A binary value in the JSON is `{"$bin": index, "$as": type}`: the part at
 * that index, as an `ArrayBuffer`, a `Float32Array` or a `Uint8Array` on the
 * TypeScript side (`shareServiceWire.ts`, which writes and reads the same).
 */

#include <cstdint>
#include <functional>
#include <span>
#include <string_view>
#include <vector>

#include "fluideq/share/json.h"

namespace feq::share::service {

using Bytes = std::vector<std::uint8_t>;

/** The largest frame either side accepts. */
inline constexpr std::uint32_t kMaxWireFrameBytes = 16 * 1024 * 1024;

struct WireMessage {
  share::json::Value json;
  std::vector<Bytes> parts;

  /** Adds a binary part; the marker that names it in the JSON. */
  share::json::Value attach(Bytes bytes, std::string_view as);
  /** The part a marker names; nothing for a value that is not one. */
  const Bytes* part(const share::json::Value* marker) const;
};

Bytes encode_frame(const WireMessage& message);

/** Frames in, messages out; a partial read is not a frame boundary. */
class FrameAssembler {
 public:
  /** False once a frame could not be read: the stream is not ours. */
  bool push(std::span<const std::uint8_t> bytes,
            const std::function<void(WireMessage)>& accept);

 private:
  Bytes pending_;
};

}  // namespace feq::share::service
