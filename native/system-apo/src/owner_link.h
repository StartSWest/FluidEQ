/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether FluidEQ itself is running, as seen from inside audiodg.exe.
 *
 * The effect keeps applying whatever it last read, so once FluidEQ was gone
 * the EQ stayed on every output: a Quit resets the configuration on the way
 * out (`engineQuitReset.ts`), but End task in Task Manager, a crash or a
 * power-cut session never reach that code. So the app keeps a named pipe open
 * for as long as it runs and this holds a connection to it. Windows closes the
 * app's end the instant its process ends, however it ends, and the read
 * pending here completes with a broken pipe — that completion is the whole
 * signal. No heartbeat, no timeout, nothing polled.
 *
 * One per process, shared by every watcher: one connection rather than one
 * per locked endpoint, so a burst of endpoints locking at once cannot run the
 * app's server out of free pipe instances.
 */
#ifndef FLUIDEQ_ENGINE_OWNER_LINK_H
#define FLUIDEQ_ENGINE_OWNER_LINK_H

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <atomic>
#include <memory>
#include <mutex>
#include <string>
#include <string_view>
#include <vector>

namespace fluideq_engine {

/** Where the link says what it saw; called on changes only. Never throws. */
using OwnerLog = void (*)(std::string_view message) noexcept;

class OwnerLink {
 public:
  /**
   * The process's link, created on first use and gone with its last holder.
   *
   * Tries the pipe once before returning, on the calling thread, so the first
   * graph a watcher builds already knows whether FluidEQ is there — audio
   * must not start processed and drop to pass-through a moment later, or the
   * other way round. Null only when the link itself cannot run (no event, no
   * thread); callers treat that as "present", because an engine that cannot
   * tell must not silence an EQ it has no evidence against.
   *
   * `pipe_name` is honoured by whichever call creates the link; while one is
   * alive, later calls share it whatever name they pass.
   */
  static std::shared_ptr<OwnerLink> acquire(const std::wstring& pipe_name,
                                            OwnerLog log);

  ~OwnerLink();
  OwnerLink(const OwnerLink&) = delete;
  OwnerLink& operator=(const OwnerLink&) = delete;

  /** Any thread. */
  bool present() const noexcept {
    return present_.load(std::memory_order_acquire);
  }

  /**
   * `event` is set every time `present()` changes, until `unsubscribe`.
   * The caller owns the event and must unsubscribe before closing it.
   */
  void subscribe(HANDLE event);
  void unsubscribe(HANDLE event) noexcept;

  /**
   * Try the pipe again if it is not connected. Any thread; returns at once.
   *
   * Watchers call this on every change in the configuration directory: an
   * app that has just started writes there (its `fluideq-owner.txt`), which
   * is the only moment a missing pipe can have become a present one.
   */
  void retry() noexcept;

 private:
  OwnerLink(std::wstring pipe_name, OwnerLog log);
  bool start();
  static unsigned __stdcall thread_entry(void* self);
  void run();
  /** Monitor thread (or `acquire`, before the thread exists). */
  void connect();
  void arm_read();
  void on_read_complete();
  void disconnect() noexcept;
  void set_present(bool present);

  const std::wstring pipe_name_;
  const OwnerLog log_;

  std::atomic<bool> present_{false};

  std::mutex subscribers_mutex_;
  std::vector<HANDLE> subscribers_;

  // Monitor-thread state (plus `acquire`, which runs before the thread).
  HANDLE pipe_ = INVALID_HANDLE_VALUE;
  OVERLAPPED overlapped_ = {};
  char byte_ = 0;
  // Whether `overlapped_` belongs to a read the system has not finished with.
  // Waiting on one that was refused outright would wait on an event nothing
  // will ever set.
  bool read_pending_ = false;
  // The last reason the pipe could not be opened, so a failure that repeats
  // on every configuration change is logged once rather than every time.
  DWORD last_open_error_ = 0;

  HANDLE stop_event_ = nullptr;
  HANDLE retry_event_ = nullptr;
  HANDLE read_event_ = nullptr;
  HANDLE thread_ = nullptr;

  static std::mutex instance_mutex_;
  static std::weak_ptr<OwnerLink> instance_;
};

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_OWNER_LINK_H
