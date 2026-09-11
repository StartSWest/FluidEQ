/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `OwnerLink` against a real named pipe served from this process.
 *
 * FluidEQ's end of the pipe closing is the only signal the engine gets that
 * the app has gone — End task in Task Manager runs none of the app's own code
 * — so these close a real server handle under the link and wait for the link
 * to say so. The waits are on the link's own event, never a sleep: the event
 * is what the watcher inside audiodg.exe waits on too.
 */

#include "../src/owner_link.h"

#include <cstdio>
#include <mutex>
#include <string>
#include <string_view>
#include <vector>

using fluideq_engine::OwnerLink;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

// What the link logged, from whichever thread it logged on.
std::mutex g_log_mutex;
std::vector<std::string> g_log;

void record(std::string_view message) noexcept {
  try {
    const std::lock_guard<std::mutex> guard(g_log_mutex);
    g_log.emplace_back(message);
  } catch (...) {
  }
}

bool logged(std::string_view needle) {
  const std::lock_guard<std::mutex> guard(g_log_mutex);
  for (const std::string& line : g_log) {
    if (line.find(needle) != std::string::npos) {
      return true;
    }
  }
  return false;
}

std::wstring pipe_name(const wchar_t* tag) {
  return std::wstring(L"\\\\.\\pipe\\fluideq-owner-link-test-") + tag + L"-" +
         std::to_wstring(GetCurrentProcessId());
}

/**
 * One server instance in the shape libuv makes them for Node's `net` server,
 * which is what FluidEQ serves the real pipe with: duplex and byte mode.
 * A client can open an instance before the server has accepted anything.
 */
HANDLE serve(const std::wstring& name, DWORD max_instances,
             DWORD flags = FILE_FLAG_OVERLAPPED) {
  return CreateNamedPipeW(name.c_str(), PIPE_ACCESS_DUPLEX | flags,
                          PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
                          max_instances, 4096, 4096, 0, nullptr);
}

void no_pipe_means_not_running() {
  std::printf("no pipe: FluidEQ is not running\n");
  const auto link = OwnerLink::acquire(pipe_name(L"none"), &record);
  CHECK(link != nullptr);
  CHECK(link && !link->present());
}

void pipe_closing_is_seen_and_reopening_is_found() {
  std::printf("the pipe closing is seen, and a new one is found on retry\n");
  const std::wstring name = pipe_name(L"live");
  HANDLE server = serve(name, PIPE_UNLIMITED_INSTANCES);
  CHECK(server != INVALID_HANDLE_VALUE);

  auto link = OwnerLink::acquire(name, &record);
  CHECK(link != nullptr);
  if (link == nullptr) {
    CloseHandle(server);
    return;
  }
  // Known before `acquire` returned, not a moment later.
  CHECK(link->present());

  const HANDLE changed = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  CHECK(changed != nullptr);
  link->subscribe(changed);

  // FluidEQ ends, however it ends: its end of the pipe closes.
  CloseHandle(server);
  CHECK(WaitForSingleObject(changed, INFINITE) == WAIT_OBJECT_0);
  CHECK(!link->present());
  CHECK(logged("FluidEQ is not running"));

  // FluidEQ starts again; the configuration change it makes as it does is
  // what asks the link to look.
  server = serve(name, PIPE_UNLIMITED_INSTANCES);
  CHECK(server != INVALID_HANDLE_VALUE);
  link->retry();
  CHECK(WaitForSingleObject(changed, INFINITE) == WAIT_OBJECT_0);
  CHECK(link->present());

  link->unsubscribe(changed);
  CloseHandle(changed);
  link.reset();
  CloseHandle(server);
}

void data_from_the_app_does_not_break_the_link() {
  std::printf("anything the app writes is read past\n");
  const std::wstring name = pipe_name(L"chatty");
  // Synchronous, so this test can write without an OVERLAPPED of its own.
  const HANDLE server = serve(name, PIPE_UNLIMITED_INSTANCES, 0);
  CHECK(server != INVALID_HANDLE_VALUE);

  auto link = OwnerLink::acquire(name, &record);
  CHECK(link && link->present());
  if (link == nullptr) {
    CloseHandle(server);
    return;
  }
  const HANDLE changed = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  link->subscribe(changed);

  // A byte-mode pipe with room in its buffer: the writes land without a
  // reader having to be waiting for them.
  const char payload[] = "not a protocol";
  DWORD written = 0;
  for (int at = 0; at < 8; ++at) {
    CHECK(WriteFile(server, payload, sizeof(payload), &written, nullptr) != 0);
  }
  // Still here after all of that — and still able to see the end: the only
  // change the link reports is the pipe closing, not the data.
  CloseHandle(server);
  CHECK(WaitForSingleObject(changed, INFINITE) == WAIT_OBJECT_0);
  CHECK(!link->present());

  link->unsubscribe(changed);
  CloseHandle(changed);
}

void a_busy_pipe_still_means_running() {
  std::printf("every instance taken: FluidEQ is running all the same\n");
  const std::wstring name = pipe_name(L"busy");
  const HANDLE server = serve(name, 1);
  CHECK(server != INVALID_HANDLE_VALUE);
  // Somebody else holds the one instance there is.
  const HANDLE other = CreateFileW(name.c_str(), GENERIC_READ, 0, nullptr,
                                   OPEN_EXISTING, 0, nullptr);
  CHECK(other != INVALID_HANDLE_VALUE);

  const auto link = OwnerLink::acquire(name, &record);
  CHECK(link && link->present());
  CHECK(logged("error 231"));  // ERROR_PIPE_BUSY, named in the log.

  CloseHandle(other);
  CloseHandle(server);
}

void one_link_per_process() {
  std::printf("one link per process, and a fresh one once it is let go\n");
  auto first = OwnerLink::acquire(pipe_name(L"shared"), &record);
  auto second = OwnerLink::acquire(pipe_name(L"ignored"), &record);
  CHECK(first != nullptr);
  CHECK(first == second);
  // Let go entirely — the thread joins and the handles close here — and the
  // next caller gets a working link of its own rather than a dead one.
  first.reset();
  second.reset();
  const std::wstring name = pipe_name(L"after");
  const HANDLE server = serve(name, PIPE_UNLIMITED_INSTANCES);
  const auto third = OwnerLink::acquire(name, &record);
  CHECK(third && third->present());
  CloseHandle(server);
}

}  // namespace

int main() {
  std::printf("fluideq engine owner link\n");
  no_pipe_means_not_running();
  pipe_closing_is_seen_and_reopening_is_found();
  data_from_the_app_does_not_break_the_link();
  a_busy_pipe_still_means_running();
  one_link_per_process();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}
