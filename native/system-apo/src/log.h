/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The one file this effect writes, and the only way to see what it did.
 *
 * There is no other channel. The effect runs inside audiodg.exe, has no
 * window, no pipe to the app and no way to fail loudly: a configuration it
 * could not read and a configuration that asked for nothing sound exactly the
 * same, which is silence with the audio unchanged. Every line here exists to
 * tell those two apart afterwards.
 *
 * NEVER from the audio thread. `write` opens a file and takes a lock; it is
 * called from the watcher thread and from `LockForProcess`, both of which are
 * allowed to block, and from nowhere else.
 */
#ifndef FLUIDEQ_ENGINE_LOG_H
#define FLUIDEQ_ENGINE_LOG_H

#include <mutex>
#include <string>
#include <string_view>

namespace fluideq_engine {

class Log {
 public:
  /**
   * `endpoint_guid` is stamped on every line: one audiodg.exe hosts an
   * instance of this effect per output it is attached to, and all of them
   * append to the same file.
   */
  explicit Log(const std::wstring& endpoint_guid);

  Log(const Log&) = delete;
  Log& operator=(const Log&) = delete;

  /** One line, timestamped and tagged. Never throws, never fails loudly. */
  void write(std::string_view message) noexcept;

 private:
  std::mutex mutex_;
  std::wstring path_;
  std::string tag_;
};

/**
 * UTF-8 for the log, with a printable stand-in for anything unconvertible.
 *
 * Endpoint friendly names and impulse-response paths both reach the log from
 * outside this code, and a name in a script the machine's code page cannot
 * express must not stop the line that names it from being written.
 */
std::string to_utf8(const std::wstring& text);

/** A path's last component, for a log line that has no room for the rest. */
std::wstring file_name_of(const std::wstring& path);

/** A double with one decimal, without dragging in a locale-sensitive stream. */
std::string decibels(double value);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_LOG_H
