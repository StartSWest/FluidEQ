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
#include <cerrno>
#include <csignal>
#include <unistd.h>
#if defined(__linux__)
#include <poll.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#elif defined(__APPLE__)
#include <sys/event.h>
#endif
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

/**
 * Blocks until the process `parent_pid` ends. False when that cannot be
 * waited on at all; true once it has ended, or when it was already gone.
 *
 * It was a loop asking `kill(pid, 0)` once a second, on the argument that
 * POSIX has no way to block on a process that is not our child. Both kernels
 * this runs on do have one: Linux hands out a descriptor for a process that
 * becomes readable when it exits (`pidfd_open`, 5.3 and later), and macOS
 * reports the exit through kqueue (`EVFILT_PROC` with `NOTE_EXIT`). Either
 * way the wait returns the moment the parent is gone, as Windows' handle
 * wait always did, and nothing wakes in between.
 */
static bool wait_for_exit(pid_t parent_pid) {
#if defined(__linux__)
#if defined(SYS_pidfd_open)
  const long descriptor = ::syscall(SYS_pidfd_open, parent_pid, 0);
  if (descriptor < 0) {
    // Already gone is an answer; a kernel without the call is not.
    return errno == ESRCH;
  }
  pollfd watched{static_cast<int>(descriptor), POLLIN, 0};
  while (::poll(&watched, 1, -1) < 0 && errno == EINTR) {
  }
  ::close(static_cast<int>(descriptor));
  return true;
#else
  (void)parent_pid;
  return false;
#endif
#elif defined(__APPLE__)
  const int queue = ::kqueue();
  if (queue < 0) {
    return false;
  }
  struct kevent change;
  EV_SET(&change, static_cast<uintptr_t>(parent_pid), EVFILT_PROC,
         EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, nullptr);
  if (::kevent(queue, &change, 1, nullptr, 0, nullptr) < 0) {
    const bool is_gone = errno == ESRCH;
    ::close(queue);
    return is_gone;
  }
  struct kevent fired;
  while (::kevent(queue, nullptr, 0, &fired, 1, nullptr) < 0 &&
         errno == EINTR) {
  }
  ::close(queue);
  return true;
#else
  (void)parent_pid;
  return false;
#endif
}

void feq_watch_parent(uint32_t parent_pid, void (*on_exit)()) {
  if (parent_pid == 0) {
    return;
  }
  g_on_exit = on_exit;
#if defined(__linux__)
  /**
   * The kernel's own signal as well, for a kernel older than `pidfd_open`.
   *
   * `PR_SET_PDEATHSIG` has the kernel signal this process when its parent
   * dies. It is not inherited across `exec` and it fires on the death of the
   * thread that forked us rather than the process, so on its own it can fire
   * early and never late; the wait below is the exact answer where there is
   * one.
   */
  ::prctl(PR_SET_PDEATHSIG, SIGTERM);
#endif
  std::thread([parent_pid] {
    // Where nothing can be waited on, the pipes are the net that is left:
    // stdin reaching EOF ends the read loop, and a write to a stdout nobody
    // reads fails rather than blocks once the reader is gone.
    if (wait_for_exit(static_cast<pid_t>(parent_pid))) {
      leave();
    }
  }).detach();
}

#endif
