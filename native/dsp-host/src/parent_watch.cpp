/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "parent_watch.h"

#include <cstdlib>
#include <thread>

#ifdef _WIN32
#include <windows.h>
#else
#include <csignal>
#include <unistd.h>
#if defined(__linux__)
#include <sys/prctl.h>
#endif
#include <chrono>
#endif

namespace {

void (*g_on_exit)() = nullptr;

void leave() {
  if (g_on_exit != nullptr) {
    g_on_exit();
  }
  /**
   * `_exit` rather than `exit` or a return from main.
   *
   * The other two run static destructors and flush stdio, and both can block:
   * stdout is a pipe whose reader has just died, and the whole reason this
   * path is running is that nobody is draining it. A host that hangs while
   * tidying up is the process this exists to prevent. The endpoint is already
   * released by `on_exit`, which is the only cleanup that has to happen.
   */
  std::_Exit(1);
}

}  // namespace

#ifdef _WIN32

void feq_watch_parent(uint32_t parent_pid, void (*on_exit)()) {
  if (parent_pid == 0) {
    return;
  }
  HANDLE parent = ::OpenProcess(SYNCHRONIZE, FALSE,
                                static_cast<DWORD>(parent_pid));
  if (parent == nullptr) {
    // Already gone, or not ours to watch. The first is the interesting one:
    // starting up into a parent that has just died should not leave a host
    // running for the life of the machine.
    if (::GetLastError() == ERROR_INVALID_PARAMETER) {
      g_on_exit = on_exit;
      leave();
    }
    return;
  }
  g_on_exit = on_exit;
  std::thread([parent] {
    // Blocking, with no timeout and no interval: the object is signalled the
    // moment the process ends, however it ended.
    ::WaitForSingleObject(parent, INFINITE);
    ::CloseHandle(parent);
    leave();
  }).detach();
}

#else

void feq_watch_parent(uint32_t parent_pid, void (*on_exit)()) {
  if (parent_pid == 0) {
    return;
  }
  g_on_exit = on_exit;
#if defined(__linux__)
  /**
   * Linux can do this without a thread at all.
   *
   * `PR_SET_PDEATHSIG` has the kernel signal this process when its parent
   * dies. It is not inherited across `exec` and it fires on the death of the
   * thread that forked us rather than the process, so the poll below stays as
   * the backstop rather than being replaced by it.
   */
  ::prctl(PR_SET_PDEATHSIG, SIGTERM);
#endif
  std::thread([parent_pid] {
    for (;;) {
      // A second is not a race being papered over — it is how often a dead
      // parent needs noticing, and there is no POSIX way to block on another
      // process that is not our child.
      std::this_thread::sleep_for(std::chrono::seconds(1));
      if (::kill(static_cast<pid_t>(parent_pid), 0) != 0) {
        leave();
      }
    }
  }).detach();
}

#endif
