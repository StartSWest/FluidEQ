/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The lexer and the two band grammars: `tokenize`, `parse_filter`,
 * `parse_graphic`. Split out of config.cpp so that file stays under the
 * project's 500-line limit; `resolve_chain` and `device_matches` are the
 * other half, in config.cpp.
 */

#include "fluideq_engine/config.h"

#include <charconv>
#include <cmath>

#include "config_internal.h"

namespace fluideq_engine {

namespace detail {

char ascii_lower(char c) {
  return (c >= 'A' && c <= 'Z') ? static_cast<char>(c - 'A' + 'a') : c;
}

bool iequals(std::string_view a, std::string_view b) {
  if (a.size() != b.size()) {
    return false;
  }
  for (size_t i = 0; i < a.size(); ++i) {
    if (ascii_lower(a[i]) != ascii_lower(b[i])) {
      return false;
    }
  }
  return true;
}

std::vector<std::string_view> split_ws(std::string_view s) {
  std::vector<std::string_view> tokens;
  size_t i = 0;
  while (i < s.size()) {
    while (i < s.size() && (s[i] == ' ' || s[i] == '\t')) {
      ++i;
    }
    const size_t start = i;
    while (i < s.size() && s[i] != ' ' && s[i] != '\t') {
      ++i;
    }
    if (i > start) {
      tokens.push_back(s.substr(start, i - start));
    }
  }
  return tokens;
}

bool parse_double(std::string_view token, double& out) {
  const auto result =
      std::from_chars(token.data(), token.data() + token.size(), out);
  return result.ec == std::errc() && result.ptr == token.data() + token.size();
}

}  // namespace detail

namespace {

// A byte-order mark's UTF-16LE code unit, re-encoded as UTF-8 so `tokenize`
// only ever reasons about one encoding.
void append_utf8(std::string& out, char32_t code_point) {
  if (code_point <= 0x7F) {
    out.push_back(static_cast<char>(code_point));
  } else if (code_point <= 0x7FF) {
    out.push_back(static_cast<char>(0xC0 | (code_point >> 6)));
    out.push_back(static_cast<char>(0x80 | (code_point & 0x3F)));
  } else if (code_point <= 0xFFFF) {
    out.push_back(static_cast<char>(0xE0 | (code_point >> 12)));
    out.push_back(static_cast<char>(0x80 | ((code_point >> 6) & 0x3F)));
    out.push_back(static_cast<char>(0x80 | (code_point & 0x3F)));
  } else {
    out.push_back(static_cast<char>(0xF0 | (code_point >> 18)));
    out.push_back(static_cast<char>(0x80 | ((code_point >> 12) & 0x3F)));
    out.push_back(static_cast<char>(0x80 | ((code_point >> 6) & 0x3F)));
    out.push_back(static_cast<char>(0x80 | (code_point & 0x3F)));
  }
}

// Strips a UTF-16LE or UTF-8 byte-order mark, transcoding UTF-16LE content to
// UTF-8 so every line below deals with one encoding regardless of which
// editor or exporter wrote the file. No Windows headers means no
// `MultiByteToWideChar`; this is Windows-only code so `wchar_t` being a
// 16-bit UTF-16 unit is assumed rather than tested for.
std::string strip_bom_and_decode(std::string_view text) {
  if (text.size() >= 2 && static_cast<unsigned char>(text[0]) == 0xFF &&
      static_cast<unsigned char>(text[1]) == 0xFE) {
    std::string out;
    size_t i = 2;
    while (i + 1 < text.size()) {
      const auto lo = static_cast<unsigned char>(text[i]);
      const auto hi = static_cast<unsigned char>(text[i + 1]);
      char32_t unit =
          static_cast<char32_t>(lo) | (static_cast<char32_t>(hi) << 8);
      i += 2;
      if (unit >= 0xD800 && unit <= 0xDBFF && i + 1 < text.size()) {
        const auto lo2 = static_cast<unsigned char>(text[i]);
        const auto hi2 = static_cast<unsigned char>(text[i + 1]);
        const char32_t unit2 =
            static_cast<char32_t>(lo2) | (static_cast<char32_t>(hi2) << 8);
        if (unit2 >= 0xDC00 && unit2 <= 0xDFFF) {
          unit = 0x10000 + ((unit - 0xD800) << 10) + (unit2 - 0xDC00);
          i += 2;
        }
      }
      append_utf8(out, unit);
    }
    return out;
  }
  if (text.size() >= 3 && static_cast<unsigned char>(text[0]) == 0xEF &&
      static_cast<unsigned char>(text[1]) == 0xBB &&
      static_cast<unsigned char>(text[2]) == 0xBF) {
    return std::string(text.substr(3));
  }
  return std::string(text);
}

bool is_line_whitespace(char c) {
  // '\r' is whitespace everywhere, never a line boundary of its own: it
  // trims away regardless of which side of the '\n' a generator put it on,
  // which is what makes both "\r\n" and the legacy "\n\r" ordering tokenize
  // identically.
  return c == ' ' || c == '\t' || c == '\r';
}

std::string_view trim(std::string_view s) {
  size_t start = 0;
  while (start < s.size() && is_line_whitespace(s[start])) {
    ++start;
  }
  size_t end = s.size();
  while (end > start && is_line_whitespace(s[end - 1])) {
    --end;
  }
  return s.substr(start, end - start);
}

std::optional<FilterType> alias_to_type(std::string_view token) {
  static constexpr struct {
    const char* name;
    FilterType type;
  } kAliases[] = {
      {"PK", FilterType::PK},     {"PEQ", FilterType::PK},
      {"MODAL", FilterType::PK},  {"NO", FilterType::NO},
      {"NOTCH", FilterType::NO},  {"LS", FilterType::LSC},
      {"LSC", FilterType::LSC},   {"LSQ", FilterType::LSC},
      {"HS", FilterType::HSC},    {"HSC", FilterType::HSC},
      {"HSQ", FilterType::HSC},   {"LP", FilterType::LPQ},
      {"LPQ", FilterType::LPQ},   {"HP", FilterType::HPQ},
      {"HPQ", FilterType::HPQ},   {"BP", FilterType::BP},
  };
  for (const auto& alias : kAliases) {
    if (detail::iequals(token, alias.name)) {
      return alias.type;
    }
  }
  return std::nullopt;
}

}  // namespace

std::vector<Line> tokenize(std::string_view text) {
  const std::string decoded = strip_bom_and_decode(text);
  std::vector<Line> lines;
  size_t pos = 0;
  while (pos <= decoded.size()) {
    const size_t newline = decoded.find('\n', pos);
    const bool last = newline == std::string::npos;
    const size_t line_end = last ? decoded.size() : newline;
    std::string_view raw(decoded.data() + pos, line_end - pos);
    pos = last ? decoded.size() + 1 : newline + 1;

    const size_t hash = raw.find('#');
    if (hash != std::string_view::npos) {
      raw = raw.substr(0, hash);
    }
    raw = trim(raw);
    const size_t colon = raw.find(':');
    if (!raw.empty() && colon != std::string_view::npos) {
      std::string_view command = trim(raw.substr(0, colon));
      const std::string_view body = trim(raw.substr(colon + 1));

      // A trailing " <digits>" label is APO's line number, not part of the
      // command: "Filter 3" and "Filter" address the same grammar.
      size_t digit_start = command.size();
      while (digit_start > 0 && command[digit_start - 1] >= '0' &&
             command[digit_start - 1] <= '9') {
        --digit_start;
      }
      if (digit_start > 0 && digit_start < command.size() &&
          command[digit_start - 1] == ' ') {
        command = command.substr(0, digit_start - 1);
      }

      lines.push_back(Line{std::string(command), std::string(body)});
    }
    if (last) {
      break;
    }
  }
  return lines;
}

std::optional<Band> parse_filter(std::string_view body) {
  const std::vector<std::string_view> tokens = detail::split_ws(body);
  size_t i = 0;

  if (i >= tokens.size() || !detail::iequals(tokens[i], "ON")) {
    return std::nullopt;
  }
  ++i;

  if (i >= tokens.size()) {
    return std::nullopt;
  }
  const std::optional<FilterType> type = alias_to_type(tokens[i]);
  if (!type) {
    return std::nullopt;
  }
  ++i;

  if (i + 1 >= tokens.size() || !detail::iequals(tokens[i], "Fc")) {
    return std::nullopt;
  }
  ++i;
  double frequency = 0.0;
  if (!detail::parse_double(tokens[i], frequency) || frequency <= 0.0) {
    return std::nullopt;
  }
  ++i;
  if (i >= tokens.size() || !detail::iequals(tokens[i], "Hz")) {
    return std::nullopt;
  }
  ++i;

  double gain_db = 0.0;
  if (i + 2 < tokens.size() && detail::iequals(tokens[i], "Gain")) {
    if (!detail::parse_double(tokens[i + 1], gain_db) ||
        !detail::iequals(tokens[i + 2], "dB")) {
      return std::nullopt;
    }
    i += 3;
  }

  double quality;
  if (i + 1 < tokens.size() && detail::iequals(tokens[i], "Q")) {
    if (!detail::parse_double(tokens[i + 1], quality)) {
      return std::nullopt;
    }
    i += 2;
  } else if (i + 2 < tokens.size() && detail::iequals(tokens[i], "BW") &&
             detail::iequals(tokens[i + 1], "Oct")) {
    double octaves = 0.0;
    if (!detail::parse_double(tokens[i + 2], octaves)) {
      return std::nullopt;
    }
    // RBJ cookbook bandwidth-to-Q, the same formula `bandwidthToQ` in
    // apoText.ts uses.
    const double factor = std::pow(2.0, octaves);
    quality = std::sqrt(factor) / (factor - 1.0);
    i += 3;
  } else {
    return std::nullopt;  // Neither Q nor BW Oct: the grammar requires one.
  }

  if (quality <= 0.0 || i != tokens.size()) {
    return std::nullopt;  // Non-positive Q, or trailing tokens the grammar
                          // has no place for.
  }

  return Band{*type, frequency, gain_db, quality};
}

std::vector<GraphicPoint> parse_graphic(std::string_view body) {
  std::vector<GraphicPoint> points;
  size_t pos = 0;
  while (pos <= body.size()) {
    const size_t semi = body.find(';', pos);
    const bool last = semi == std::string_view::npos;
    const size_t end = last ? body.size() : semi;
    const std::string_view piece = trim(body.substr(pos, end - pos));
    pos = last ? body.size() + 1 : semi + 1;

    const std::vector<std::string_view> tokens = detail::split_ws(piece);
    if (tokens.size() != 2) {
      return {};  // All-or-nothing: one bad point invalidates the whole curve.
    }
    double frequency = 0.0;
    double gain = 0.0;
    if (!detail::parse_double(tokens[0], frequency) ||
        !detail::parse_double(tokens[1], gain) || frequency < 0.0) {
      return {};
    }
    points.push_back(GraphicPoint{frequency, gain});
    if (last) {
      break;
    }
  }
  return points;
}

}  // namespace fluideq_engine
