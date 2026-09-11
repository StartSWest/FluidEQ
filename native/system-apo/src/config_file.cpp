/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "config_file.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <algorithm>

namespace fluideq_engine {

namespace {

constexpr long long kMaxConfigBytes = 4LL * 1024 * 1024;

}  // namespace

std::optional<std::string> read_config_file(const std::wstring& path) {
  const HANDLE file = CreateFileW(
      path.c_str(), GENERIC_READ,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr,
      OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) {
    return std::nullopt;
  }
  LARGE_INTEGER size = {};
  if (GetFileSizeEx(file, &size) == 0 || size.QuadPart > kMaxConfigBytes) {
    CloseHandle(file);
    return std::nullopt;
  }
  std::string text(static_cast<size_t>(size.QuadPart), '\0');
  size_t filled = 0;
  while (filled < text.size()) {
    DWORD read = 0;
    const DWORD want = static_cast<DWORD>(
        std::min<size_t>(text.size() - filled, 1u << 20));
    if (ReadFile(file, text.data() + filled, want, &read, nullptr) == 0) {
      CloseHandle(file);
      return std::nullopt;
    }
    if (read == 0) {
      break;  // Truncated under us; what arrived is what there is.
    }
    filled += read;
  }
  CloseHandle(file);
  text.resize(filled);
  return text;
}

}  // namespace fluideq_engine
