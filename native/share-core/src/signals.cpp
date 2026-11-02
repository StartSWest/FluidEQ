/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/share/signals.h"

#include <cmath>
#include <string_view>

namespace feq::share::signals {
namespace {

using json::Value;

/** `typeof x === 'boolean'` for a member, or its absence (`=== undefined`). */
bool absent_or_bool(const Value& record, std::string_view key) {
  const Value* found = record.get(key);
  return found == nullptr || found->is_bool();
}

bool is_string_value(const Value* value) {
  return value != nullptr && value->is_string();
}

bool is_bool_value(const Value* value) {
  return value != nullptr && value->is_bool();
}

/** `typeof x === 'string' && x === expected`. */
bool equals(const Value* value, std::string_view expected) {
  return is_string_value(value) && value->as_string() == expected;
}

bool url_token(std::string_view text, std::size_t length) {
  if (text.size() != length) {
    return false;
  }
  for (const char c : text) {
    const bool letter = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
                        (c >= '0' && c <= '9') || c == '_' || c == '-';
    if (!letter) {
      return false;
    }
  }
  return true;
}

/** A finite count of milliseconds that is not negative (`isMilliseconds`). */
bool is_milliseconds(const Value* value) {
  return value != nullptr && value->is_number() &&
         std::isfinite(value->as_number()) && value->as_number() >= 0.0;
}

/** `typeof x === 'string' && x.length <= limit`, or absent. */
bool absent_or_text_within(const Value& record, std::string_view key,
                           std::size_t limit) {
  const Value* found = record.get(key);
  return found == nullptr ||
         (found->is_string() && json::utf16_length(found->as_string()) <= limit);
}

/** A name: a string, not blank once trimmed, at most 128 long. */
bool is_name(const Value* value) {
  return is_string_value(value) &&
         !json::trim(value->as_string()).empty() &&
         json::utf16_length(value->as_string()) <= 128;
}

}  // namespace

bool is_computer_id(const Value* value) {
  return is_string_value(value) && url_token(value->as_string(), 32);
}

bool is_group_endpoint(const Value* value) {
  if (!json::is_record(value)) {
    return false;
  }
  const auto port = json::integer_at(*value, "port");
  const Value* addresses = value->get("addresses");
  if (!is_computer_id(value->get("computerId")) ||
      !is_name(value->get("deviceName")) || !port || *port <= 0 ||
      *port > 65535 || addresses == nullptr || !addresses->is_array() ||
      addresses->items().size() > 8) {
    return false;
  }
  for (const Value& address : addresses->items()) {
    if (!address.is_string() || json::utf16_length(address.as_string()) > 15) {
      return false;
    }
  }
  return true;
}

bool is_group_hello(const Value* value) {
  if (!json::is_record(value)) {
    return false;
  }
  const Value* version = value->get("version");
  const Value* known = value->get("known");
  if (version == nullptr || !version->is_number() ||
      version->as_number() != 1.0 || !is_group_endpoint(value->get("endpoint")) ||
      known == nullptr || !known->is_array() ||
      known->items().size() > kMaxGroupComputers) {
    return false;
  }
  for (const Value& id : known->items()) {
    if (!is_computer_id(&id)) {
      return false;
    }
  }
  return true;
}

bool is_group_link(const Value* value) {
  if (!is_group_endpoint(value)) {
    return false;
  }
  const Value* secret = value->get("secret");
  return is_computer_id(value->get("issuer")) && is_string_value(secret) &&
         url_token(secret->as_string(), 43) &&
         absent_or_bool(*value, "introduced");
}

bool is_now_playing(const Value* value) {
  if (!json::is_record(value)) {
    return false;
  }
  const Value* title = value->get("title");
  return is_string_value(title) && !json::trim(title->as_string()).empty() &&
         json::utf16_length(title->as_string()) <= 256 &&
         absent_or_text_within(*value, "subtitle", 256) &&
         absent_or_text_within(*value, "artist", 256) &&
         is_bool_value(value->get("isPlaying")) &&
         is_milliseconds(value->get("positionMs")) &&
         is_milliseconds(value->get("durationMs")) &&
         is_bool_value(value->get("canNext")) &&
         is_bool_value(value->get("canPrevious")) &&
         is_bool_value(value->get("canStep")) &&
         is_bool_value(value->get("canStop"));
}

bool is_transport_command(const Value& value) {
  const Value* command = value.get("command");
  if (!is_string_value(command)) {
    return false;
  }
  const std::string& name = command->as_string();
  if (name == "toggle" || name == "play" || name == "pause" || name == "stop" ||
      name == "next" || name == "previous") {
    return true;
  }
  if (name == "nudge") {
    const Value* delta = value.get("deltaMs");
    return delta != nullptr && delta->is_number() &&
           std::isfinite(delta->as_number()) &&
           std::abs(delta->as_number()) <= kNudgeLimitMs;
  }
  if (name == "seek") {
    const auto position = json::integer_at(value, "positionMs");
    // `Number.isSafeInteger`: whole, and within 2^53 - 1.
    return position && std::abs(*position) <= 9007199254740991.0 &&
           *position >= 0.0;
  }
  return false;
}

bool is_duplex(const Value* value) {
  return json::is_record(value) && is_bool_value(value->get("sends")) &&
         is_bool_value(value->get("plays")) && absent_or_bool(*value, "paused");
}

bool is_signal(const Value* value) {
  if (!json::is_record(value)) {
    return false;
  }
  const Value* kind = value->get("kind");
  if (equals(kind, "group-link")) {
    return is_group_link(value->get("link"));
  }
  if (equals(kind, "stop")) {
    return absent_or_bool(*value, "forget");
  }
  if (equals(kind, "now-playing")) {
    const Value* playing = value->get("playing");
    return (playing == nullptr || is_now_playing(playing)) &&
           absent_or_bool(*value, "started") &&
           absent_or_bool(*value, "singlePlayer");
  }
  if (equals(kind, "transport")) {
    return is_transport_command(*value);
  }
  if (equals(kind, "stream-mode")) {
    const Value* duplex = value->get("duplex");
    const Value* group = value->get("group");
    return (equals(value->get("mode"), "music") ||
            equals(value->get("mode"), "video")) &&
           (duplex == nullptr || is_duplex(duplex)) &&
           (group == nullptr || is_group_hello(group));
  }
  if (equals(kind, "peer-ready")) {
    const Value* computer = value->get("computerId");
    const Value* address = value->get("address");
    return absent_or_bool(*value, "introduced") &&
           (computer == nullptr ||
            (computer->is_string() &&
             json::utf16_length(computer->as_string()) <= 64)) &&
           is_name(value->get("deviceName")) &&
           (address == nullptr ||
            (address->is_string() && json::utf16_length(address->as_string()) <= 64));
  }
  return false;
}

bool is_lan_signal(const Value* value) {
  if (!json::is_record(value)) {
    return false;
  }
  const Value* peer = value->get("peerId");
  return is_string_value(peer) && !peer->as_string().empty() &&
         json::utf16_length(peer->as_string()) <= 128 &&
         is_signal(value->get("signal"));
}

}  // namespace feq::share::signals
