/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "song_programme.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <Windows.h>
#include <bcrypt.h>
#include <icu.h>

#include <array>
#include <charconv>
#include <cmath>
#include <vector>

namespace feq::tray {
namespace {

constexpr std::string_view kHeader = "# FluidEQ Engine programme v1";
constexpr std::string_view kCrlf = "\r\n";

/** What `String.prototype.trim` takes off: WhiteSpace and LineTerminator. */
bool is_js_space(char16_t unit) {
  switch (unit) {
    case 0x0009: case 0x000A: case 0x000B: case 0x000C: case 0x000D:
    case 0x0020: case 0x00A0: case 0x1680: case 0x2028: case 0x2029:
    case 0x202F: case 0x205F: case 0x3000: case 0xFEFF:
      return true;
    default:
      return unit >= 0x2000 && unit <= 0x200A;
  }
}

std::optional<std::u16string> utf16_of(std::string_view utf8) {
  if (utf8.empty()) {
    return std::u16string();
  }
  const int size = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS,
                                       utf8.data(), static_cast<int>(utf8.size()),
                                       nullptr, 0);
  if (size <= 0) {
    return std::nullopt;
  }
  std::u16string out(static_cast<std::size_t>(size), u'\0');
  MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, utf8.data(),
                      static_cast<int>(utf8.size()),
                      reinterpret_cast<wchar_t*>(out.data()), size);
  return out;
}

std::optional<std::string> utf8_of(std::u16string_view utf16) {
  if (utf16.empty()) {
    return std::string();
  }
  const auto* wide = reinterpret_cast<const wchar_t*>(utf16.data());
  const int size = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, wide,
                                       static_cast<int>(utf16.size()), nullptr,
                                       0, nullptr, nullptr);
  if (size <= 0) {
    return std::nullopt;
  }
  std::string out(static_cast<std::size_t>(size), '\0');
  WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, wide,
                      static_cast<int>(utf16.size()), out.data(), size, nullptr,
                      nullptr);
  return out;
}

std::u16string_view js_trim(std::u16string_view text) {
  std::size_t first = 0;
  std::size_t last = text.size();
  while (first < last && is_js_space(text[first])) {
    ++first;
  }
  while (last > first && is_js_space(text[last - 1])) {
    --last;
  }
  return text.substr(first, last - first);
}

/** Lowered by ICU's root locale, as V8's `toLowerCase` lowers: in context. */
std::optional<std::u16string> icu_lower(std::u16string_view text) {
  if (text.empty()) {
    return std::u16string();
  }
  // Lowering can lengthen a string (a dotted capital I becomes two units).
  std::u16string out(text.size() * 3 + 1, u'\0');
  UErrorCode status = U_ZERO_ERROR;
  const int32_t length = u_strToLower(
      reinterpret_cast<UChar*>(out.data()), static_cast<int32_t>(out.size()),
      reinterpret_cast<const UChar*>(text.data()),
      static_cast<int32_t>(text.size()), "", &status);
  if (U_FAILURE(status) || length < 0) {
    return std::nullopt;
  }
  out.resize(static_cast<std::size_t>(length));
  return out;
}

std::optional<std::array<std::uint8_t, 20>> sha1(std::string_view bytes) {
  std::array<std::uint8_t, 20> digest{};
  const NTSTATUS status = BCryptHash(
      BCRYPT_SHA1_ALG_HANDLE, nullptr, 0,
      reinterpret_cast<PUCHAR>(const_cast<char*>(bytes.data())),
      static_cast<ULONG>(bytes.size()), digest.data(),
      static_cast<ULONG>(digest.size()));
  if (status < 0) {
    return std::nullopt;
  }
  return digest;
}

}  // namespace

std::optional<std::string> song_identity(std::string_view app,
                                         std::string_view title,
                                         std::string_view artist) {
  std::string joined;
  bool first = true;
  for (const std::string_view part : {app, title, artist}) {
    const auto wide = utf16_of(part);
    if (!wide) {
      return std::nullopt;
    }
    const auto lowered = icu_lower(js_trim(*wide));
    const auto narrow = lowered ? utf8_of(*lowered) : std::nullopt;
    if (!narrow) {
      return std::nullopt;
    }
    if (!first) {
      // Joined on a character no player puts in a title or an artist.
      joined.push_back('\0');
    }
    first = false;
    joined += *narrow;
  }
  const auto digest = sha1(joined);
  if (!digest) {
    return std::nullopt;
  }
  constexpr std::string_view kHex = "0123456789abcdef";
  std::string hex;
  for (std::size_t at = 0; at < 8; ++at) {
    hex.push_back(kHex[(*digest)[at] >> 4U]);
    hex.push_back(kHex[(*digest)[at] & 0x0FU]);
  }
  return hex;
}

std::string js_to_fixed2(double value) {
  if (!std::isfinite(value)) {
    return "NaN";
  }
  // `x < 0`: negative zero is not, and is written without a sign.
  const bool negative = value < 0.0;
  const double magnitude = std::fabs(value);
  // The exact decimal value: any double the file holds has well under a
  // thousand digits after its point, and to_chars writes them all exactly.
  std::vector<char> exact(1200);
  const auto written = std::to_chars(exact.data(), exact.data() + exact.size(),
                                     magnitude, std::chars_format::fixed, 1100);
  std::string digits(exact.data(), written.ptr);
  const std::size_t point = digits.find('.');
  std::string whole = digits.substr(0, point);
  std::string cents = digits.substr(point + 1, 2);
  // The spec's n nearest x * 100, the larger of two: the third decimal
  // decides alone, five or more going up.
  if (digits[point + 3] >= '5') {
    std::string all = whole + cents;
    int at = static_cast<int>(all.size()) - 1;
    while (at >= 0 && all[static_cast<std::size_t>(at)] == '9') {
      all[static_cast<std::size_t>(at)] = '0';
      --at;
    }
    if (at < 0) {
      all.insert(all.begin(), '1');
    } else {
      all[static_cast<std::size_t>(at)] += 1;
    }
    whole = all.substr(0, all.size() - 2);
    cents = all.substr(all.size() - 2);
  }
  return (negative ? "-" : "") + whole + "." + cents;
}

std::string song_programme_text(const std::optional<std::string>& id,
                                const std::optional<SongLevel>& known) {
  std::string text(kHeader);
  text += kCrlf;
  if (id) {
    text += "song=" + *id;
    text += kCrlf;
    if (known) {
      text += "level=" + js_to_fixed2(known->level_lufs);
      text += kCrlf;
      text += "peak=" + js_to_fixed2(known->peak_db);
      text += kCrlf;
    }
  }
  return text;
}

}  // namespace feq::tray
