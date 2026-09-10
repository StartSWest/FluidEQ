/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "hosts.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <tlhelp32.h>

#include <cwchar>
#include <string>
#include <vector>

#include "fs.h"

namespace fluideq_engine::setup {

namespace {

/** An owning snapshot handle. */
class Snapshot {
 public:
  explicit Snapshot(HANDLE handle) : handle_(handle) {}
  ~Snapshot() {
    if (handle_ != INVALID_HANDLE_VALUE) {
      CloseHandle(handle_);
    }
  }
  Snapshot(const Snapshot&) = delete;
  Snapshot& operator=(const Snapshot&) = delete;
  HANDLE get() const noexcept { return handle_; }
  bool valid() const noexcept { return handle_ != INVALID_HANDLE_VALUE; }

 private:
  HANDLE handle_;
};

std::wstring lowered(const wchar_t* text) {
  std::wstring out(text);
  for (wchar_t& symbol : out) {
    symbol = static_cast<wchar_t>(towlower(symbol));
  }
  return out;
}

bool names_an_effect(const wchar_t* module_name) {
  const std::wstring name = lowered(module_name);
  return name.find(L"apo") != std::wstring::npos ||
         name.find(L"fluideq") != std::wstring::npos ||
         name.find(L"equalizer") != std::wstring::npos;
}

/**
 * Other users' processes — LOCAL SERVICE's audiodg.exe among them — open
 * for an administrator only with this privilege enabled; it is off by
 * default even in an elevated token.
 */
void enable_debug_privilege() {
  HANDLE token = nullptr;
  if (OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES,
                       &token) == 0) {
    return;
  }
  TOKEN_PRIVILEGES privileges = {};
  privileges.PrivilegeCount = 1;
  privileges.Privileges[0].Attributes = SE_PRIVILEGE_ENABLED;
  if (LookupPrivilegeValueW(nullptr, L"SeDebugPrivilege",
                            &privileges.Privileges[0].Luid) != 0) {
    AdjustTokenPrivileges(token, FALSE, &privileges, 0, nullptr, nullptr);
  }
  CloseHandle(token);
}

void modules_of(const PROCESSENTRY32W& process,
                std::vector<std::wstring>& lines) {
  // TH32CS_SNAPMODULE32 as well: nothing here is 32-bit, but a snapshot
  // that asks for both never fails with ERROR_PARTIAL_COPY on a process
  // whose module list is mid-change.
  const Snapshot modules(CreateToolhelp32Snapshot(
      TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, process.th32ProcessID));
  if (!modules.valid()) {
    return;
  }
  MODULEENTRY32W entry = {};
  entry.dwSize = sizeof(entry);
  if (Module32FirstW(modules.get(), &entry) == 0) {
    return;
  }
  do {
    if (names_an_effect(entry.szModule)) {
      lines.push_back(std::wstring(process.szExeFile) + L" (" +
                      std::to_wstring(process.th32ProcessID) + L"): " +
                      entry.szExePath);
    }
  } while (Module32NextW(modules.get(), &entry) != 0);
}

}  // namespace

bool list_effect_hosts(std::vector<std::wstring>& lines,
                       std::wstring& error) {
  enable_debug_privilege();
  const Snapshot processes(CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0));
  if (!processes.valid()) {
    error = L"could not list processes: " + describe_error(GetLastError());
    return false;
  }
  PROCESSENTRY32W process = {};
  process.dwSize = sizeof(process);
  if (Process32FirstW(processes.get(), &process) == 0) {
    error = L"could not read the process list: " +
            describe_error(GetLastError());
    return false;
  }
  do {
    modules_of(process, lines);
  } while (Process32NextW(processes.get(), &process) != 0);
  return true;
}

}  // namespace fluideq_engine::setup
