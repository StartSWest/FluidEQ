/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "config_file.h"

#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

#include <cerrno>
#include <cstdint>

#include "posix_path.h"

namespace fluideq_mac {

namespace {

/** The Windows effect's ceiling: nothing FluidEQ writes comes near it. */
constexpr int64_t kMaxConfigBytes = 4LL * 1024 * 1024;

}  // namespace

std::optional<std::string> read_config_file(const std::wstring& path) {
  const std::string native = fluideq_engine::posix_path(path);
  const int file = ::open(native.c_str(), O_RDONLY | O_CLOEXEC);
  if (file < 0) {
    return std::nullopt;
  }
  struct stat info {};
  if (::fstat(file, &info) != 0 || !S_ISREG(info.st_mode) ||
      info.st_size > kMaxConfigBytes) {
    ::close(file);
    return std::nullopt;
  }
  std::string text(static_cast<size_t>(info.st_size), '\0');
  size_t filled = 0;
  while (filled < text.size()) {
    const ssize_t read_now =
        ::read(file, text.data() + filled, text.size() - filled);
    if (read_now < 0 && errno == EINTR) {
      continue;
    }
    if (read_now < 0) {
      ::close(file);
      return std::nullopt;
    }
    if (read_now == 0) {
      break;  // Truncated under us; what arrived is what there is.
    }
    filled += static_cast<size_t>(read_now);
  }
  ::close(file);
  text.resize(filled);
  return text;
}

}  // namespace fluideq_mac
