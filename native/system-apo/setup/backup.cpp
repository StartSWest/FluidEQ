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
#include <vector>

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
  // The code is read before the message is built. `backup_dir()` asks the
  // shell for a known folder, which sets its own last error, so describing the
  // failure inside the same expression describes the wrong call — and the
  // message that reaches the user names an error that never happened.
  if (!ensure_directory(backup_dir())) {
    const unsigned long why = GetLastError();
    error = L"could not create " + backup_dir() + L": " + describe_error(why);
    return false;
  }
  if (!write_utf8(path, to_json(values))) {
    const unsigned long why = GetLastError();
    error = L"could not write " + path + L": " + describe_error(why);
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

namespace {

/**
 * One store of "what an endpoint was before a switch took something off
 * it": one file per endpoint under `directory`, written once. Equalizer
 * APO's switch-off and a microphone's own effects keep one each.
 */
std::wstring record_path(const std::wstring& directory,
                         const std::wstring& guid) {
  // Same reasoning as `backup_path`: the guid check is what stops a name
  // becoming a path.
  if (!is_valid_endpoint_guid(guid) || directory.empty()) {
    return std::wstring();
  }
  return directory + L"\\" + guid + L".json";
}

bool save_record_once(const std::wstring& directory, const std::wstring& guid,
                      const FxValues& values, const wchar_t* what,
                      std::wstring& error) {
  const std::wstring path = record_path(directory, guid);
  if (path.empty()) {
    error = std::wstring(L"no location to record ") + what + L" for " + guid;
    return false;
  }
  // Once: a second switch-off must not record the second state, which is
  // one with the first's removal already in it.
  if (path_exists(path)) {
    return true;
  }
  if (!ensure_directory(directory)) {
    const unsigned long why = GetLastError();
    error = L"could not create " + directory + L": " + describe_error(why);
    return false;
  }
  if (!write_utf8(path, to_json(values))) {
    const unsigned long why = GetLastError();
    error = L"could not write " + path + L": " + describe_error(why);
    return false;
  }
  return true;
}

std::optional<FxValues> load_record(const std::wstring& directory,
                                    const std::wstring& guid) {
  const std::wstring path = record_path(directory, guid);
  if (path.empty()) {
    return std::nullopt;
  }
  const std::optional<std::wstring> text = read_utf8(path);
  return text.has_value() ? from_json(*text) : std::nullopt;
}

void remove_record(const std::wstring& directory, const std::wstring& guid) {
  const std::wstring path = record_path(directory, guid);
  if (!path.empty()) {
    DeleteFileW(path.c_str());
  }
}

std::vector<std::wstring> recorded_endpoints(const std::wstring& directory) {
  std::vector<std::wstring> guids;
  if (directory.empty()) {
    return guids;
  }
  for (const std::wstring& name : files_matching(directory, L"*.json")) {
    const size_t dot = name.find_last_of(L'.');
    if (dot == std::wstring::npos) {
      continue;
    }
    const std::wstring guid = name.substr(0, dot);
    if (is_valid_endpoint_guid(guid)) {
      guids.push_back(guid);
    }
  }
  return guids;
}

}  // namespace

bool save_apo_off_once(const std::wstring& guid, const FxValues& values,
                       std::wstring& error) {
  return save_record_once(apo_off_dir(), guid, values,
                          L"Equalizer APO's state", error);
}

std::optional<FxValues> load_apo_off(const std::wstring& guid) {
  return load_record(apo_off_dir(), guid);
}

void remove_apo_off(const std::wstring& guid) {
  remove_record(apo_off_dir(), guid);
}

std::vector<std::wstring> apo_off_endpoints() {
  return recorded_endpoints(apo_off_dir());
}

bool save_mic_own_off_once(const std::wstring& guid, const FxValues& values,
                           std::wstring& error) {
  return save_record_once(mic_own_off_dir(), guid, values,
                          L"the microphone's own effects", error);
}

std::optional<FxValues> load_mic_own_off(const std::wstring& guid) {
  return load_record(mic_own_off_dir(), guid);
}

void remove_mic_own_off(const std::wstring& guid) {
  remove_record(mic_own_off_dir(), guid);
}

std::vector<std::wstring> mic_own_off_endpoints() {
  return recorded_endpoints(mic_own_off_dir());
}

}  // namespace fluideq_engine::setup
