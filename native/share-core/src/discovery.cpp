/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/share/discovery.h"

#include "fluideq/share/json.h"

namespace feq::share::discovery {
namespace {

constexpr std::string_view kProtocol = "FLUIDEQ-LAN-2";
constexpr std::string_view kIdContext = "FluidEQ LAN listener discovery";

std::string discovery_id(std::string_view secret) {
  return crypto::base64url(
      crypto::hmac_sha256(crypto::bytes_of(secret), crypto::bytes_of(kIdContext)));
}

std::string announcement_mac(std::string_view secret, int port,
                             std::string_view device_name) {
  std::string input(kProtocol);
  input.push_back('\0');
  input += std::to_string(port);
  input.push_back('\0');
  input.append(device_name);
  return crypto::base64url(
      crypto::hmac_sha256(crypto::bytes_of(secret), crypto::bytes_of(input)));
}

/** `authenticatedEqual`: both read as base64, compared in constant time. */
bool authenticated_equal(std::string_view left, std::string_view right) {
  return crypto::timing_safe_equal(crypto::from_base64(left),
                                   crypto::from_base64(right));
}

std::optional<json::Value> parse_message(std::span<const std::uint8_t> data) {
  if (data.empty() || data.size() > kMaxBytes) {
    return std::nullopt;
  }
  auto value = json::parse(std::string_view(
      reinterpret_cast<const char*>(data.data()), data.size()));
  if (!value || !value->is_object()) {
    return std::nullopt;
  }
  return value;
}

crypto::Bytes bytes_of(const json::Value& value) {
  const std::string text = json::stringify(value);
  return crypto::Bytes(text.begin(), text.end());
}

}  // namespace

crypto::Bytes encode_query(std::string_view secret) {
  return bytes_of(json::Value::object({
      {"id", json::Value::string(discovery_id(secret))},
      {"kind", json::Value::string("find-listener")},
      {"protocol", json::Value::string(std::string(kProtocol))},
  }));
}

bool is_query(std::span<const std::uint8_t> data, std::string_view secret) {
  const auto query = parse_message(data);
  if (!query) {
    return false;
  }
  const std::string* protocol = json::string_at(*query, "protocol");
  const std::string* kind = json::string_at(*query, "kind");
  const std::string* id = json::string_at(*query, "id");
  return protocol != nullptr && *protocol == kProtocol && kind != nullptr &&
         *kind == "find-listener" && id != nullptr &&
         authenticated_equal(*id, discovery_id(secret));
}

crypto::Bytes encode_announcement(std::string_view secret, int port,
                                  std::string_view device_name) {
  return bytes_of(json::Value::object({
      {"deviceName", json::Value::string(std::string(device_name))},
      {"id", json::Value::string(discovery_id(secret))},
      {"kind", json::Value::string("listener-ready")},
      {"mac", json::Value::string(announcement_mac(secret, port, device_name))},
      {"port", json::Value::number(port)},
      {"protocol", json::Value::string(std::string(kProtocol))},
  }));
}

std::optional<Announcement> decode_announcement(
    std::span<const std::uint8_t> data, std::string_view secret) {
  const auto announcement = parse_message(data);
  if (!announcement) {
    return std::nullopt;
  }
  const std::string* protocol = json::string_at(*announcement, "protocol");
  const std::string* kind = json::string_at(*announcement, "kind");
  const std::string* id = json::string_at(*announcement, "id");
  const std::string* device = json::string_at(*announcement, "deviceName");
  const std::string* mac = json::string_at(*announcement, "mac");
  const auto port = json::integer_at(*announcement, "port");
  if (protocol == nullptr || *protocol != kProtocol || kind == nullptr ||
      *kind != "listener-ready" || id == nullptr ||
      !authenticated_equal(*id, discovery_id(secret)) || device == nullptr ||
      json::trim(*device).empty() || json::utf16_length(*device) > 128 ||
      !port || *port < 1 || *port > 65535 || mac == nullptr ||
      !authenticated_equal(
          *mac, announcement_mac(secret, static_cast<int>(*port), *device))) {
    return std::nullopt;
  }
  return Announcement{*device, static_cast<int>(*port)};
}

}  // namespace feq::share::discovery
