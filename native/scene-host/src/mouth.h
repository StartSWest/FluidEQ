/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <Windows.h>

#include <condition_variable>
#include <cstddef>
#include <cstdint>
#include <deque>
#include <iterator>
#include <mutex>
#include <thread>
#include <vector>

namespace feq::scene {

/**
 * stdout, written on a thread of its own, so a slow reader of it never holds
 * up the ear or the drawing. A message that must arrive is kept whatever
 * happens; one of a stream (a grid, a picture) is the newest of it, and when
 * main falls behind the oldest waiting ones are the ones dropped.
 */
class Mouth {
 public:
  /** Grids and pictures waiting for stdout past this are dropped, oldest first. */
  static constexpr std::size_t kMostWaiting = 8;

  Mouth() : thread_([this] { run(); }) {}
  ~Mouth() {
    {
      const std::lock_guard lock(mutex_);
      stopping_ = true;
    }
    ready_.notify_one();
    thread_.join();
  }
  Mouth(const Mouth&) = delete;
  Mouth& operator=(const Mouth&) = delete;

  /** From any thread. */
  void say(std::vector<std::uint8_t> message, bool droppable) {
    {
      const std::lock_guard lock(mutex_);
      waiting_.push_back({std::move(message), droppable});
      for (auto at = waiting_.begin();
           waiting_.size() > kMostWaiting && at != waiting_.end();) {
        at = at->droppable ? waiting_.erase(at) : std::next(at);
      }
    }
    ready_.notify_one();
  }

 private:
  struct Waiting {
    std::vector<std::uint8_t> bytes;
    bool droppable;
  };

  void run() {
    const HANDLE out = GetStdHandle(STD_OUTPUT_HANDLE);
    for (;;) {
      Waiting next;
      {
        std::unique_lock lock(mutex_);
        ready_.wait(lock, [this] { return stopping_ || !waiting_.empty(); });
        if (stopping_) {
          return;
        }
        next = std::move(waiting_.front());
        waiting_.pop_front();
      }
      std::size_t sent = 0;
      while (sent < next.bytes.size()) {
        DWORD wrote = 0;
        if (WriteFile(out, next.bytes.data() + sent,
                      static_cast<DWORD>(next.bytes.size() - sent), &wrote,
                      nullptr) == FALSE) {
          // Main has gone; stdin closing ends the program.
          return;
        }
        sent += wrote;
      }
    }
  }

  std::mutex mutex_;
  std::condition_variable ready_;
  std::deque<Waiting> waiting_;
  bool stopping_ = false;
  std::thread thread_;
};

}  // namespace feq::scene
