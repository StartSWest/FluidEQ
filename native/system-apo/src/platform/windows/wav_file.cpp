/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// Reading an impulse response off disk on Windows. The function is moved
// here verbatim from `wav.cpp`, which is now free of any operating system and
// builds wherever an engine does; it hands the bytes to `parse_wav`, unchanged.

// `WIN32_LEAN_AND_MEAN` and `NOMINMAX` keep this translation unit's only
// `<windows.h>` include from dragging in GDI/shell declarations or redefining
// `min`/`max` over the standard library's names. At global scope, before the
// standard headers, as a Windows header has to be: `wav.cpp` used to include
// it inside the engine's namespace, which only worked because every header it
// pulls in had already been included above it.
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include "../../wav.h"

namespace fluideq_engine {

std::optional<WavData> read_wav(const std::wstring& path) {
  const HANDLE file =
      CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr,
                 OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) {
    return std::nullopt;
  }

  LARGE_INTEGER file_size{};
  if (!GetFileSizeEx(file, &file_size) || file_size.QuadPart <= 0 ||
      file_size.QuadPart > static_cast<LONGLONG>(kMaxWavBytes)) {
    CloseHandle(file);
    // Empty, or past the cap. Checked against the size the file system
    // reports rather than after reading it: this runs inside audiodg.exe on
    // whatever path a config file names, so the file the user pointed at is
    // never read into memory before its size has been agreed to.
    // `kMaxWavBytes` is well under `UINT32_MAX`, so a chunk size in the
    // format this reader parses can still describe every byte of it.
    return std::nullopt;
  }

  std::vector<uint8_t> buffer(static_cast<size_t>(file_size.QuadPart));
  size_t total_read = 0;
  while (total_read < buffer.size()) {
    // `ReadFile` can return short (a network volume, an interrupted read)
    // even for a plain local file; looping until the buffer is full or a
    // call fails is what makes a short read impossible to mistake for a
    // truncated file.
    const size_t remaining = buffer.size() - total_read;
    constexpr size_t kMaxPerCall = 1u << 20;
    const DWORD to_read = static_cast<DWORD>(
        remaining < kMaxPerCall ? remaining : kMaxPerCall);
    DWORD read_now = 0;
    if (!ReadFile(file, buffer.data() + total_read, to_read, &read_now,
                 nullptr) ||
        read_now == 0) {
      CloseHandle(file);
      return std::nullopt;
    }
    total_read += read_now;
  }
  CloseHandle(file);

  return parse_wav(buffer.data(), buffer.size());
}

}  // namespace fluideq_engine
