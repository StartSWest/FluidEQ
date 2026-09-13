/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

// One JSON object per line, built by hand: the helper writes a handful of
// fixed shapes and never reads any, which is too little to take a library
// for. Every string passes through `quoted`, which is the one place a device
// name with a quote or a control character in it could otherwise break the
// line the main process parses.

#include <charconv>
#include <cstdint>
#include <string>
#include <string_view>

namespace fluideq_lighting {

inline void append_quoted(std::string& out, std::string_view text) {
  static constexpr char kHex[] = "0123456789abcdef";
  out.push_back('"');
  for (const char raw : text) {
    const auto c = static_cast<unsigned char>(raw);
    switch (c) {
      case '"':
        out += "\\\"";
        break;
      case '\\':
        out += "\\\\";
        break;
      case '\n':
        out += "\\n";
        break;
      case '\r':
        out += "\\r";
        break;
      case '\t':
        out += "\\t";
        break;
      default:
        if (c < 0x20) {
          out += "\\u00";
          out.push_back(kHex[c >> 4]);
          out.push_back(kHex[c & 0x0F]);
        } else {
          // UTF-8 passes through untouched: JSON is UTF-8 on the wire.
          out.push_back(raw);
        }
    }
  }
  out.push_back('"');
}

class JsonLine final {
 public:
  explicit JsonLine(std::string_view type) {
    text_ = "{\"type\":";
    append_quoted(text_, type);
  }

  JsonLine& text(std::string_view key, std::string_view value) {
    field(key);
    append_quoted(text_, value);
    return *this;
  }

  JsonLine& integer(std::string_view key, std::int64_t value) {
    field(key);
    char digits[24];
    const auto result = std::to_chars(digits, digits + sizeof(digits), value);
    text_.append(digits, result.ptr);
    return *this;
  }

  JsonLine& boolean(std::string_view key, bool value) {
    field(key);
    text_ += value ? "true" : "false";
    return *this;
  }

  // Metres, to the micrometre — the precision the HID descriptor carries.
  JsonLine& number(std::string_view key, double value) {
    field(key);
    append_number(value);
    return *this;
  }

  JsonLine& numbers(std::string_view key, const float* values,
                    std::size_t count) {
    field(key);
    text_.push_back('[');
    for (std::size_t index = 0; index < count; ++index) {
      if (index > 0) {
        text_.push_back(',');
      }
      append_number(values[index]);
    }
    text_.push_back(']');
    return *this;
  }

  // The finished line, with its newline.
  [[nodiscard]] std::string finish() const { return text_ + "}\n"; }

 private:
  void field(std::string_view key) {
    text_.push_back(',');
    append_quoted(text_, key);
    text_.push_back(':');
  }

  void append_number(double value) {
    // Not-a-number and infinities are not JSON. A descriptor reporting one is
    // broken; zero places the lamp at the corner instead of breaking the line.
    if (!(value == value) || value > 1e9 || value < -1e9) {
      value = 0;
    }
    char digits[32];
    const auto result = std::to_chars(digits, digits + sizeof(digits), value,
                                      std::chars_format::general, 7);
    text_.append(digits, result.ptr);
  }

  std::string text_;
};

}  // namespace fluideq_lighting
