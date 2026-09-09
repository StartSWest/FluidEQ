/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "backup.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <optional>
#include <string>

#include "fs.h"
#include "registry.h"

namespace fluideq_engine::setup {

std::wstring backup_path(const std::wstring& guid) {
  // The guid check is what keeps this a file name rather than a path: it is
  // concatenated straight onto a directory this program can write anywhere in.
  if (!is_valid_endpoint_guid(guid)) {
    return std::wstring();
  }
  const std::wstring directory = backup_dir();
  return directory.empty() ? directory : directory + L"\\" + guid + L".json";
}

bool backup_exists(const std::wstring& guid) {
  const std::wstring path = backup_path(guid);
  return !path.empty() && path_exists(path);
}

bool save_backup_once(const std::wstring& guid, const FxValues& values,
                      std::wstring& error) {
  const std::wstring path = backup_path(guid);
  if (path.empty()) {
    error = L"no backup location for " + guid;
    return false;
  }
  if (path_exists(path)) {
    return true;
  }
  if (!ensure_directory(backup_dir())) {
    error = L"could not create " + backup_dir() + L": " +
            describe_error(GetLastError());
    return false;
  }
  if (!write_utf8(path, to_json(values))) {
    error = L"could not write " + path + L": " +
            describe_error(GetLastError());
    return false;
  }
  return true;
}

std::optional<FxValues> load_backup(const std::wstring& guid) {
  const std::wstring path = backup_path(guid);
  if (path.empty()) {
    return std::nullopt;
  }
  const std::optional<std::wstring> text = read_utf8(path);
  if (!text.has_value()) {
    return std::nullopt;
  }
  return from_json(*text);
}

void remove_backup(const std::wstring& guid) {
  const std::wstring path = backup_path(guid);
  if (!path.empty()) {
    DeleteFileW(path.c_str());
  }
}

}  // namespace fluideq_engine::setup
