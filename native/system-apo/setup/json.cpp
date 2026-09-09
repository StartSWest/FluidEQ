/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "json.h"

#include <string>
#include <string_view>

namespace fluideq_engine::setup {

namespace {

const wchar_t kHexDigits[] = L"0123456789abcdef";

/** The value of one hexadecimal digit, or -1. */
int hex_value(wchar_t symbol) {
  if (symbol >= L'0' && symbol <= L'9') {
    return symbol - L'0';
  }
  if (symbol >= L'a' && symbol <= L'f') {
    return symbol - L'a' + 10;
  }
  if (symbol >= L'A' && symbol <= L'F') {
    return symbol - L'A' + 10;
  }
  return -1;
}

}  // namespace

std::wstring json_escape(std::wstring_view text) {
  std::wstring out;
  out.reserve(text.size() + 8);
  for (const wchar_t symbol : text) {
    switch (symbol) {
      case L'"':
        out += L"\\\"";
        break;
      case L'\\':
        out += L"\\\\";
        break;
      case L'\b':
        out += L"\\b";
        break;
      case L'\f':
        out += L"\\f";
        break;
      case L'\n':
        out += L"\\n";
        break;
      case L'\r':
        out += L"\\r";
        break;
      case L'\t':
        out += L"\\t";
        break;
      default:
        if (symbol < 0x20) {
          out += L"\\u00";
          out += kHexDigits[(symbol >> 4) & 0xF];
          out += kHexDigits[symbol & 0xF];
        } else {
          out += symbol;
        }
        break;
    }
  }
  return out;
}

void JsonScanner::skip_space() {
  while (at_ < text_.size() &&
         (text_[at_] == L' ' || text_[at_] == L'\t' || text_[at_] == L'\r' ||
          text_[at_] == L'\n')) {
    ++at_;
  }
}

bool JsonScanner::consume(wchar_t symbol) {
  skip_space();
  if (at_ >= text_.size() || text_[at_] != symbol) {
    return false;
  }
  ++at_;
  return true;
}

bool JsonScanner::at_end() {
  skip_space();
  return at_ >= text_.size();
}

bool JsonScanner::read_null() {
  skip_space();
  const std::wstring_view literal = L"null";
  if (text_.size() - at_ < literal.size() ||
      text_.compare(at_, literal.size(), literal) != 0) {
    return false;
  }
  at_ += literal.size();
  return true;
}

bool JsonScanner::read_string(std::wstring& out) {
  skip_space();
  if (at_ >= text_.size() || text_[at_] != L'"') {
    return false;
  }
  ++at_;
  std::wstring value;
  while (at_ < text_.size()) {
    const wchar_t symbol = text_[at_++];
    if (symbol == L'"') {
      out = std::move(value);
      return true;
    }
    if (symbol != L'\\') {
      // A raw control character inside a string is illegal JSON. Accepting it
      // would mean this reader takes documents its own writer cannot produce.
      if (symbol < 0x20) {
        return false;
      }
      value += symbol;
      continue;
    }
    if (at_ >= text_.size()) {
      return false;
    }
    const wchar_t escaped = text_[at_++];
    switch (escaped) {
      case L'"':
      case L'\\':
      case L'/':
        value += escaped;
        break;
      case L'b':
        value += L'\b';
        break;
      case L'f':
        value += L'\f';
        break;
      case L'n':
        value += L'\n';
        break;
      case L'r':
        value += L'\r';
        break;
      case L't':
        value += L'\t';
        break;
      case L'u': {
        if (text_.size() - at_ < 4) {
          return false;
        }
        int code = 0;
        for (int digit = 0; digit < 4; ++digit) {
          const int nibble = hex_value(text_[at_ + static_cast<size_t>(digit)]);
          if (nibble < 0) {
            return false;
          }
          code = (code << 4) | nibble;
        }
        at_ += 4;
        // No surrogate pairing: `wchar_t` on Windows IS a UTF-16 code unit, so
        // a pair arrives as the two units the document spelled out and is
        // already correct once both are appended.
        value += static_cast<wchar_t>(code);
        break;
      }
      default:
        return false;
    }
  }
  return false;
}

}  // namespace fluideq_engine::setup
