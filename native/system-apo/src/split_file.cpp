/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "split_file.h"

#include <charconv>
#include <cmath>
#include <cwctype>

namespace fluideq_engine {

namespace {

/** A file with more lines than this is not one the app wrote. */
constexpr int kMaxLines = 64;

bool is_hex(char c) noexcept {
  return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') ||
         (c >= 'A' && c <= 'F');
}

/** `{8-4-4-4-12}`, nothing more and nothing less. */
bool is_guid(std::string_view word) noexcept {
  if (word.size() != 38 || word.front() != '{' || word.back() != '}') {
    return false;
  }
  for (size_t at = 1; at < 37; ++at) {
    const bool dash = at == 9 || at == 14 || at == 19 || at == 24;
    if (dash ? word[at] != '-' : !is_hex(word[at])) {
      return false;
    }
  }
  return true;
}

/** Hex digits and braces only, so a byte-for-byte widening is the id. */
bool same_id(std::string_view word, const std::wstring& endpoint) noexcept {
  if (word.size() != endpoint.size()) {
    return false;
  }
  for (size_t at = 0; at < word.size(); ++at) {
    if (std::towlower(static_cast<wchar_t>(word[at])) !=
        std::towlower(endpoint[at])) {
      return false;
    }
  }
  return true;
}

std::string_view next_word(std::string_view& line) noexcept {
  const size_t start = line.find_first_not_of(" \t");
  if (start == std::string_view::npos) {
    line = {};
    return {};
  }
  line.remove_prefix(start);
  const size_t stop = line.find_first_of(" \t");
  const std::string_view word = line.substr(0, stop);
  line.remove_prefix(stop == std::string_view::npos ? line.size() : stop);
  return word;
}

}  // namespace

SplitRole split_role_of(std::string_view text, const std::wstring& endpoint) {
  SplitRole role;
  if (endpoint.empty()) {
    return role;
  }
  int lines = 0;
  std::wstring root;
  while (!text.empty() && lines < kMaxLines) {
    const size_t stop = text.find('\n');
    std::string_view line = text.substr(0, stop);
    text.remove_prefix(stop == std::string_view::npos ? text.size() : stop + 1);
    if (!line.empty() && line.back() == '\r') {
      line.remove_suffix(1);
    }
    lines += 1;
    if (line.substr(0, 7) == "# main ") {
      line.remove_prefix(7);
      const auto main = next_word(line);
      if (is_guid(main) && next_word(line).empty() &&
          (root.empty() || same_id(main, root))) {
        root.assign(main.begin(), main.end());
        role.primary = same_id(main, endpoint);
      }
      continue;
    }
    if (line.empty() || line.front() == '#') {
      continue;
    }
    const std::string_view from = next_word(line);
    const std::string_view to = next_word(line);
    const std::string_view level = next_word(line);
    float volume = 0.0f;
    const auto parsed =
        std::from_chars(level.data(), level.data() + level.size(), volume);
    if (!is_guid(from) || !is_guid(to) || !next_word(line).empty() ||
        parsed.ec != std::errc() ||
        parsed.ptr != level.data() + level.size() || !std::isfinite(volume) ||
        volume < 0.0f || volume > 1.0f) {
      continue;
    }
    std::wstring from_id(from.begin(), from.end());
    if (same_id(to, from_id)) {
      continue;
    }
    // Only one source is permitted. A conflicting line cannot make main a
    // receiver, or chain one secondary through another secondary.
    if (root.empty()) {
      root = from_id;
    } else if (!same_id(from, root)) {
      continue;
    }
    if (same_id(from, endpoint)) {
      role.source = true;
      role.primary = true;
    }
    if (!role.target() && same_id(to, endpoint)) {
      role.from = std::move(from_id);
      role.volume = volume;
    }
  }
  return role;
}

}  // namespace fluideq_engine
