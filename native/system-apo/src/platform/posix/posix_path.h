/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An engine path, as a POSIX file system wants it.
 *
 * The engine's paths are wide strings and joined with `\`, because the engine
 * was written inside Windows' audio service: `config.cpp` builds
 * `<config dir>\config.txt` and `<config dir>\<include>`. On macOS `wchar_t`
 * is one UTF-32 code point and the file system takes UTF-8 bytes separated by
 * `/`, so a joined path used as-is names a file called `dir\config.txt` that
 * does not exist — and the engine reads nothing and plays the sound flat.
 *
 * Every `\` becomes `/`. The resolver refuses rooted, drive and `..` bodies
 * before it joins anything, so a backslash reaching here is always a
 * separator it put there, never part of a name FluidEQ wrote.
 */
#ifndef FLUIDEQ_ENGINE_POSIX_PATH_H
#define FLUIDEQ_ENGINE_POSIX_PATH_H

#include <cstdint>
#include <string>

namespace fluideq_engine {

inline std::string posix_path(const std::wstring& path) {
  std::string out;
  out.reserve(path.size());
  for (const wchar_t wide : path) {
    uint32_t code = static_cast<uint32_t>(wide);
    if (code == static_cast<uint32_t>(L'\\')) {
      code = static_cast<uint32_t>('/');
    }
    if (code < 0x80u) {
      out.push_back(static_cast<char>(code));
    } else if (code < 0x800u) {
      out.push_back(static_cast<char>(0xC0u | (code >> 6)));
      out.push_back(static_cast<char>(0x80u | (code & 0x3Fu)));
    } else if (code < 0x10000u) {
      out.push_back(static_cast<char>(0xE0u | (code >> 12)));
      out.push_back(static_cast<char>(0x80u | ((code >> 6) & 0x3Fu)));
      out.push_back(static_cast<char>(0x80u | (code & 0x3Fu)));
    } else if (code <= 0x10FFFFu) {
      out.push_back(static_cast<char>(0xF0u | (code >> 18)));
      out.push_back(static_cast<char>(0x80u | ((code >> 12) & 0x3Fu)));
      out.push_back(static_cast<char>(0x80u | ((code >> 6) & 0x3Fu)));
      out.push_back(static_cast<char>(0x80u | (code & 0x3Fu)));
    }
    // Anything past U+10FFFF is not a character; it is dropped rather than
    // encoded as bytes no file system would accept.
  }
  return out;
}

/** The other way, for a path macOS handed us: UTF-8 bytes to wide. */
inline std::wstring wide_path(const std::string& path) {
  std::wstring out;
  out.reserve(path.size());
  size_t at = 0;
  while (at < path.size()) {
    const auto lead = static_cast<unsigned char>(path[at]);
    uint32_t code = 0;
    size_t extra = 0;
    if (lead < 0x80u) {
      code = lead;
    } else if ((lead & 0xE0u) == 0xC0u) {
      code = lead & 0x1Fu;
      extra = 1;
    } else if ((lead & 0xF0u) == 0xE0u) {
      code = lead & 0x0Fu;
      extra = 2;
    } else if ((lead & 0xF8u) == 0xF0u) {
      code = lead & 0x07u;
      extra = 3;
    } else {
      // Not a lead byte: skipped, so one bad byte cannot swallow the rest.
      at += 1;
      continue;
    }
    if (at + extra >= path.size()) {
      // A sequence cut off by the end of the string: nothing after it to read.
      break;
    }
    for (size_t follow = 1; follow <= extra; follow += 1) {
      code = (code << 6) |
             (static_cast<unsigned char>(path[at + follow]) & 0x3Fu);
    }
    out.push_back(static_cast<wchar_t>(code));
    at += extra + 1;
  }
  return out;
}

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_POSIX_PATH_H
