/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "status_file.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <cstdio>
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

}  // namespace

bool write_status(const EngineStatus& status) noexcept {
  try {
    const std::wstring root = engine_root();
    if (root.empty() || status.endpoint.empty() || !is_directory(root)) {
      return false;
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
      return false;
    }
    DWORD written = 0;
    const BOOL wrote = WriteFile(file, text.data(),
                                 static_cast<DWORD>(text.size()), &written,
                                 nullptr);
    CloseHandle(file);
    if (wrote == 0 || written != text.size() ||
        MoveFileExW(aside.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING) ==
            0) {
      DeleteFileW(aside.c_str());
      return false;
    }
    return true;
  } catch (...) {
    return false;
  }
}

StatusShare::~StatusShare() { leave(); }

bool StatusShare::publish(const EngineStatus& status) noexcept {
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
    return write_status(status);
  } catch (...) {
    return false;
  }
}

bool StatusShare::leave() noexcept {
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
    return write_status(released);
  } catch (...) {
    return false;
  }
}

}  // namespace fluideq_engine
