/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "programme.h"

#include <charconv>
#include <cmath>

#include "config_internal.h"

namespace fluideq_engine {

namespace {

std::string_view trimmed(std::string_view text) {
  const size_t first = text.find_first_not_of(" \t\r");
  if (first == std::string_view::npos) {
    return {};
  }
  const size_t last = text.find_last_not_of(" \t\r");
  return text.substr(first, last - first + 1);
}

/** A measured value inside what music can measure, or `fallback`. */
double measured(std::string_view token, double low, double high, double fallback) {
  double value = 0;
  if (!detail::parse_double(token, value) || !std::isfinite(value) ||
      value < low || value > high) {
    return fallback;
  }
  return value;
}

}  // namespace

Programme parse_programme(std::string_view text) {
  Programme programme;
  bool named = false;
  double level = -120;
  double peak = -120;
  size_t pos = 0;
  while (pos < text.size()) {
    const size_t newline = text.find('\n', pos);
    const size_t end = newline == std::string_view::npos ? text.size() : newline;
    const std::string_view line = trimmed(text.substr(pos, end - pos));
    pos = end + 1;
    const size_t equals = line.find('=');
    if (line.empty() || line.front() == '#' || equals == std::string_view::npos) {
      continue;
    }
    const std::string_view key = trimmed(line.substr(0, equals));
    const std::string_view value = trimmed(line.substr(equals + 1));
    if (key == "song") {
      uint64_t id = 0;
      const auto parsed = std::from_chars(value.data(), value.data() + value.size(), id, 16);
      named = value.size() == 16 && parsed.ec == std::errc() &&
              parsed.ptr == value.data() + value.size() && id != 0;
      if (named) {
        programme.song_id = id;
      }
    } else if (key == "level") {
      level = measured(value, -70, 0, -120);
    } else if (key == "peak") {
      peak = measured(value, -70, 12, -120);
    }
  }
  if (!named) {
    return Programme{};
  }
  programme.level_lufs = level;
  // A peak without a level is half a measurement; the level decides alone.
  programme.peak_db = level > -100 ? peak : -120;
  return programme;
}

}  // namespace fluideq_engine
