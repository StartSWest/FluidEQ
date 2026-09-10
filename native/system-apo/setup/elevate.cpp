/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "elevate.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <shellapi.h>

#include <string>
#include <vector>

#include "fs.h"

namespace fluideq_engine::setup {

namespace {

/**
 * One argument quoted the way `CommandLineToArgvW` will take it apart again.
 *
 * The arguments this program passes on are endpoint ids and flags, none of
 * which needs quoting today. It is done properly anyway because the one that
 * eventually does need it will be a path, and a path that loses a backslash
 * between the parent and the elevated child is a helper that silently
 * operates on the wrong thing.
 */
std::wstring quote(const std::wstring& argument) {
  if (!argument.empty() &&
      argument.find_first_of(L" \t\n\v\"") == std::wstring::npos) {
    return argument;
  }
  std::wstring quoted = L"\"";
  for (size_t at = 0; at < argument.size(); ++at) {
    size_t backslashes = 0;
    while (at < argument.size() && argument[at] == L'\\') {
      ++at;
      ++backslashes;
    }
    if (at == argument.size()) {
      quoted.append(backslashes * 2, L'\\');
      break;
    }
    if (argument[at] == L'"') {
      quoted.append(backslashes * 2 + 1, L'\\');
    } else {
      quoted.append(backslashes, L'\\');
    }
    quoted += argument[at];
  }
  quoted += L'"';
  return quoted;
}

std::wstring module_path() {
  std::wstring path(MAX_PATH, L'\0');
  while (true) {
    const DWORD written = GetModuleFileNameW(
        nullptr, path.data(), static_cast<DWORD>(path.size()));
    if (written == 0) {
      return std::wstring();
    }
    if (written < path.size()) {
      path.resize(written);
      return path;
    }
    path.resize(path.size() * 2);
  }
}

}  // namespace

bool is_elevated() {
  HANDLE token = nullptr;
  if (OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token) == 0) {
    return false;
  }
  TOKEN_ELEVATION elevation = {};
  DWORD size = 0;
  const BOOL asked = GetTokenInformation(token, TokenElevation, &elevation,
                                         sizeof(elevation), &size);
  CloseHandle(token);
  return asked != 0 && elevation.TokenIsElevated != 0;
}

int relaunch_elevated(const std::vector<std::wstring>& arguments,
                      std::wstring& error) {
  const std::wstring exe = module_path();
  if (exe.empty()) {
    error = L"could not find this program's own path";
    return 3;
  }
  std::wstring line;
  for (const std::wstring& argument : arguments) {
    if (!line.empty()) {
      line += L' ';
    }
    line += quote(argument);
  }

  SHELLEXECUTEINFOW request = {};
  request.cbSize = sizeof(request);
  // NOCLOSEPROCESS is what leaves a handle to wait on; NOASYNC keeps the
  // call from returning before the shell has finished with the request, which
  // it otherwise may when the caller has no message loop — this program has
  // none.
  request.fMask = SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC;
  request.lpVerb = L"runas";
  request.lpFile = exe.c_str();
  request.lpParameters = line.empty() ? nullptr : line.c_str();
  // Hidden rather than SW_SHOWNORMAL. The child is a windowed-subsystem
  // program now (it borrows the caller's console instead of owning one), so
  // it has no window of its own to hide — but `nShow` is also what Windows
  // hands the child as its startup show state, and SW_HIDE is what keeps any
  // window it or its CRT might raise off the screen during a consent prompt.
  // The elevated child writes its answer to a file for this process to read
  // back; nothing about it is meant to be looked at.
  request.nShow = SW_HIDE;

  if (ShellExecuteExW(&request) == 0) {
    const DWORD failed = GetLastError();
    if (failed == ERROR_CANCELLED) {
      // The user said no. That is an answer, not a fault, and it gets its own
      // exit code so the app can tell it from a command that broke.
      return 2;
    }
    error = L"could not ask for administrator rights: " +
            describe_error(failed);
    return 3;
  }
  if (request.hProcess == nullptr) {
    error = L"the elevated helper did not start";
    return 3;
  }
  // INFINITE, and no deadline: the wait ends when the child ends. A timeout
  // here would be a guess at how long restarting the audio service takes on
  // somebody else's machine.
  WaitForSingleObject(request.hProcess, INFINITE);
  DWORD code = 3;
  if (GetExitCodeProcess(request.hProcess, &code) == 0) {
    code = 3;
  }
  CloseHandle(request.hProcess);
  return static_cast<int>(code);
}

}  // namespace fluideq_engine::setup
