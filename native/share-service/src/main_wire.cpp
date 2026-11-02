/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "main_wire.h"

#include <cstring>

namespace feq::share::service {
namespace {

namespace json = feq::share::json;

void put_u32(Bytes& out, std::uint32_t value) {
  for (int shift = 0; shift < 4; shift += 1) {
    out.push_back(static_cast<std::uint8_t>(value >> (8 * shift)));
  }
}

bool read_u32(std::span<const std::uint8_t> bytes, std::size_t& at,
              std::uint32_t& value) {
  if (bytes.size() - at < 4) {
    return false;
  }
  value = static_cast<std::uint32_t>(bytes[at]) |
          (static_cast<std::uint32_t>(bytes[at + 1]) << 8) |
          (static_cast<std::uint32_t>(bytes[at + 2]) << 16) |
          (static_cast<std::uint32_t>(bytes[at + 3]) << 24);
  at += 4;
  return true;
}

}  // namespace

json::Value WireMessage::attach(Bytes bytes, std::string_view as) {
  parts.push_back(std::move(bytes));
  return json::Value::object({
      {"$bin", json::Value::number(static_cast<double>(parts.size() - 1))},
      {"$as", json::Value::string(std::string(as))},
  });
}

const Bytes* WireMessage::part(const json::Value* marker) const {
  if (marker == nullptr || !marker->is_object()) {
    return nullptr;
  }
  const auto index = json::integer_at(*marker, "$bin");
  if (!index || *index < 0 || *index >= static_cast<double>(parts.size())) {
    return nullptr;
  }
  return &parts[static_cast<std::size_t>(*index)];
}

Bytes encode_frame(const WireMessage& message) {
  const std::string text = json::stringify(message.json);
  Bytes body;
  put_u32(body, static_cast<std::uint32_t>(text.size()));
  body.insert(body.end(), text.begin(), text.end());
  put_u32(body, static_cast<std::uint32_t>(message.parts.size()));
  for (const auto& part : message.parts) {
    put_u32(body, static_cast<std::uint32_t>(part.size()));
    body.insert(body.end(), part.begin(), part.end());
  }
  Bytes frame;
  frame.reserve(body.size() + 4);
  put_u32(frame, static_cast<std::uint32_t>(body.size()));
  frame.insert(frame.end(), body.begin(), body.end());
  return frame;
}

bool FrameAssembler::push(std::span<const std::uint8_t> bytes,
                          const std::function<void(WireMessage)>& accept) {
  pending_.insert(pending_.end(), bytes.begin(), bytes.end());
  std::size_t consumed = 0;
  for (;;) {
    const std::span<const std::uint8_t> rest(pending_.data() + consumed,
                                             pending_.size() - consumed);
    std::size_t at = 0;
    std::uint32_t length = 0;
    if (!read_u32(rest, at, length)) {
      break;
    }
    if (length > kMaxWireFrameBytes) {
      return false;
    }
    if (rest.size() - at < length) {
      break;
    }
    const std::span<const std::uint8_t> body = rest.subspan(at, length);
    consumed += at + length;
    std::size_t in = 0;
    std::uint32_t text_length = 0;
    if (!read_u32(body, in, text_length) || body.size() - in < text_length) {
      return false;
    }
    const auto parsed = json::parse(std::string_view(
        reinterpret_cast<const char*>(body.data() + in), text_length));
    in += text_length;
    std::uint32_t count = 0;
    if (!parsed || !read_u32(body, in, count)) {
      return false;
    }
    WireMessage message{*parsed, {}};
    for (std::uint32_t part = 0; part < count; part += 1) {
      std::uint32_t size = 0;
      if (!read_u32(body, in, size) || body.size() - in < size) {
        return false;
      }
      message.parts.emplace_back(body.begin() + static_cast<std::ptrdiff_t>(in),
                                 body.begin() + static_cast<std::ptrdiff_t>(in + size));
      in += size;
    }
    if (in != body.size()) {
      return false;
    }
    accept(std::move(message));
  }
  pending_.erase(pending_.begin(),
                 pending_.begin() + static_cast<std::ptrdiff_t>(consumed));
  return true;
}

}  // namespace feq::share::service
