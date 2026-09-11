/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "paths.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <knownfolders.h>
#include <shlobj_core.h>

#include <string>

namespace fluideq_engine {

namespace {

/**
 * `GetEnvironmentVariableW` rather than the CRT's `_wgetenv`.
 *
 * The CRT snapshots the environment when it starts and a caller that sets a
 * variable through the Win32 API does not change that snapshot. The smoke
 * test sets the override in the same process that then loads this DLL, so
 * the two views have to be the same one.
 */
std::wstring environment(const wchar_t* name) {
  const DWORD needed = GetEnvironmentVariableW(name, nullptr, 0);
  if (needed == 0) {
    return std::wstring();
  }
  std::wstring value(needed, L'\0');
  const DWORD written = GetEnvironmentVariableW(name, value.data(), needed);
  if (written == 0 || written >= needed) {
    return std::wstring();
  }
  value.resize(written);
  return value;
}

/** A path with any trailing separators removed, keeping a drive root intact. */
std::wstring trim_separators(std::wstring path) {
  while (path.size() > 3 &&
         (path.back() == L'\\' || path.back() == L'/')) {
    path.pop_back();
  }
  return path;
}

}  // namespace

bool is_directory(const std::wstring& path) {
  if (path.empty()) {
    return false;
  }
  const DWORD attributes = GetFileAttributesW(path.c_str());
  return attributes != INVALID_FILE_ATTRIBUTES &&
         (attributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
}

std::wstring engine_root() {
  const std::wstring override_root = environment(L"FLUIDEQ_ENGINE_ROOT");
  if (!override_root.empty()) {
    return trim_separators(override_root);
  }

  PWSTR program_data = nullptr;
  const HRESULT found = SHGetKnownFolderPath(FOLDERID_ProgramData, 0, nullptr,
                                             &program_data);
  if (FAILED(found) || program_data == nullptr) {
    CoTaskMemFree(program_data);
    return std::wstring();
  }
  std::wstring root = trim_separators(program_data);
  CoTaskMemFree(program_data);
  root += L"\\FluidEQ\\engine";
  return root;
}

std::wstring config_dir() {
  const std::wstring root = engine_root();
  if (root.empty()) {
    return std::wstring();
  }
  return root + L"\\config";
}

std::wstring log_path() {
  const std::wstring root = engine_root();
  if (root.empty()) {
    return std::wstring();
  }
  return root + L"\\engine.log";
}

std::wstring owner_pipe_name() {
  const std::wstring override_name = environment(L"FLUIDEQ_ENGINE_OWNER_PIPE");
  return override_name.empty() ? std::wstring(L"\\\\.\\pipe\\FluidEQ-Engine-Owner")
                               : override_name;
}

std::wstring parent_of(const std::wstring& path) {
  const size_t cut = path.find_last_of(L"\\/");
  if (cut == std::wstring::npos) {
    return std::wstring();
  }
  // `C:\ProgramData`'s parent is `C:\`, not `C:` — the second names the
  // per-process current directory on that drive rather than its root, so
  // watching it would watch wherever the host process last happened to be.
  if (cut == 2 && path.size() > 2 && path[1] == L':') {
    return path.substr(0, 3);
  }
  if (cut < 3) {
    return std::wstring();
  }
  return path.substr(0, cut);
}

std::wstring deepest_existing(const std::wstring& path) {
  std::wstring at = trim_separators(path);
  while (!at.empty()) {
    if (is_directory(at)) {
      return at;
    }
    at = parent_of(at);
  }
  return std::wstring();
}

}  // namespace fluideq_engine
