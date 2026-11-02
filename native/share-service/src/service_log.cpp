/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "service_log.h"

#include <array>
#include <cstdio>

#include "fluideq/share/crypto.h"

namespace feq::share::service {
namespace {

std::function<void(const std::string&)>& sink() {
  static std::function<void(const std::string&)> current;
  return current;
}

}  // namespace

void set_log_sink(std::function<void(const std::string& line)> next) {
  sink() = std::move(next);
}

void log_info(std::string_view message, const share::json::Value& detail) {
  const std::string line = share::json::stringify(share::json::Value::object({
      {"message", share::json::Value::string(std::string(message))},
      {"detail", detail},
  }));
  if (sink()) {
    sink()(line);
    return;
  }
  std::fprintf(stderr, "%s\n", line.c_str());
  std::fflush(stderr);
}

std::string random_uuid() {
  std::array<std::uint8_t, 16> bytes{};
  share::crypto::random_bytes(bytes);
  bytes[6] = static_cast<std::uint8_t>((bytes[6] & 0x0F) | 0x40);
  bytes[8] = static_cast<std::uint8_t>((bytes[8] & 0x3F) | 0x80);
  constexpr std::string_view kHex = "0123456789abcdef";
  std::string out;
  out.reserve(36);
  for (std::size_t at = 0; at < bytes.size(); at += 1) {
    if (at == 4 || at == 6 || at == 8 || at == 10) {
      out.push_back('-');
    }
    out.push_back(kHex[bytes[at] >> 4]);
    out.push_back(kHex[bytes[at] & 0x0F]);
  }
  return out;
}

std::string encode_uri_component(std::string_view text) {
  constexpr std::string_view kKept = "-_.!~*'()";
  constexpr std::string_view kHex = "0123456789ABCDEF";
  std::string out;
  for (const char c : text) {
    const auto byte = static_cast<unsigned char>(c);
    if ((byte >= 'A' && byte <= 'Z') || (byte >= 'a' && byte <= 'z') ||
        (byte >= '0' && byte <= '9') ||
        kKept.find(c) != std::string_view::npos) {
      out.push_back(c);
    } else {
      out.push_back('%');
      out.push_back(kHex[byte >> 4]);
      out.push_back(kHex[byte & 0x0F]);
    }
  }
  return out;
}

}  // namespace feq::share::service
