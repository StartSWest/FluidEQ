/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "multi_sz.h"

#include <algorithm>
#include <cstring>
#include <string>
#include <vector>

namespace fluideq_engine::setup {

namespace {

/**
 * The data as characters, copied rather than pointed at.
 *
 * `RegQueryValueExW` fills a byte buffer, and a `wchar_t*` aimed straight at
 * it is both an aliasing violation and an alignment assumption about an
 * allocation this file never made. Copying costs a value's worth of bytes,
 * once per read, and removes both.
 */
std::vector<wchar_t> characters_of(const unsigned char* bytes,
                                   std::size_t size) {
  // An odd byte count cannot be a whole number of UTF-16 code units. The last
  // byte is dropped: half a character is not one, and refusing the value
  // outright would throw away the entries that did arrive intact.
  const std::size_t count = size / sizeof(wchar_t);
  std::vector<wchar_t> text(count, L'\0');
  if (count != 0 && bytes != nullptr) {
    std::memcpy(text.data(), bytes, count * sizeof(wchar_t));
  }
  return text;
}

}  // namespace

std::vector<std::wstring> decode_multi_sz(const unsigned char* bytes,
                                          std::size_t size) {
  const std::vector<wchar_t> text = characters_of(bytes, size);
  std::vector<std::wstring> entries;
  auto at = text.begin();
  while (at != text.end()) {
    // Bounded by the end of the buffer, never by a terminator that may not be
    // there. This is the whole point of the file.
    const auto stop = std::find(at, text.end(), L'\0');
    if (stop == at) {
      // The empty entry that ends the list.
      break;
    }
    entries.emplace_back(at, stop);
    if (stop == text.end()) {
      // A last entry with no terminator after it. The value is malformed and
      // the entry is still the vendor's, so it is kept and the scan stops.
      break;
    }
    at = stop + 1;
  }
  return entries;
}

std::wstring decode_sz(const unsigned char* bytes, std::size_t size) {
  const std::vector<wchar_t> text = characters_of(bytes, size);
  const auto stop = std::find(text.begin(), text.end(), L'\0');
  return std::wstring(text.begin(), stop);
}

std::vector<wchar_t> encode_multi_sz(
    const std::vector<std::wstring>& entries) {
  std::vector<wchar_t> block;
  for (const std::wstring& entry : entries) {
    block.insert(block.end(), entry.begin(), entry.end());
    block.push_back(L'\0');
  }
  block.push_back(L'\0');
  return block;
}

}  // namespace fluideq_engine::setup
