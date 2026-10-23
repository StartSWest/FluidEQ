/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `log.h` for Linux: the same `engine.log` lines the Windows engine writes —
 * UTC timestamp, pid, output tag — so a bug report reads them the same way
 * (`takeLogSince` parses the timestamp, never the platform).
 */

#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

#include <cstdio>
#include <ctime>
#include <string>

#include "../compat/wide_path.h"
#include "log.h"
#include "paths.h"

namespace fluideq_engine {

namespace {

// The same cap as Windows, for the same reason: a minute of band dragging is
// a line per config write, and nobody is watching this disk.
constexpr off_t kMaxLogBytes = 1024 * 1024;

std::string timestamp() {
  struct timespec now {};
  clock_gettime(CLOCK_REALTIME, &now);
  struct tm utc {};
  gmtime_r(&now.tv_sec, &utc);
  char text[64] = {};
  const int written = std::snprintf(
      text, sizeof(text), "%04d-%02d-%02dT%02d:%02d:%02d.%03ldZ ",
      utc.tm_year + 1900, utc.tm_mon + 1, utc.tm_mday, utc.tm_hour,
      utc.tm_min, utc.tm_sec, now.tv_nsec / 1000000L);
  return written > 0 ? std::string(text, static_cast<size_t>(written))
                     : std::string();
}

}  // namespace

std::string to_utf8(const std::wstring& text) {
  return fluideq_linux::narrow(text);
}

std::wstring file_name_of(const std::wstring& path) {
  const size_t cut = path.find_last_of(L"\\/");
  return cut == std::wstring::npos ? path : path.substr(cut + 1);
}

std::string decibels(double value) {
  char text[32] = {};
  const int written = std::snprintf(text, sizeof(text), "%.1f", value);
  return written > 0 ? std::string(text, static_cast<size_t>(written))
                     : std::string("?");
}

std::string guid_text(const GUID& id) {
  char text[40] = {};
  const int written = std::snprintf(
      text, sizeof(text), "{%08X-%04X-%04X-%02X%02X-%02X%02X%02X%02X%02X%02X}",
      static_cast<unsigned>(id.Data1), static_cast<unsigned>(id.Data2),
      static_cast<unsigned>(id.Data3), id.Data4[0], id.Data4[1], id.Data4[2],
      id.Data4[3], id.Data4[4], id.Data4[5], id.Data4[6], id.Data4[7]);
  return written > 0 ? std::string(text, static_cast<size_t>(written))
                     : std::string("?");
}

Log::Log(const std::wstring& endpoint_guid)
    : path_(log_path()),
      tag_(endpoint_guid.empty() ? std::string("{no endpoint} ")
                                 : to_utf8(endpoint_guid) + " ") {}

const std::wstring& no_endpoint() noexcept {
  static const std::wstring empty;
  return empty;
}

void trace(const std::wstring& endpoint_guid,
           std::string_view message) noexcept {
  try {
    Log(endpoint_guid).write(message);
  } catch (...) {
    // A line that cannot be built is not a reason to fail its caller.
  }
}

void Log::write(std::string_view message) noexcept {
  if (path_.empty()) return;
  try {
    const std::string line = timestamp() + "pid=" + std::to_string(getpid()) +
                             " " + tag_ + std::string(message) + "\n";
    const std::string path = fluideq_linux::narrow_path(path_);
    const std::lock_guard<std::mutex> held(mutex_);
    // O_APPEND puts each whole line at the end even with every output's
    // watcher writing to the one file.
    int fd = ::open(path.c_str(), O_WRONLY | O_APPEND | O_CREAT | O_CLOEXEC,
                    0644);
    if (fd < 0) return;
    struct stat info {};
    if (::fstat(fd, &info) == 0 && info.st_size > kMaxLogBytes) {
      ::close(fd);
      fd = ::open(path.c_str(),
                  O_WRONLY | O_APPEND | O_CREAT | O_TRUNC | O_CLOEXEC, 0644);
      if (fd < 0) return;
    }
    const ssize_t written = ::write(fd, line.data(), line.size());
    (void)written;  // Nowhere left to report a failure of the reporter.
    ::close(fd);
  } catch (...) {
    // Deliberately silent, as on Windows.
  }
}

}  // namespace fluideq_engine
