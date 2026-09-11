/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "owner_link.h"

#include <process.h>

#include <algorithm>
#include <string>

namespace fluideq_engine {

std::mutex OwnerLink::instance_mutex_;
std::weak_ptr<OwnerLink> OwnerLink::instance_;

std::shared_ptr<OwnerLink> OwnerLink::acquire(const std::wstring& pipe_name,
                                              OwnerLog log) {
  try {
    const std::lock_guard<std::mutex> guard(instance_mutex_);
    if (std::shared_ptr<OwnerLink> existing = instance_.lock()) {
      return existing;
    }
    // `new` rather than `make_shared`: the constructor is private, so that
    // nothing but this function can make a second link in the process.
    std::shared_ptr<OwnerLink> link(new OwnerLink(pipe_name, log));
    if (!link->start()) {
      return nullptr;
    }
    instance_ = link;
    return link;
  } catch (...) {
    // Out of memory making a string or a vector. The caller runs without a
    // link, which it treats as FluidEQ being present.
    return nullptr;
  }
}

OwnerLink::OwnerLink(std::wstring pipe_name, OwnerLog log)
    : pipe_name_(std::move(pipe_name)), log_(log) {}

OwnerLink::~OwnerLink() {
  if (thread_ != nullptr) {
    SetEvent(stop_event_);
    WaitForSingleObject(thread_, INFINITE);
    CloseHandle(thread_);
    thread_ = nullptr;
  }
  // The thread disconnects on its way out; this covers a link whose thread
  // never started.
  disconnect();
  for (HANDLE* event : {&stop_event_, &retry_event_, &read_event_}) {
    if (*event != nullptr) {
      CloseHandle(*event);
      *event = nullptr;
    }
  }
}

bool OwnerLink::start() {
  stop_event_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  retry_event_ = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  // Manual-reset, as an overlapped read's event has to be: `ReadFile` clears
  // it when the read is queued and the system sets it when the read ends.
  read_event_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (stop_event_ == nullptr || retry_event_ == nullptr ||
      read_event_ == nullptr) {
    return false;  // The destructor closes whichever were made.
  }

  // Before the thread, on the caller's: see `acquire`.
  connect();

  unsigned id = 0;
  // `_beginthreadex` for the same reason the watcher uses it: this thread
  // builds strings, and the CRT wants to know about a thread that does.
  const uintptr_t handle =
      _beginthreadex(nullptr, 0, &OwnerLink::thread_entry, this, 0, &id);
  if (handle == 0) {
    disconnect();
    return false;
  }
  thread_ = reinterpret_cast<HANDLE>(handle);
  // Below normal inside audiodg.exe, like the watcher: all this thread ever
  // does is wake up when FluidEQ comes or goes.
  SetThreadPriority(thread_, THREAD_PRIORITY_BELOW_NORMAL);
  return true;
}

unsigned __stdcall OwnerLink::thread_entry(void* self) {
  auto* link = static_cast<OwnerLink*>(self);
  try {
    link->run();
  } catch (...) {
    // Nothing may leave a thread inside audiodg.exe. With the link no longer
    // watching, it cannot say FluidEQ has gone, so it says it is here: an
    // engine that cannot tell must not silence an EQ it has no evidence
    // against. No notification — watchers read this on their next reload.
    link->present_.store(true, std::memory_order_release);
  }
  return 0;
}

void OwnerLink::run() {
  for (;;) {
    HANDLE handles[3] = {stop_event_, retry_event_, read_event_};
    const DWORD count = pipe_ != INVALID_HANDLE_VALUE ? 3 : 2;
    const DWORD woke = WaitForMultipleObjects(count, handles, FALSE, INFINITE);
    if (woke == WAIT_OBJECT_0) {
      disconnect();
      return;
    }
    if (woke == WAIT_OBJECT_0 + 1) {
      if (pipe_ == INVALID_HANDLE_VALUE) {
        connect();
      }
      continue;
    }
    if (woke == WAIT_OBJECT_0 + 2) {
      on_read_complete();
      continue;
    }
    // A wait that cannot be made again. Same answer as the thread dying.
    disconnect();
    set_present(true);
    return;
  }
}

void OwnerLink::connect() {
  const HANDLE pipe =
      CreateFileW(pipe_name_.c_str(), GENERIC_READ, 0, nullptr, OPEN_EXISTING,
                  FILE_FLAG_OVERLAPPED, nullptr);
  if (pipe == INVALID_HANDLE_VALUE) {
    const DWORD error = GetLastError();
    // Not found is FluidEQ not running, which is the ordinary answer and says
    // nothing worth a log line. The other two both mean the pipe is there, so
    // FluidEQ is: busy is every instance of it taken for the moment, denied is
    // this process not being allowed to open it. Neither leaves a handle to
    // wait on, so FluidEQ ending cannot be seen from here until a later
    // configuration change connects — and until then the EQ stays on, which
    // is what it did before this link existed.
    const bool running =
        error == ERROR_PIPE_BUSY || error == ERROR_ACCESS_DENIED;
    if (error != last_open_error_ && error != ERROR_FILE_NOT_FOUND &&
        log_ != nullptr) {
      log_("FluidEQ's pipe could not be opened (error " +
           std::to_string(error) + "); " +
           (running ? "treating FluidEQ as running"
                    : "treating FluidEQ as not running"));
    }
    last_open_error_ = error;
    set_present(running);
    return;
  }
  last_open_error_ = 0;
  pipe_ = pipe;
  arm_read();
}

void OwnerLink::arm_read() {
  // FluidEQ never writes. Whatever does arrive is read and dropped, and the
  // read is armed again; what matters is only that one is always pending.
  overlapped_ = OVERLAPPED{};
  overlapped_.hEvent = read_event_;
  if (ReadFile(pipe_, &byte_, 1, nullptr, &overlapped_) != 0 ||
      GetLastError() == ERROR_IO_PENDING) {
    // Completed at once or queued: either way the event is set when it is
    // done, and `on_read_complete` collects it.
    read_pending_ = true;
    set_present(true);
    return;
  }
  // Refused outright: the pipe broke between opening it and reading it.
  disconnect();
  set_present(false);
}

void OwnerLink::on_read_complete() {
  DWORD transferred = 0;
  const BOOL read = GetOverlappedResult(pipe_, &overlapped_, &transferred, FALSE);
  const DWORD error = read != 0 ? ERROR_SUCCESS : GetLastError();
  if (error == ERROR_IO_INCOMPLETE) {
    return;  // Not finished after all; the event will say when it is.
  }
  read_pending_ = false;
  if (read != 0) {
    arm_read();
    return;
  }
  // `ERROR_BROKEN_PIPE`, normally — FluidEQ's end closed because its process
  // ended — but every failure means the same thing here.
  disconnect();
  set_present(false);
}

void OwnerLink::disconnect() noexcept {
  if (pipe_ == INVALID_HANDLE_VALUE) {
    return;
  }
  if (read_pending_) {
    // The read writes into `overlapped_` and `byte_` until it is over, so it
    // has to be over before either can be reused: cancelled, and then waited
    // for, which is immediate once it has been cancelled.
    CancelIoEx(pipe_, &overlapped_);
    DWORD transferred = 0;
    GetOverlappedResult(pipe_, &overlapped_, &transferred, TRUE);
    read_pending_ = false;
  }
  CloseHandle(pipe_);
  pipe_ = INVALID_HANDLE_VALUE;
}

void OwnerLink::set_present(bool present) {
  if (present_.exchange(present, std::memory_order_acq_rel) == present) {
    return;
  }
  if (log_ != nullptr) {
    log_(present ? "FluidEQ is running: holding its pipe"
                 : "FluidEQ is not running: its pipe is closed");
  }
  const std::lock_guard<std::mutex> guard(subscribers_mutex_);
  for (const HANDLE event : subscribers_) {
    SetEvent(event);
  }
}

void OwnerLink::subscribe(HANDLE event) {
  const std::lock_guard<std::mutex> guard(subscribers_mutex_);
  subscribers_.push_back(event);
}

void OwnerLink::unsubscribe(HANDLE event) noexcept {
  try {
    const std::lock_guard<std::mutex> guard(subscribers_mutex_);
    subscribers_.erase(
        std::remove(subscribers_.begin(), subscribers_.end(), event),
        subscribers_.end());
  } catch (...) {
    // `std::mutex::lock` can only throw for a mutex that is already broken.
  }
}

void OwnerLink::retry() noexcept {
  if (retry_event_ != nullptr) {
    SetEvent(retry_event_);
  }
}

}  // namespace fluideq_engine
