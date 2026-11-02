/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/** What the runtime's two halves both use to read and write JSON. */

#include <optional>
#include <string>
#include <string_view>

#include "fluideq/share/json.h"

namespace feq::share::service::runtime_detail {

namespace json = feq::share::json;

inline json::Value number(double value) { return json::Value::number(value); }

inline json::Value text(const std::string& value) {
  return json::Value::string(value);
}

inline std::optional<std::string> optional_text(const json::Value& record,
                                                std::string_view key) {
  const std::string* found = json::string_at(record, key);
  return found != nullptr ? std::optional<std::string>(*found) : std::nullopt;
}

}  // namespace feq::share::service::runtime_detail
