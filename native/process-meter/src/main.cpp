/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/*
 * The Processes list's measuring tape: what each of FluidEQ's processes costs,
 * in the terms Task Manager uses.
 *
 * Electron reports a working set, and a working set counts every shared page
 * — Chromium's own DLLs, mapped into every one of its processes — once per
 * process that touches it. Summed over nine processes that overstated the
 * app's memory by 800 MB of a measured 2.8 GB: the total the list exists to
 * give was forty percent fiction. The private working set is what each
 * process alone holds in RAM, it sums without counting anything twice, and it
 * is what Task Manager's Memory column shows. Node cannot ask for it, so this
 * does.
 *
 * CPU comes from the same call for every row — kernel plus user time from
 * `GetProcessTimes` — so the column adds up across processes Electron measures,
 * processes it does not (the DSP host, the lighting helper) and Windows' own
 * audio service, instead of mixing three clocks.
 *
 * It also answers which programs a process started. The app starts helpers of
 * its own — one desktop visualizer helper per monitor, the audio sharing
 * capture — that nothing in Electron knows about, and a list that only shows
 * the processes somebody remembered to register misses the next one added.
 *
 * The protocol is one line each way, and nothing happens between them:
 *
 *   in:  pid pid c<pid> ...\n        c<pid>: also every process <pid> started
 *   out: pid private working cpu name;...\n
 *
 * `private` and `working` are bytes, `cpu` is 100 ns ticks since the process
 * started, `name` is the executable's file name and runs to the end of the
 * entry; any figure that could not be read is `-`. Each process appears once.
 * The process exits when its input closes, which is also what happens when
 * FluidEQ ends however it ends — no parent watching, no timer.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <psapi.h>
#include <tlhelp32.h>

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <set>
#include <string>
#include <vector>

namespace {

uint64_t ticks(const FILETIME& time) {
  return (static_cast<uint64_t>(time.dwHighDateTime) << 32) | time.dwLowDateTime;
}

void append_figure(std::string* line, bool known, uint64_t value) {
  line->push_back(' ');
  if (known) {
    line->append(std::to_string(value));
  } else {
    line->push_back('-');
  }
}

/*
 * A file name as UTF-8, safe inside the reply: the entry and line separators
 * are the only characters it could otherwise break the protocol with, and a
 * file name may legally contain a semicolon.
 */
std::string reply_name(const wchar_t* name) {
  if (name == nullptr || name[0] == L'\0') {
    return "-";
  }
  const int size = WideCharToMultiByte(CP_UTF8, 0, name, -1, nullptr, 0, nullptr, nullptr);
  if (size <= 1) {
    return "-";
  }
  std::string text(static_cast<size_t>(size), '\0');
  WideCharToMultiByte(CP_UTF8, 0, name, -1, text.data(), size, nullptr, nullptr);
  text.resize(static_cast<size_t>(size - 1));
  for (char& character : text) {
    if (character == ';' || character == '\n' || character == '\r') {
      character = '_';
    }
  }
  return text;
}

std::string executable_name(HANDLE process) {
  wchar_t path[MAX_PATH]{};
  DWORD length = MAX_PATH;
  if (QueryFullProcessImageNameW(process, 0, path, &length) == 0 || length == 0) {
    return "-";
  }
  const wchar_t* name = path;
  for (const wchar_t* at = path; *at != L'\0'; ++at) {
    if (*at == L'\\' || *at == L'/') {
      name = at + 1;
    }
  }
  return reply_name(name);
}

void measure(unsigned long pid, std::string* line) {
  line->append(std::to_string(pid));
  const HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
  if (process == nullptr) {
    line->append(" - - - -");
    return;
  }

  // The private working set needs the EX2 counters, which Windows 10 before
  // 21H2 does not fill in; there the call fails and the figure is a dash
  // rather than a working set passed off as private.
  PROCESS_MEMORY_COUNTERS_EX2 extended{};
  extended.cb = sizeof(extended);
  const bool has_private =
      GetProcessMemoryInfo(process, reinterpret_cast<PPROCESS_MEMORY_COUNTERS>(&extended),
                           sizeof(extended)) != 0;
  PROCESS_MEMORY_COUNTERS basic{};
  basic.cb = sizeof(basic);
  const bool has_working = has_private ||
      GetProcessMemoryInfo(process, &basic, sizeof(basic)) != 0;
  append_figure(line, has_private, static_cast<uint64_t>(extended.PrivateWorkingSetSize));
  append_figure(line, has_working,
                static_cast<uint64_t>(has_private ? extended.WorkingSetSize : basic.WorkingSetSize));

  FILETIME created{}, exited{}, kernel{}, user{};
  const bool has_cpu = GetProcessTimes(process, &created, &exited, &kernel, &user) != 0;
  append_figure(line, has_cpu, has_cpu ? ticks(kernel) + ticks(user) : 0);
  line->push_back(' ');
  line->append(executable_name(process));
  CloseHandle(process);
}

bool creation_time(unsigned long pid, uint64_t* created_at) {
  const HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
  if (process == nullptr) {
    return false;
  }
  FILETIME created{}, exited{}, kernel{}, user{};
  const bool known = GetProcessTimes(process, &created, &exited, &kernel, &user) != 0;
  CloseHandle(process);
  *created_at = ticks(created);
  return known;
}

/*
 * The processes `parent` started.
 *
 * A parent id alone is not enough: Windows reuses process ids, and a process
 * whose own parent died long ago still names that id — which may by now be
 * FluidEQ's. Only a process created after the parent itself can be its child.
 */
std::vector<unsigned long> children_of(unsigned long parent) {
  std::vector<unsigned long> children;
  uint64_t parent_created = 0;
  if (!creation_time(parent, &parent_created)) {
    return children;
  }
  const HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snapshot == INVALID_HANDLE_VALUE) {
    return children;
  }
  PROCESSENTRY32W entry{};
  entry.dwSize = sizeof(entry);
  for (BOOL more = Process32FirstW(snapshot, &entry); more != FALSE;
       more = Process32NextW(snapshot, &entry)) {
    uint64_t child_created = 0;
    if (entry.th32ParentProcessID == parent && entry.th32ProcessID != parent &&
        creation_time(entry.th32ProcessID, &child_created) &&
        child_created >= parent_created) {
      children.push_back(entry.th32ProcessID);
    }
  }
  CloseHandle(snapshot);
  return children;
}

}  // namespace

int main() {
  std::string request;
  std::string reply;
  int character = 0;
  while ((character = std::fgetc(stdin)) != EOF) {
    if (character != '\n') {
      if (request.size() < 4096) {
        request.push_back(static_cast<char>(character));
      }
      continue;
    }
    std::vector<unsigned long> pids;
    const char* cursor = request.c_str();
    while (*cursor != '\0') {
      const bool children = *cursor == 'c';
      const char* digits = children ? cursor + 1 : cursor;
      char* end = nullptr;
      const unsigned long pid = std::strtoul(digits, &end, 10);
      if (end == digits) {
        ++cursor;
        continue;
      }
      if (children) {
        const std::vector<unsigned long> found = children_of(pid);
        pids.insert(pids.end(), found.begin(), found.end());
      } else {
        pids.push_back(pid);
      }
      cursor = end;
    }
    reply.clear();
    std::set<unsigned long> answered;
    for (const unsigned long pid : pids) {
      if (!answered.insert(pid).second) {
        continue;
      }
      if (!reply.empty()) {
        reply.push_back(';');
      }
      measure(pid, &reply);
    }
    reply.push_back('\n');
    std::fwrite(reply.data(), 1, reply.size(), stdout);
    std::fflush(stdout);
    request.clear();
  }
  return 0;
}
