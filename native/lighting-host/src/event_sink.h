/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <mutex>
#include <string>

namespace fluideq_lighting {

// Where every event line goes: the pipe the app gave as standard output.
//
// Device watchers call this from thread-pool threads, several at once when a
// dock with three devices is plugged in; one lock keeps each line whole. A
// write that fails means the app has gone, and the reader thread notices the
// same thing on its side and ends the process — there is nobody to tell.
class EventSink final {
 public:
  EventSink() : out_(GetStdHandle(STD_OUTPUT_HANDLE)) {}

  void write(const std::string& line) {
    const std::scoped_lock lock(mutex_);
    if (out_ == nullptr || out_ == INVALID_HANDLE_VALUE) {
      return;
    }
    const char* at = line.data();
    auto remaining = static_cast<DWORD>(line.size());
    while (remaining > 0) {
      DWORD written = 0;
      if (!WriteFile(out_, at, remaining, &written, nullptr) || written == 0) {
        return;
      }
      at += written;
      remaining -= written;
    }
  }

 private:
  HANDLE out_;
  std::mutex mutex_;
};

}  // namespace fluideq_lighting
