/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * What `lan.cpp` and `lan_listen.cpp` both use: this computer's addresses
 * as the link chooses them, and the few JSON shapes they both build.
 */

#include <string>
#include <string_view>
#include <vector>

#include "fluideq/share/addresses.h"
#include "fluideq/share/json.h"
#include "system_adapters.h"

namespace feq::share::service::lan_detail {

namespace json = feq::share::json;

inline std::string text_at(const json::Value& record, std::string_view key) {
  const std::string* found = json::string_at(record, key);
  return found != nullptr ? *found : std::string();
}

/** `lanAddresses()`: this computer's private addresses, best first. */
inline std::vector<std::string> lan_addresses() {
  return share::addresses::lan_addresses(system_adapters());
}

/** `discoveryTargets()`: where a "who is there?" goes. */
inline std::vector<std::string> discovery_targets() {
  return share::addresses::discovery_targets(system_adapters());
}

inline json::Value strings(const std::vector<std::string>& values) {
  std::vector<json::Value> items;
  for (const auto& value : values) {
    items.push_back(json::Value::string(value));
  }
  return json::Value::array(std::move(items));
}

/** `{peerId, signal}`, as every control message travels. */
inline json::Value signal_message(const std::string& peer_id,
                                  json::Value signal) {
  return json::Value::object({
      {"peerId", json::Value::string(peer_id)},
      {"signal", std::move(signal)},
  });
}

}  // namespace feq::share::service::lan_detail
