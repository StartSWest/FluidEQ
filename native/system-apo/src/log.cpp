/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "log.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <cstdio>
#include <string>

#include "paths.h"

namespace fluideq_engine {

namespace {

// A support log, not an audit trail. The cap is what stops a user dragging a
// band for a minute — one rewrite of the config per frame, one line per
// rewrite — from filling the system drive of a machine nobody is watching.
constexpr long long kMaxLogBytes = 1024 * 1024;

constexpr DWORD kShare =
    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE;

/** `2026-09-09T14:23:11.482Z `, UTC because audiodg has no user's locale. */
std::string timestamp() {
  SYSTEMTIME now = {};
  GetSystemTime(&now);
  char text[32] = {};
  const int written = std::snprintf(
      text, sizeof(text), "%04u-%02u-%02uT%02u:%02u:%02u.%03uZ ",
      static_cast<unsigned>(now.wYear), static_cast<unsigned>(now.wMonth),
      static_cast<unsigned>(now.wDay), static_cast<unsigned>(now.wHour),
      static_cast<unsigned>(now.wMinute), static_cast<unsigned>(now.wSecond),
      static_cast<unsigned>(now.wMilliseconds));
  if (written <= 0) {
    return std::string();
  }
  return std::string(text, static_cast<size_t>(written));
}

}  // namespace

std::string to_utf8(const std::wstring& text) {
  if (text.empty()) {
    return std::string();
  }
  const int needed = WideCharToMultiByte(
      CP_UTF8, 0, text.c_str(), static_cast<int>(text.size()), nullptr, 0,
      nullptr, nullptr);
  if (needed <= 0) {
    return std::string("<unprintable>");
  }
  std::string out(static_cast<size_t>(needed), '\0');
  const int written = WideCharToMultiByte(
      CP_UTF8, 0, text.c_str(), static_cast<int>(text.size()), out.data(),
      needed, nullptr, nullptr);
  if (written <= 0) {
    return std::string("<unprintable>");
  }
  out.resize(static_cast<size_t>(written));
  return out;
}

std::wstring file_name_of(const std::wstring& path) {
  const size_t cut = path.find_last_of(L"\\/");
  if (cut == std::wstring::npos) {
    return path;
  }
  return path.substr(cut + 1);
}

std::string decibels(double value) {
  char text[32] = {};
  const int written = std::snprintf(text, sizeof(text), "%.1f", value);
  if (written <= 0) {
    return std::string("?");
  }
  return std::string(text, static_cast<size_t>(written));
}

Log::Log(const std::wstring& endpoint_guid)
    : path_(log_path()),
      tag_(endpoint_guid.empty() ? std::string("{no endpoint} ")
                                 : to_utf8(endpoint_guid) + " ") {}

void Log::write(std::string_view message) noexcept {
  if (path_.empty()) {
    return;
  }
  // `noexcept` is a promise, and building the line allocates. A log that
  // cannot allocate is not a reason to tear down an audio endpoint.
  try {
    const std::string line = timestamp() + tag_ + std::string(message) + "\r\n";

    const std::lock_guard<std::mutex> held(mutex_);
    // FILE_APPEND_DATA without FILE_WRITE_DATA is what makes each write land
    // whole at the end of the file: one audiodg.exe hosts one instance of
    // this effect per attached output, and all of them share this file.
    HANDLE file =
        CreateFileW(path_.c_str(), FILE_APPEND_DATA | SYNCHRONIZE, kShare,
                    nullptr, OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (file == INVALID_HANDLE_VALUE) {
      return;
    }
    LARGE_INTEGER size = {};
    if (GetFileSizeEx(file, &size) != 0 && size.QuadPart > kMaxLogBytes) {
      CloseHandle(file);
      // Truncation needs write access an append-only handle does not have,
      // so this is a second open — rare enough that the cost never shows.
      const HANDLE truncating =
          CreateFileW(path_.c_str(), GENERIC_WRITE, kShare, nullptr,
                      CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
      if (truncating != INVALID_HANDLE_VALUE) {
        CloseHandle(truncating);
      }
      file = CreateFileW(path_.c_str(), FILE_APPEND_DATA | SYNCHRONIZE, kShare,
                         nullptr, OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
      if (file == INVALID_HANDLE_VALUE) {
        return;
      }
    }
    DWORD written = 0;
    WriteFile(file, line.data(), static_cast<DWORD>(line.size()), &written,
              nullptr);
    CloseHandle(file);
  } catch (...) {
    // Deliberately silent: there is nowhere left to report a failure of the
    // thing that reports failures.
  }
}

}  // namespace fluideq_engine
