/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// `status_json` on its own, with no Windows header anywhere near it, so the
// test that pins its shape links nothing but this.

#include <cstdio>
#include <string>

#include "status_file.h"

namespace fluideq_engine {

namespace {

/** A JSON string literal, quotes included. */
std::string quoted(const std::string& text) {
  std::string out = "\"";
  for (const char character : text) {
    const auto byte = static_cast<unsigned char>(character);
    if (character == '"' || character == '\\') {
      out += '\\';
      out += character;
    } else if (byte < 0x20) {
      char escaped[8] = {};
      std::snprintf(escaped, sizeof(escaped), "\\u%04x", byte);
      out += escaped;
    } else {
      out += character;
    }
  }
  out += '"';
  return out;
}

/**
 * The endpoint id narrowed to ASCII. It is a GUID in braces, which is ASCII
 * by construction; anything else is replaced rather than guessed at.
 */
std::string narrow_id(const std::wstring& id) {
  std::string out;
  out.reserve(id.size());
  for (const wchar_t character : id) {
    const bool plain = character >= 0x20 && character < 0x7f;
    out.push_back(plain ? static_cast<char>(character) : '?');
  }
  return out;
}

}  // namespace

std::string status_json(const EngineStatus& status, unsigned long pid,
                        const std::string& at) {
  std::string problems = "[";
  for (size_t index = 0; index < status.problems.size(); ++index) {
    if (index > 0) {
      problems += ',';
    }
    problems += quoted(status.problems[index]);
  }
  problems += ']';
  return std::string("{\"version\":1,\"endpoint\":") +
         quoted(narrow_id(status.endpoint)) +
         ",\"pid\":" + std::to_string(pid) +
         ",\"locked\":" + (status.locked ? "true" : "false") +
         ",\"processing\":" + (status.processing ? "true" : "false") +
         ",\"owner\":" + (status.owner ? "true" : "false") +
         ",\"reason\":" + quoted(status.reason) +
         ",\"problems\":" + problems + ",\"at\":" + quoted(at) + "}\r\n";
}

}  // namespace fluideq_engine
