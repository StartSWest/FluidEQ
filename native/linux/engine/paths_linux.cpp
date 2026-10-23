/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `paths.h` for Linux: the engine's folder is the user's own.
 *
 * On Windows the engine runs inside the audio service as LOCAL SERVICE and
 * its folder is under `%ProgramData%`. Here it is a process of the user's,
 * started by FluidEQ, so the folder is `$XDG_DATA_HOME/FluidEQ/engine`
 * (`~/.local/share/FluidEQ/engine` when unset), with the same layout:
 * `config/` for what the app writes, `engine.log`, and a `status-{GUID}.json`
 * per output. `FLUIDEQ_ENGINE_ROOT` replaces the whole path, as on Windows.
 *
 * Paths stay wide, joined with `/`: the shared resolver appends `\` and a
 * file name to `config_dir()`, and `narrow_path` turns every separator into
 * `/` on the way to the kernel, so both spellings land on the same file.
 */

#include <sys/stat.h>

#include <cstdlib>
#include <string>

#include "../compat/wide_path.h"
#include "paths.h"

namespace fluideq_engine {

namespace {

std::wstring trim_separators(std::wstring path) {
  while (path.size() > 1 && (path.back() == L'/' || path.back() == L'\\')) {
    path.pop_back();
  }
  return path;
}

std::wstring from_environment(const char* name) {
  const char* value = std::getenv(name);
  return value != nullptr && value[0] == '/' ? fluideq_linux::widen(value)
                                             : std::wstring();
}

}  // namespace

bool is_directory(const std::wstring& path) {
  if (path.empty()) return false;
  struct stat info {};
  return ::stat(fluideq_linux::narrow_path(path).c_str(), &info) == 0 &&
         S_ISDIR(info.st_mode);
}

std::wstring engine_root() {
  if (std::wstring root = from_environment("FLUIDEQ_ENGINE_ROOT"); !root.empty()) {
    return trim_separators(std::move(root));
  }
  if (std::wstring data = from_environment("XDG_DATA_HOME"); !data.empty()) {
    return trim_separators(std::move(data)) + L"/FluidEQ/engine";
  }
  if (std::wstring home = from_environment("HOME"); !home.empty()) {
    return trim_separators(std::move(home)) + L"/.local/share/FluidEQ/engine";
  }
  return std::wstring();
}

std::wstring config_dir() {
  const std::wstring root = engine_root();
  return root.empty() ? std::wstring() : root + L"/config";
}

std::wstring log_path() {
  const std::wstring root = engine_root();
  return root.empty() ? std::wstring() : root + L"/engine.log";
}

std::wstring parent_of(const std::wstring& path) {
  const size_t cut = path.find_last_of(L"\\/");
  if (cut == std::wstring::npos) return std::wstring();
  if (cut == 0) return path.size() > 1 ? std::wstring(L"/") : std::wstring();
  return path.substr(0, cut);
}

std::wstring deepest_existing(const std::wstring& path) {
  std::wstring at = trim_separators(path);
  while (!at.empty()) {
    if (is_directory(at)) return at;
    at = parent_of(at);
  }
  return std::wstring();
}

}  // namespace fluideq_engine
