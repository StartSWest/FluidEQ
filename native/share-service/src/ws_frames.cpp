/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// Frames written and read as `ws` writes and reads them (`ws_frames.h`);
// the handshake before them is `ws_handshake.cpp`.

#include "ws_frames.h"

namespace feq::share::service::ws {
namespace {

std::uint32_t read_be32(const std::uint8_t* at) {
  return (static_cast<std::uint32_t>(at[0]) << 24) |
         (static_cast<std::uint32_t>(at[1]) << 16) |
         (static_cast<std::uint32_t>(at[2]) << 8) | at[3];
}

}  // namespace

bool valid_status_code(int code) {
  return (code >= 1000 && code <= 1014 && code != 1004 && code != 1005 &&
          code != 1006) ||
         (code >= 3000 && code <= 4999);
}

bool valid_utf8(std::span<const std::uint8_t> bytes) {
  std::size_t at = 0;
  while (at < bytes.size()) {
    const std::uint8_t lead = bytes[at];
    if (lead < 0x80) {
      at += 1;
      continue;
    }
    std::size_t length = 0;
    std::uint32_t point = 0;
    std::uint32_t least = 0;
    if ((lead & 0xE0) == 0xC0) {
      length = 2;
      point = lead & 0x1F;
      least = 0x80;
    } else if ((lead & 0xF0) == 0xE0) {
      length = 3;
      point = lead & 0x0F;
      least = 0x800;
    } else if ((lead & 0xF8) == 0xF0) {
      length = 4;
      point = lead & 0x07;
      least = 0x10000;
    } else {
      return false;
    }
    if (at + length > bytes.size()) {
      return false;
    }
    for (std::size_t next = 1; next < length; next += 1) {
      if ((bytes[at + next] & 0xC0) != 0x80) {
        return false;
      }
      point = (point << 6) | (bytes[at + next] & 0x3F);
    }
    if (point < least || point > 0x10FFFF ||
        (point >= 0xD800 && point <= 0xDFFF)) {
      return false;
    }
    at += length;
  }
  return true;
}

Bytes frame(std::uint8_t opcode, std::span<const std::uint8_t> payload,
            const std::optional<std::array<std::uint8_t, 4>>& mask) {
  Bytes out;
  out.reserve(payload.size() + 14);
  out.push_back(static_cast<std::uint8_t>(0x80 | opcode));
  const std::uint8_t masked = mask ? 0x80 : 0x00;
  const std::size_t size = payload.size();
  if (size < 126) {
    out.push_back(static_cast<std::uint8_t>(masked | size));
  } else if (size <= 0xFFFF) {
    out.push_back(static_cast<std::uint8_t>(masked | 126));
    out.push_back(static_cast<std::uint8_t>(size >> 8));
    out.push_back(static_cast<std::uint8_t>(size));
  } else {
    out.push_back(static_cast<std::uint8_t>(masked | 127));
    const auto wide = static_cast<std::uint64_t>(size);
    for (int shift = 56; shift >= 0; shift -= 8) {
      out.push_back(static_cast<std::uint8_t>(wide >> shift));
    }
  }
  if (!mask) {
    out.insert(out.end(), payload.begin(), payload.end());
    return out;
  }
  out.insert(out.end(), mask->begin(), mask->end());
  for (std::size_t at = 0; at < size; at += 1) {
    out.push_back(static_cast<std::uint8_t>(payload[at] ^ (*mask)[at % 4]));
  }
  return out;
}

Bytes close_payload(std::optional<int> code, std::string_view reason) {
  if (!code) {
    return {};
  }
  Bytes out{static_cast<std::uint8_t>(*code >> 8),
            static_cast<std::uint8_t>(*code)};
  out.insert(out.end(), reason.begin(), reason.end());
  return out;
}

void FrameReader::fail(int code, std::string text, std::vector<Event>& events) {
  finished_ = true;
  Event event;
  event.kind = Event::Kind::kError;
  event.code = code;
  event.text = std::move(text);
  events.push_back(std::move(event));
}

void FrameReader::push(std::span<const std::uint8_t> bytes,
                       std::vector<Event>& events) {
  if (finished_) {
    return;
  }
  pending_.insert(pending_.end(), bytes.begin(), bytes.end());
  while (!finished_ && read_one(events)) {
  }
  pending_.erase(pending_.begin(),
                 pending_.begin() + static_cast<std::ptrdiff_t>(offset_));
  offset_ = 0;
}

bool FrameReader::read_one(std::vector<Event>& events) {
  const std::uint8_t* at = pending_.data() + offset_;
  const std::size_t available = pending_.size() - offset_;
  if (available < 2) {
    return false;
  }
  if ((at[0] & 0x30) != 0) {
    fail(1002, "RSV2 and RSV3 must be clear", events);
    return false;
  }
  const bool compressed = (at[0] & 0x40) != 0;
  if (compressed) {
    fail(1002, "RSV1 must be clear", events);
    return false;
  }
  const bool fin = (at[0] & 0x80) != 0;
  std::uint8_t opcode = at[0] & 0x0F;
  std::uint64_t length = at[1] & 0x7F;
  if (opcode == kContinuation) {
    if (fragmented_ == 0) {
      fail(1002, "invalid opcode 0", events);
      return false;
    }
    opcode = fragmented_;
  } else if (opcode == kText || opcode == kBinary) {
    if (fragmented_ != 0) {
      fail(1002, "invalid opcode " + std::to_string(opcode), events);
      return false;
    }
  } else if (opcode > 0x07 && opcode < 0x0B) {
    if (!fin) {
      fail(1002, "FIN must be set", events);
      return false;
    }
    if (length > 0x7D || (opcode == kClose && length == 1)) {
      fail(1002, "invalid payload length " + std::to_string(length), events);
      return false;
    }
  } else {
    fail(1002, "invalid opcode " + std::to_string(opcode), events);
    return false;
  }
  const bool masked = (at[1] & 0x80) != 0;
  if (server_ && !masked) {
    fail(1002, "MASK must be set", events);
    return false;
  }
  if (!server_ && masked) {
    fail(1002, "MASK must be clear", events);
    return false;
  }
  std::size_t header = 2;
  if (length == 126) {
    if (available < 4) {
      return false;
    }
    length = (static_cast<std::uint64_t>(at[2]) << 8) | at[3];
    header = 4;
  } else if (length == 127) {
    if (available < 10) {
      return false;
    }
    const std::uint32_t high = read_be32(at + 2);
    if (high > (1u << 21) - 1) {
      fail(1009, "Unsupported WebSocket frame: payload length > 2^53 - 1",
           events);
      return false;
    }
    length = (static_cast<std::uint64_t>(high) << 32) | read_be32(at + 6);
    header = 10;
  }
  // Counted at the header, as `ws` does, before any of the payload arrives.
  if (length > 0 && opcode < 0x08 &&
      total_payload_ + length > max_payload_) {
    fail(1009, "Max payload size exceeded", events);
    return false;
  }
  const std::size_t mask_at = header;
  if (masked) {
    header += 4;
  }
  if (available < header + length) {
    return false;
  }
  if (!fin && fragmented_ == 0) {
    fragmented_ = opcode;
  }
  Bytes data(at + header, at + header + length);
  if (masked) {
    for (std::size_t index = 0; index < data.size(); index += 1) {
      data[index] = static_cast<std::uint8_t>(data[index] ^
                                              at[mask_at + index % 4]);
    }
  }
  offset_ += header + static_cast<std::size_t>(length);
  if (opcode > 0x07) {
    Event event;
    if (opcode == kClose) {
      event.kind = Event::Kind::kClose;
      if (data.empty()) {
        event.code = 1005;
      } else {
        const int code = (data[0] << 8) | data[1];
        if (!valid_status_code(code)) {
          fail(1002, "invalid status code " + std::to_string(code), events);
          return false;
        }
        const std::span<const std::uint8_t> reason(data.data() + 2,
                                                   data.size() - 2);
        if (!valid_utf8(reason)) {
          fail(1007, "invalid UTF-8 sequence", events);
          return false;
        }
        event.code = code;
        event.text.assign(reason.begin(), reason.end());
      }
      finished_ = true;
    } else {
      event.kind = opcode == kPing ? Event::Kind::kPing : Event::Kind::kPong;
      event.data = std::move(data);
    }
    events.push_back(std::move(event));
    return !finished_;
  }
  total_payload_ += static_cast<std::size_t>(length);
  fragments_.insert(fragments_.end(), data.begin(), data.end());
  if (!fin) {
    return true;
  }
  Event event;
  event.kind = Event::Kind::kMessage;
  event.binary = opcode == kBinary;
  event.data = std::move(fragments_);
  fragments_.clear();
  total_payload_ = 0;
  fragmented_ = 0;
  if (!event.binary && !valid_utf8(event.data)) {
    fail(1007, "invalid UTF-8 sequence", events);
    return false;
  }
  events.push_back(std::move(event));
  return true;
}

}  // namespace feq::share::service::ws
