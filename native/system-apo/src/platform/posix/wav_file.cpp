/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// Reading an impulse response off disk on macOS, under the same contract as
// the Windows reader beside it: the size is agreed before a byte is read, the
// file is read whole or not at all, and the bytes go to `parse_wav` unchanged.

#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

#include <cerrno>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include "../../wav.h"
#include "posix_path.h"

namespace fluideq_engine {

std::optional<WavData> read_wav(const std::wstring& path) {
  const std::string native = posix_path(path);
  const int file = ::open(native.c_str(), O_RDONLY | O_CLOEXEC);
  if (file < 0) {
    return std::nullopt;
  }

  // Checked against the size the file system reports rather than after
  // reading it: the path comes from a configuration file, so the file it names
  // is never read into memory before its size has been agreed to.
  struct stat info {};
  if (::fstat(file, &info) != 0 || info.st_size <= 0 ||
      static_cast<uint64_t>(info.st_size) > kMaxWavBytes) {
    ::close(file);
    return std::nullopt;
  }

  std::vector<uint8_t> buffer(static_cast<size_t>(info.st_size));
  size_t total_read = 0;
  while (total_read < buffer.size()) {
    // A short read is not the end of the file: looping until the buffer is
    // full or a call fails is what makes a short read impossible to mistake
    // for a truncated file.
    const ssize_t read_now = ::read(file, buffer.data() + total_read,
                                    buffer.size() - total_read);
    if (read_now < 0 && errno == EINTR) {
      continue;
    }
    if (read_now <= 0) {
      ::close(file);
      return std::nullopt;
    }
    total_read += static_cast<size_t>(read_now);
  }
  ::close(file);

  return parse_wav(buffer.data(), buffer.size());
}

}  // namespace fluideq_engine
