/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The file-reading slice of `<windows.h>`, over POSIX, for exactly three
 * shared engine sources: `config_file.cpp`, `wav.cpp` and
 * `chain_signature.cpp`.
 *
 * Each of those keeps a portable parser and a Windows file read in one
 * translation unit, and the Linux branch carries no edits to Windows code
 * (features arrive from `main` by merge, and an edit there is a conflict on
 * every merge). So rather than copy the parsers and let them drift, those
 * three files are compiled as they are, against this header, which is on the
 * include path of the Linux engine alone.
 *
 * Deliberately only what those files call. A new Windows call in any of them
 * fails the Linux build by name, which is the signal that one of them needs a
 * Linux counterpart — never a silent fallback.
 */
#ifndef FLUIDEQ_LINUX_COMPAT_WINDOWS_H
#define FLUIDEQ_LINUX_COMPAT_WINDOWS_H

#if !defined(__linux__)
#error "compat/windows.h is the Linux engine's stand-in and must not be used elsewhere"
#endif

#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

#include <cerrno>
#include <cstdint>
#include <string>

#include "wide_path.h"

using DWORD = uint32_t;
using LONGLONG = int64_t;
using BOOL = int;
using HANDLE = void*;

union LARGE_INTEGER {
  LONGLONG QuadPart;
};

struct FILETIME {
  DWORD dwLowDateTime;
  DWORD dwHighDateTime;
};

struct WIN32_FILE_ATTRIBUTE_DATA {
  DWORD dwFileAttributes;
  FILETIME ftCreationTime;
  FILETIME ftLastAccessTime;
  FILETIME ftLastWriteTime;
  DWORD nFileSizeHigh;
  DWORD nFileSizeLow;
};

enum GET_FILEEX_INFO_LEVELS { GetFileExInfoStandard };

inline constexpr DWORD GENERIC_READ = 0x80000000u;
inline constexpr DWORD FILE_SHARE_READ = 0x1u;
inline constexpr DWORD FILE_SHARE_WRITE = 0x2u;
inline constexpr DWORD FILE_SHARE_DELETE = 0x4u;
inline constexpr DWORD OPEN_EXISTING = 3u;
inline constexpr DWORD FILE_ATTRIBUTE_NORMAL = 0x80u;
// A descriptor is carried in the pointer as fd + 1, so 0 stays "no handle"
// and this value can never be a real one.
inline HANDLE const INVALID_HANDLE_VALUE =
    reinterpret_cast<HANDLE>(static_cast<intptr_t>(-1));

namespace fluideq_linux_compat {

inline int fd_of(HANDLE handle) noexcept {
  return static_cast<int>(reinterpret_cast<intptr_t>(handle)) - 1;
}

/** Windows' 100 ns ticks since 1601, from a POSIX time. */
inline FILETIME filetime_of(const struct timespec& at) noexcept {
  constexpr uint64_t kEpochGap = 116444736000000000ull;
  const uint64_t ticks = kEpochGap +
                         static_cast<uint64_t>(at.tv_sec) * 10000000ull +
                         static_cast<uint64_t>(at.tv_nsec) / 100ull;
  return FILETIME{static_cast<DWORD>(ticks & 0xFFFFFFFFu),
                  static_cast<DWORD>(ticks >> 32)};
}

}  // namespace fluideq_linux_compat

// Every share mode is implied: Linux has no mandatory locks, so the app can
// rewrite a file this has open, which is what the Windows share flags ask for.
inline HANDLE CreateFileW(const wchar_t* path, DWORD access, DWORD share,
                          void* security, DWORD disposition, DWORD attributes,
                          HANDLE templ) noexcept {
  (void)access;
  (void)share;
  (void)security;
  (void)disposition;
  (void)attributes;
  (void)templ;
  try {
    const std::string native = fluideq_linux::narrow_path(path);
    const int fd = ::open(native.c_str(), O_RDONLY | O_CLOEXEC);
    if (fd < 0) return INVALID_HANDLE_VALUE;
    return reinterpret_cast<HANDLE>(static_cast<intptr_t>(fd) + 1);
  } catch (...) {
    return INVALID_HANDLE_VALUE;
  }
}

inline BOOL GetFileSizeEx(HANDLE file, LARGE_INTEGER* size) noexcept {
  struct stat info {};
  if (::fstat(fluideq_linux_compat::fd_of(file), &info) != 0 ||
      !S_ISREG(info.st_mode)) {
    return 0;
  }
  size->QuadPart = static_cast<LONGLONG>(info.st_size);
  return 1;
}

inline BOOL ReadFile(HANDLE file, void* buffer, DWORD want, DWORD* read,
                     void* overlapped) noexcept {
  (void)overlapped;
  for (;;) {
    const ssize_t got = ::read(fluideq_linux_compat::fd_of(file), buffer, want);
    if (got >= 0) {
      *read = static_cast<DWORD>(got);
      return 1;
    }
    if (errno != EINTR) return 0;
  }
}

inline BOOL CloseHandle(HANDLE file) noexcept {
  return ::close(fluideq_linux_compat::fd_of(file)) == 0 ? 1 : 0;
}

inline BOOL GetFileAttributesExW(const wchar_t* path,
                                 GET_FILEEX_INFO_LEVELS level,
                                 WIN32_FILE_ATTRIBUTE_DATA* data) noexcept {
  (void)level;
  try {
    struct stat info {};
    if (::stat(fluideq_linux::narrow_path(path).c_str(), &info) != 0) {
      return 0;
    }
    const auto size = static_cast<uint64_t>(info.st_size);
    data->dwFileAttributes = S_ISDIR(info.st_mode) ? 0x10u : FILE_ATTRIBUTE_NORMAL;
    data->ftCreationTime = fluideq_linux_compat::filetime_of(info.st_ctim);
    data->ftLastAccessTime = fluideq_linux_compat::filetime_of(info.st_atim);
    data->ftLastWriteTime = fluideq_linux_compat::filetime_of(info.st_mtim);
    data->nFileSizeHigh = static_cast<DWORD>(size >> 32);
    data->nFileSizeLow = static_cast<DWORD>(size & 0xFFFFFFFFu);
    return 1;
  } catch (...) {
    return 0;
  }
}

#endif  // FLUIDEQ_LINUX_COMPAT_WINDOWS_H
