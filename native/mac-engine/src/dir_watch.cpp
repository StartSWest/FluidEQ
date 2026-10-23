/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "dir_watch.h"

#include <fcntl.h>
#include <sys/event.h>
#include <unistd.h>

#include <cerrno>
#include <utility>

namespace fluideq_mac {

namespace {

/** The user event's identifier; any value unused by the other filters. */
constexpr uintptr_t kWakeIdent = 1;

}  // namespace

DirWatch::DirWatch(std::string directory, pid_t parent_pid,
                   std::function<void()> on_wake,
                   std::function<void()> on_parent_exit)
    : directory_(std::move(directory)),
      parent_pid_(parent_pid),
      on_wake_(std::move(on_wake)),
      on_parent_exit_(std::move(on_parent_exit)) {}

DirWatch::~DirWatch() { stop(); }

bool DirWatch::open_directory() noexcept {
  if (directory_fd_ >= 0) {
    ::close(directory_fd_);
    directory_fd_ = -1;
  }
  // O_EVTONLY: a descriptor for events only, which does not keep a volume
  // from being unmounted and does not count as the directory being "in use".
  directory_fd_ = ::open(directory_.c_str(), O_EVTONLY | O_CLOEXEC);
  if (directory_fd_ < 0) {
    return false;
  }
  struct kevent change {};
  EV_SET(&change, static_cast<uintptr_t>(directory_fd_), EVFILT_VNODE,
         EV_ADD | EV_CLEAR,
         NOTE_WRITE | NOTE_EXTEND | NOTE_ATTRIB | NOTE_DELETE | NOTE_RENAME |
             NOTE_REVOKE,
         0, nullptr);
  return ::kevent(queue_, &change, 1, nullptr, 0, nullptr) == 0;
}

bool DirWatch::start(std::string& error) {
  queue_ = ::kqueue();
  if (queue_ < 0) {
    error = "kqueue could not be created";
    return false;
  }
  struct kevent changes[2] {};
  EV_SET(&changes[0], kWakeIdent, EVFILT_USER, EV_ADD | EV_CLEAR, 0, 0,
         nullptr);
  int count = 1;
  if (parent_pid_ > 0) {
    // The parent's exit as an event rather than a question asked every
    // second: kqueue can watch a process that is not our child, which is the
    // one thing POSIX has no blocking call for.
    EV_SET(&changes[1], static_cast<uintptr_t>(parent_pid_), EVFILT_PROC,
           EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, nullptr);
    count = 2;
  }
  if (::kevent(queue_, changes, count, nullptr, 0, nullptr) != 0) {
    // ESRCH: the parent has already gone. There is nothing to engine for.
    error = errno == ESRCH ? "the parent process has already exited"
                           : "kqueue refused the watch";
    ::close(queue_);
    queue_ = -1;
    return false;
  }
  if (!open_directory()) {
    error = "the configuration directory could not be watched: " + directory_;
    ::close(queue_);
    queue_ = -1;
    return false;
  }
  thread_ = std::thread([this] { run(); });
  wake();
  return true;
}

void DirWatch::wake() noexcept {
  if (queue_ < 0) {
    return;
  }
  struct kevent trigger {};
  EV_SET(&trigger, kWakeIdent, EVFILT_USER, 0, NOTE_TRIGGER, 0, nullptr);
  ::kevent(queue_, &trigger, 1, nullptr, 0, nullptr);
}

void DirWatch::stop() noexcept {
  if (!thread_.joinable()) {
    return;
  }
  stopping_.store(true, std::memory_order_release);
  wake();
  if (thread_.get_id() != std::this_thread::get_id()) {
    thread_.join();
  } else {
    thread_.detach();
  }
  if (directory_fd_ >= 0) {
    ::close(directory_fd_);
    directory_fd_ = -1;
  }
  if (queue_ >= 0) {
    ::close(queue_);
    queue_ = -1;
  }
}

void DirWatch::run() {
  for (;;) {
    struct kevent events[8] {};
    const int count = ::kevent(queue_, nullptr, 0, events, 8, nullptr);
    if (stopping_.load(std::memory_order_acquire)) {
      return;
    }
    if (count < 0) {
      if (errno == EINTR) {
        continue;
      }
      return;
    }
    bool changed = false;
    for (int at = 0; at < count; ++at) {
      const struct kevent& event = events[at];
      if (event.filter == EVFILT_PROC && (event.fflags & NOTE_EXIT) != 0) {
        on_parent_exit_();
        return;
      }
      if (event.filter == EVFILT_VNODE &&
          (event.fflags & (NOTE_DELETE | NOTE_RENAME | NOTE_REVOKE)) != 0) {
        // The directory itself was replaced. Watch whatever is at the path
        // now; if nothing is, the next wake finds the configuration absent,
        // which is pass-through.
        open_directory();
      }
      changed = true;
    }
    if (changed) {
      on_wake_();
    }
  }
}

}  // namespace fluideq_mac
