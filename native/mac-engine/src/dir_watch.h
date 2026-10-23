/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The engine's one control thread, woken by the things that change the sound.
 *
 * The Windows effect waits on `FindFirstChangeNotification` and a stop event,
 * and nothing else. This is the same shape on kqueue: the configuration
 * directory changing (the app writes every file by renaming a finished copy
 * into place, which is a write to the directory), the parent process exiting,
 * and a user event any thread can raise — the output device changing, which
 * Core Audio reports on a thread of its own where nothing heavy may run.
 *
 * No timeout, no poll, no sleep: a Mac whose configuration does not change
 * pays nothing for having the engine running.
 */
#ifndef FLUIDEQ_MAC_ENGINE_DIR_WATCH_H
#define FLUIDEQ_MAC_ENGINE_DIR_WATCH_H

#include <sys/types.h>

#include <atomic>
#include <functional>
#include <string>
#include <thread>

namespace fluideq_mac {

class DirWatch {
 public:
  /**
   * `on_wake` runs on the watch thread for every change and every `wake()`;
   * `on_parent_exit` once, when `parent_pid` exits.
   */
  DirWatch(std::string directory, pid_t parent_pid,
           std::function<void()> on_wake,
           std::function<void()> on_parent_exit);
  ~DirWatch();
  DirWatch(const DirWatch&) = delete;
  DirWatch& operator=(const DirWatch&) = delete;

  /** Opens the queue and starts the thread; the first wake is immediate. */
  bool start(std::string& error);

  /** Any thread, including a Core Audio notification. Never blocks. */
  void wake() noexcept;

  /** Any thread but the watch thread. Returns once the thread has ended. */
  void stop() noexcept;

 private:
  void run();
  bool open_directory() noexcept;

  std::string directory_;
  pid_t parent_pid_;
  std::function<void()> on_wake_;
  std::function<void()> on_parent_exit_;
  int queue_ = -1;
  int directory_fd_ = -1;
  std::atomic<bool> stopping_{false};
  std::thread thread_;
};

}  // namespace fluideq_mac

#endif  // FLUIDEQ_MAC_ENGINE_DIR_WATCH_H
