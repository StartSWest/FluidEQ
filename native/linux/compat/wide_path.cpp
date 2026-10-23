/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "wide_path.h"

#include <cstdint>

namespace fluideq_linux {

namespace {

constexpr char32_t kReplacement = 0xFFFD;

void append_utf8(std::string& out, char32_t code) {
  if (code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF)) {
    code = kReplacement;
  }
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

}  // namespace

std::string narrow(std::wstring_view text) {
  std::string out;
  out.reserve(text.size());
  for (size_t at = 0; at < text.size(); ++at) {
    const auto unit = static_cast<char32_t>(text[at]);
    if (unit >= 0xD800 && unit <= 0xDBFF && at + 1 < text.size()) {
      const auto low = static_cast<char32_t>(text[at + 1]);
      if (low >= 0xDC00 && low <= 0xDFFF) {
        append_utf8(out, 0x10000 + ((unit - 0xD800) << 10) + (low - 0xDC00));
        ++at;
        continue;
      }
    }
    append_utf8(out, unit);
  }
  return out;
}

std::string narrow_path(std::wstring_view path) {
  std::string out = narrow(path);
  for (char& c : out) {
    if (c == '\\') c = '/';
  }
  return out;
}

std::wstring widen(std::string_view utf8) {
  std::wstring out;
  out.reserve(utf8.size());
  size_t at = 0;
  while (at < utf8.size()) {
    const auto lead = static_cast<uint8_t>(utf8[at]);
    size_t length = 0;
    char32_t code = 0;
    if (lead < 0x80) {
      length = 1;
      code = lead;
    } else if ((lead & 0xE0) == 0xC0) {
      length = 2;
      code = lead & 0x1F;
    } else if ((lead & 0xF0) == 0xE0) {
      length = 3;
      code = lead & 0x0F;
    } else if ((lead & 0xF8) == 0xF0) {
      length = 4;
      code = lead & 0x07;
    }
    bool valid = length > 0 && at + length <= utf8.size();
    for (size_t k = 1; valid && k < length; ++k) {
      const auto next = static_cast<uint8_t>(utf8[at + k]);
      valid = (next & 0xC0) == 0x80;
      code = (code << 6) | (next & 0x3F);
    }
    if (!valid) {
      out.push_back(static_cast<wchar_t>(kReplacement));
      ++at;
      continue;
    }
    // Above the BMP as a surrogate pair, exactly as the shared resolver's
    // `utf8_to_wide` writes it: a device name widened here is compared with
    // a `Device:` pattern widened there, and one code point spelled two
    // ways would never match.
    if (code >= 0x10000 && code <= 0x10FFFF) {
      out.push_back(static_cast<wchar_t>(0xD800 + ((code - 0x10000) >> 10)));
      out.push_back(static_cast<wchar_t>(0xDC00 + ((code - 0x10000) & 0x3FF)));
    } else {
      out.push_back(static_cast<wchar_t>(code));
    }
    at += length;
  }
  return out;
}

}  // namespace fluideq_linux
