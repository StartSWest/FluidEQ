/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/share/json.h"

#include <algorithm>
#include <array>
#include <charconv>
#include <cmath>
#include <cstdint>
#include <cstdlib>

namespace feq::share::json {
namespace {

/** Deeper than any message two FluidEQs send; a guard for the stack. */
constexpr int kMaxDepth = 256;

void append_utf8(std::string& out, std::uint32_t code) {
  if (code < 0x80) {
    out.push_back(static_cast<char>(code));
  } else if (code < 0x800) {
    out.push_back(static_cast<char>(0xC0 | (code >> 6)));
    out.push_back(static_cast<char>(0x80 | (code & 0x3F)));
  } else if (code < 0x10000) {
    out.push_back(static_cast<char>(0xE0 | (code >> 12)));
    out.push_back(static_cast<char>(0x80 | ((code >> 6) & 0x3F)));
    out.push_back(static_cast<char>(0x80 | (code & 0x3F)));
  } else {
    out.push_back(static_cast<char>(0xF0 | (code >> 18)));
    out.push_back(static_cast<char>(0x80 | ((code >> 12) & 0x3F)));
    out.push_back(static_cast<char>(0x80 | ((code >> 6) & 0x3F)));
    out.push_back(static_cast<char>(0x80 | (code & 0x3F)));
  }
}

constexpr std::uint32_t kReplacement = 0xFFFD;

/**
 * The next code point of well-formed UTF-8 at `at`, or U+FFFD for the
 * longest ill-formed part there (the WHATWG decoder's rule, which Node's
 * `toString('utf8')` follows): `at` moves past what was read.
 */
std::uint32_t next_code(std::string_view bytes, std::size_t& at) {
  const auto byte = [&](std::size_t index) {
    return static_cast<std::uint8_t>(bytes[index]);
  };
  const std::uint8_t lead = byte(at);
  if (lead < 0x80) {
    at += 1;
    return lead;
  }
  std::size_t needed = 0;
  std::uint32_t code = 0;
  std::uint8_t lower = 0x80;
  std::uint8_t upper = 0xBF;
  if (lead >= 0xC2 && lead <= 0xDF) {
    needed = 1;
    code = lead & 0x1F;
  } else if (lead >= 0xE0 && lead <= 0xEF) {
    needed = 2;
    code = lead & 0x0F;
    lower = lead == 0xE0 ? 0xA0 : 0x80;
    upper = lead == 0xED ? 0x9F : 0xBF;
  } else if (lead >= 0xF0 && lead <= 0xF4) {
    needed = 3;
    code = lead & 0x07;
    lower = lead == 0xF0 ? 0x90 : 0x80;
    upper = lead == 0xF4 ? 0x8F : 0xBF;
  } else {
    at += 1;
    return kReplacement;
  }
  std::size_t read = 1;
  for (std::size_t index = 0; index < needed; ++index) {
    if (at + read >= bytes.size()) {
      at += read;
      return kReplacement;
    }
    const std::uint8_t next = byte(at + read);
    if (next < lower || next > upper) {
      at += read;
      return kReplacement;
    }
    lower = 0x80;
    upper = 0xBF;
    code = (code << 6) | (next & 0x3F);
    read += 1;
  }
  at += read;
  return code;
}

bool is_js_space(std::uint32_t code) {
  switch (code) {
    case 0x09: case 0x0A: case 0x0B: case 0x0C: case 0x0D: case 0x20:
    case 0xA0: case 0x1680: case 0x2028: case 0x2029: case 0x202F:
    case 0x205F: case 0x3000: case 0xFEFF:
      return true;
    default:
      return code >= 0x2000 && code <= 0x200A;
  }
}

class Parser {
 public:
  explicit Parser(std::string_view text) : text_(text) {}

  std::optional<Value> document() {
    space();
    auto value = parse_value(0);
    if (!value) {
      return std::nullopt;
    }
    space();
    if (at_ != text_.size()) {
      return std::nullopt;
    }
    return value;
  }

 private:
  void space() {
    while (at_ < text_.size() &&
           (text_[at_] == ' ' || text_[at_] == '\t' || text_[at_] == '\n' ||
            text_[at_] == '\r')) {
      ++at_;
    }
  }

  bool take(char c) {
    if (at_ < text_.size() && text_[at_] == c) {
      ++at_;
      return true;
    }
    return false;
  }

  bool word(std::string_view expected) {
    if (text_.substr(at_, expected.size()) == expected) {
      at_ += expected.size();
      return true;
    }
    return false;
  }

  std::optional<Value> parse_value(int depth) {
    if (depth > kMaxDepth || at_ >= text_.size()) {
      return std::nullopt;
    }
    const char c = text_[at_];
    if (c == '{') {
      return parse_object(depth);
    }
    if (c == '[') {
      return parse_array(depth);
    }
    if (c == '"') {
      auto text = parse_string();
      return text ? std::optional<Value>(Value::string(std::move(*text)))
                  : std::nullopt;
    }
    if (word("true")) {
      return Value::boolean(true);
    }
    if (word("false")) {
      return Value::boolean(false);
    }
    if (word("null")) {
      return Value::null();
    }
    return parse_number();
  }

  std::optional<Value> parse_object(int depth) {
    ++at_;
    Value object = Value::object();
    space();
    if (take('}')) {
      return object;
    }
    for (;;) {
      space();
      if (at_ >= text_.size() || text_[at_] != '"') {
        return std::nullopt;
      }
      auto key = parse_string();
      if (!key) {
        return std::nullopt;
      }
      space();
      if (!take(':')) {
        return std::nullopt;
      }
      space();
      auto value = parse_value(depth + 1);
      if (!value) {
        return std::nullopt;
      }
      object.set(*key, std::move(*value));
      space();
      if (take('}')) {
        return object;
      }
      if (!take(',')) {
        return std::nullopt;
      }
    }
  }

  std::optional<Value> parse_array(int depth) {
    ++at_;
    Value array = Value::array();
    space();
    if (take(']')) {
      return array;
    }
    for (;;) {
      space();
      auto value = parse_value(depth + 1);
      if (!value) {
        return std::nullopt;
      }
      array.items().push_back(std::move(*value));
      space();
      if (take(']')) {
        return array;
      }
      if (!take(',')) {
        return std::nullopt;
      }
    }
  }

  std::optional<std::uint32_t> hex4() {
    if (at_ + 4 > text_.size()) {
      return std::nullopt;
    }
    std::uint32_t value = 0;
    for (int index = 0; index < 4; ++index) {
      const char c = text_[at_++];
      value <<= 4;
      if (c >= '0' && c <= '9') {
        value |= static_cast<std::uint32_t>(c - '0');
      } else if (c >= 'a' && c <= 'f') {
        value |= static_cast<std::uint32_t>(c - 'a' + 10);
      } else if (c >= 'A' && c <= 'F') {
        value |= static_cast<std::uint32_t>(c - 'A' + 10);
      } else {
        return std::nullopt;
      }
    }
    return value;
  }

  std::optional<std::string> parse_string() {
    ++at_;
    std::string out;
    while (at_ < text_.size()) {
      const auto c = static_cast<std::uint8_t>(text_[at_]);
      if (c == '"') {
        ++at_;
        return out;
      }
      if (c < 0x20) {
        return std::nullopt;
      }
      if (c != '\\') {
        out.push_back(static_cast<char>(c));
        ++at_;
        continue;
      }
      ++at_;
      if (at_ >= text_.size()) {
        return std::nullopt;
      }
      const char escape = text_[at_++];
      switch (escape) {
        case '"': out.push_back('"'); break;
        case '\\': out.push_back('\\'); break;
        case '/': out.push_back('/'); break;
        case 'b': out.push_back('\b'); break;
        case 'f': out.push_back('\f'); break;
        case 'n': out.push_back('\n'); break;
        case 'r': out.push_back('\r'); break;
        case 't': out.push_back('\t'); break;
        case 'u': {
          auto unit = hex4();
          if (!unit) {
            return std::nullopt;
          }
          std::uint32_t code = *unit;
          if (code >= 0xD800 && code <= 0xDBFF) {
            // A pair is one code point; a half of one is not text, and is
            // what Node writes as U+FFFD once the string becomes bytes.
            const std::size_t mark = at_;
            if (at_ + 1 < text_.size() && text_[at_] == '\\' &&
                text_[at_ + 1] == 'u') {
              at_ += 2;
              auto low = hex4();
              if (low && *low >= 0xDC00 && *low <= 0xDFFF) {
                code = 0x10000 + ((code - 0xD800) << 10) + (*low - 0xDC00);
              } else {
                at_ = mark;
                code = kReplacement;
              }
            } else {
              code = kReplacement;
            }
          } else if (code >= 0xDC00 && code <= 0xDFFF) {
            code = kReplacement;
          }
          append_utf8(out, code);
          break;
        }
        default:
          return std::nullopt;
      }
    }
    return std::nullopt;
  }

  std::optional<Value> parse_number() {
    const std::size_t start = at_;
    take('-');
    if (take('0')) {
      // A leading zero stands alone.
    } else if (at_ < text_.size() && text_[at_] >= '1' && text_[at_] <= '9') {
      while (at_ < text_.size() && text_[at_] >= '0' && text_[at_] <= '9') {
        ++at_;
      }
    } else {
      return std::nullopt;
    }
    if (take('.')) {
      const std::size_t digits = at_;
      while (at_ < text_.size() && text_[at_] >= '0' && text_[at_] <= '9') {
        ++at_;
      }
      if (at_ == digits) {
        return std::nullopt;
      }
    }
    if (at_ < text_.size() && (text_[at_] == 'e' || text_[at_] == 'E')) {
      ++at_;
      if (!take('+')) {
        take('-');
      }
      const std::size_t digits = at_;
      while (at_ < text_.size() && text_[at_] >= '0' && text_[at_] <= '9') {
        ++at_;
      }
      if (at_ == digits) {
        return std::nullopt;
      }
    }
    double value = 0.0;
    const char* first = text_.data() + start;
    const char* last = text_.data() + at_;
    const auto [end, error] = std::from_chars(first, last, value);
    if (error == std::errc::result_out_of_range) {
      // JavaScript reads past the largest double as Infinity and below the
      // smallest as zero, signed as written: what `strtod` answers too, in
      // the C locale this program never leaves.
      const std::string copy(first, last);
      return Value::number(std::strtod(copy.c_str(), nullptr));
    }
    if (error != std::errc() || end != last) {
      return std::nullopt;
    }
    return Value::number(value);
  }

  std::string_view text_;
  std::size_t at_ = 0;
};

void append_quoted(std::string& out, std::string_view text) {
  static constexpr char kHex[] = "0123456789abcdef";
  out.push_back('"');
  for (const char raw : text) {
    const auto c = static_cast<unsigned char>(raw);
    switch (c) {
      case '"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\b': out += "\\b"; break;
      case '\f': out += "\\f"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default:
        if (c < 0x20) {
          out += "\\u00";
          out.push_back(kHex[c >> 4]);
          out.push_back(kHex[c & 0x0F]);
        } else {
          out.push_back(raw);
        }
    }
  }
  out.push_back('"');
}

void append_value(std::string& out, const Value& value) {
  switch (value.kind()) {
    case Value::Kind::kNull:
      out += "null";
      break;
    case Value::Kind::kBool:
      out += value.as_bool() ? "true" : "false";
      break;
    case Value::Kind::kNumber:
      out += std::isfinite(value.as_number()) ? number_text(value.as_number())
                                              : "null";
      break;
    case Value::Kind::kString:
      append_quoted(out, value.as_string());
      break;
    case Value::Kind::kArray: {
      out.push_back('[');
      bool first = true;
      for (const Value& item : value.items()) {
        if (!first) {
          out.push_back(',');
        }
        first = false;
        append_value(out, item);
      }
      out.push_back(']');
      break;
    }
    case Value::Kind::kObject: {
      out.push_back('{');
      bool first = true;
      for (const auto& [key, member] : value.members()) {
        if (!first) {
          out.push_back(',');
        }
        first = false;
        append_quoted(out, key);
        out.push_back(':');
        append_value(out, member);
      }
      out.push_back('}');
      break;
    }
  }
}

}  // namespace

Value Value::boolean(bool value) {
  Value made;
  made.kind_ = Kind::kBool;
  made.bool_ = value;
  return made;
}

Value Value::number(double value) {
  Value made;
  made.kind_ = Kind::kNumber;
  made.number_ = value;
  return made;
}

Value Value::string(std::string value) {
  Value made;
  made.kind_ = Kind::kString;
  made.string_ = std::move(value);
  return made;
}

Value Value::array(std::vector<Value> items) {
  Value made;
  made.kind_ = Kind::kArray;
  made.items_ = std::move(items);
  return made;
}

Value Value::object(std::vector<Member> members) {
  Value made;
  made.kind_ = Kind::kObject;
  for (auto& [key, value] : members) {
    made.set(key, std::move(value));
  }
  return made;
}

const Value* Value::get(std::string_view key) const {
  if (kind_ != Kind::kObject) {
    return nullptr;
  }
  for (const auto& [name, value] : members_) {
    if (name == key) {
      return &value;
    }
  }
  return nullptr;
}

Value& Value::set(std::string_view key, Value value) {
  for (auto& [name, member] : members_) {
    if (name == key) {
      member = std::move(value);
      return member;
    }
  }
  members_.emplace_back(std::string(key), std::move(value));
  return members_.back().second;
}

void Value::erase(std::string_view key) {
  std::erase_if(members_, [key](const Member& member) {
    return member.first == key;
  });
}

std::optional<Value> parse(std::string_view bytes) {
  const std::string text = well_formed(bytes);
  return Parser(text).document();
}

std::string stringify(const Value& value) {
  std::string out;
  append_value(out, value);
  return out;
}

std::string number_text(double value) {
  if (value == 0.0) {
    return "0";
  }
  if (!std::isfinite(value)) {
    return std::isnan(value) ? "NaN" : (value < 0 ? "-Infinity" : "Infinity");
  }
  // The shortest digits that read back as `value`, and where the point
  // goes, laid out by ECMAScript's Number::toString.
  std::array<char, 64> buffer{};
  const auto [end, error] = std::to_chars(buffer.data(), buffer.data() + buffer.size(),
                                          std::abs(value), std::chars_format::scientific);
  static_cast<void>(error);
  const std::string_view printed(buffer.data(), static_cast<std::size_t>(end - buffer.data()));
  const std::size_t e = printed.find('e');
  std::string digits;
  for (const char c : printed.substr(0, e)) {
    if (c != '.') {
      digits.push_back(c);
    }
  }
  while (digits.size() > 1 && digits.back() == '0') {
    digits.pop_back();
  }
  int exponent = 0;
  std::from_chars(printed.data() + e + 1 + (printed[e + 1] == '+' ? 1 : 0),
                  printed.data() + printed.size(), exponent);
  const int k = static_cast<int>(digits.size());
  const int n = exponent + 1;
  std::string out = value < 0 ? "-" : "";
  if (k <= n && n <= 21) {
    out += digits;
    out.append(static_cast<std::size_t>(n - k), '0');
  } else if (0 < n && n <= 21) {
    out += digits.substr(0, static_cast<std::size_t>(n));
    out.push_back('.');
    out += digits.substr(static_cast<std::size_t>(n));
  } else if (-6 < n && n <= 0) {
    out += "0.";
    out.append(static_cast<std::size_t>(-n), '0');
    out += digits;
  } else {
    out.push_back(digits[0]);
    if (k > 1) {
      out.push_back('.');
      out += digits.substr(1);
    }
    out.push_back('e');
    out.push_back(n - 1 >= 0 ? '+' : '-');
    out += std::to_string(std::abs(n - 1));
  }
  return out;
}

std::string well_formed(std::string_view bytes) {
  std::string out;
  out.reserve(bytes.size());
  std::size_t at = 0;
  while (at < bytes.size()) {
    const std::size_t from = at;
    const std::uint32_t code = next_code(bytes, at);
    if (code == kReplacement) {
      // Ill-formed bytes, or U+FFFD itself: written the same either way.
      append_utf8(out, kReplacement);
    } else {
      out.append(bytes.substr(from, at - from));
    }
  }
  return out;
}

std::size_t utf16_length(std::string_view text) {
  std::size_t units = 0;
  std::size_t at = 0;
  while (at < text.size()) {
    units += next_code(text, at) >= 0x10000 ? 2 : 1;
  }
  return units;
}

std::string trim(std::string_view text) {
  std::size_t at = 0;
  std::size_t first = text.size();
  std::size_t last = 0;
  while (at < text.size()) {
    const std::size_t from = at;
    if (!is_js_space(next_code(text, at))) {
      first = std::min(first, from);
      last = at;
    }
  }
  return first >= last ? std::string() : std::string(text.substr(first, last - first));
}

std::optional<double> integer_at(const Value& record, std::string_view key) {
  const Value* found = record.get(key);
  if (found == nullptr || !found->is_number() || !std::isfinite(found->as_number()) ||
      std::trunc(found->as_number()) != found->as_number()) {
    return std::nullopt;
  }
  return found->as_number();
}

}  // namespace feq::share::json
