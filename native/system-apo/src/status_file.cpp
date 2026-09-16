/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "status_file.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <cstdio>
#include <cstring>
#include <map>
#include <mutex>
#include <string>
#include <utility>

#include "paths.h"

namespace fluideq_engine {

namespace {

std::string utc_now() {
  SYSTEMTIME now = {};
  GetSystemTime(&now);
  char text[32] = {};
  std::snprintf(text, sizeof(text), "%04u-%02u-%02uT%02u:%02u:%02u.%03uZ",
                now.wYear, now.wMonth, now.wDay, now.wHour, now.wMinute,
                now.wSecond, now.wMilliseconds);
  return text;
}

// The instances counted on each output in this process, and the lock every
// status write in it is made under — which is also what keeps the last one
// out's "not locked" from landing after a new instance's "locked".
struct Board {
  std::mutex mutex;
  std::map<std::wstring, unsigned> holders;
};

Board& board() {
  static Board instance;
  return instance;
}

/** `why` gets which step failed and Windows' own number for it. */
bool fail(std::string* why, const char* step, DWORD error) {
  if (why != nullptr) {
    *why = std::string(step) + ": error " + std::to_string(error);
  }
  return false;
}

/**
 * Rename `from` over `to`, whole, while the app may be reading `to`.
 *
 * `MoveFileEx` with `MOVEFILE_REPLACE_EXISTING` fails with a sharing
 * violation while anybody holds the target open, and the app holds it for
 * exactly as long as a read takes — which was long enough: its first read at
 * launch met the engine's first write, and the file kept saying what the
 * previous stream had left in it. Windows 10 1607 and later can rename with
 * POSIX semantics instead, superseding a target whose readers opened it with
 * `FILE_SHARE_DELETE` (Node does; the reader keeps the old contents on its
 * handle). Where that is refused — an older Windows, a file system without
 * it — the plain rename is tried, and its failure is the one reported.
 */
bool rename_over(const std::wstring& from, const std::wstring& to,
                 std::string* why) {
  const HANDLE source =
      CreateFileW(from.c_str(), DELETE, FILE_SHARE_READ | FILE_SHARE_DELETE,
                  nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (source != INVALID_HANDLE_VALUE) {
    const size_t name_bytes = to.size() * sizeof(wchar_t);
    std::string block(sizeof(FILE_RENAME_INFO) + name_bytes, '\0');
    auto* info = reinterpret_cast<FILE_RENAME_INFO*>(block.data());
    info->Flags =
        FILE_RENAME_FLAG_REPLACE_IF_EXISTS | FILE_RENAME_FLAG_POSIX_SEMANTICS;
    info->RootDirectory = nullptr;
    info->FileNameLength = static_cast<DWORD>(name_bytes);
    std::memcpy(info->FileName, to.data(), name_bytes);
    const BOOL renamed = SetFileInformationByHandle(
        source, FileRenameInfoEx, info, static_cast<DWORD>(block.size()));
    CloseHandle(source);
    if (renamed != 0) {
      return true;
    }
  }
  if (MoveFileExW(from.c_str(), to.c_str(), MOVEFILE_REPLACE_EXISTING) != 0) {
    return true;
  }
  return fail(why, "rename into place", GetLastError());
}

}  // namespace

bool write_status(const EngineStatus& status, std::string* why) noexcept {
  try {
    const std::wstring root = engine_root();
    if (root.empty() || status.endpoint.empty()) {
      return fail(why, "no engine root or endpoint", 0);
    }
    if (!is_directory(root)) {
      return fail(why, "engine root is not a directory", GetLastError());
    }
    const std::wstring path = root + L"\\status-" + status.endpoint + L".json";
    // Named for the process: an audiodg.exe that Windows restarts can still
    // be writing while its successor starts, and the two must not share a
    // half-written temporary. Within one process `StatusShare` serialises.
    const std::wstring aside =
        path + L"." + std::to_wstring(GetCurrentProcessId()) + L".tmp";
    const std::string text =
        status_json(status, GetCurrentProcessId(), utc_now());

    const HANDLE file = CreateFileW(aside.c_str(), GENERIC_WRITE, 0, nullptr,
                                    CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL,
                                    nullptr);
    if (file == INVALID_HANDLE_VALUE) {
      return fail(why, "create the temporary", GetLastError());
    }
    DWORD written = 0;
    const BOOL wrote = WriteFile(file, text.data(),
                                 static_cast<DWORD>(text.size()), &written,
                                 nullptr);
    const DWORD write_error = GetLastError();
    CloseHandle(file);
    if (wrote == 0 || written != text.size()) {
      DeleteFileW(aside.c_str());
      return fail(why, "write the temporary", wrote == 0 ? write_error : 0);
    }
    if (!rename_over(aside, path, why)) {
      DeleteFileW(aside.c_str());
      return false;
    }
    return true;
  } catch (...) {
    return fail(why, "exception", 0);
  }
}

StatusShare::~StatusShare() { leave(); }

bool StatusShare::publish(const EngineStatus& status,
                          std::string* why) noexcept {
  try {
    Board& shared = board();
    const std::lock_guard<std::mutex> hold(shared.mutex);
    if (endpoint_.empty() && !status.endpoint.empty()) {
      // Copied and counted before it is recorded as counted, so an
      // allocation failing in either step leaves nothing to undo.
      std::wstring endpoint = status.endpoint;
      ++shared.holders[endpoint];
      endpoint_.swap(endpoint);
    }
    return write_status(status, why);
  } catch (...) {
    return fail(why, "exception", 0);
  }
}

bool StatusShare::leave(std::string* why) noexcept {
  if (endpoint_.empty()) {
    return true;
  }
  try {
    Board& shared = board();
    const std::lock_guard<std::mutex> hold(shared.mutex);
    std::wstring endpoint;
    endpoint.swap(endpoint_);
    const auto found = shared.holders.find(endpoint);
    if (found == shared.holders.end() || --found->second > 0) {
      return true;
    }
    shared.holders.erase(found);
    EngineStatus released;
    released.endpoint = std::move(endpoint);
    return write_status(released, why);
  } catch (...) {
    return fail(why, "exception", 0);
  }
}

}  // namespace fluideq_engine
