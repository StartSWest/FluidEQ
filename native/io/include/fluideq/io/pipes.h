/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * Pipes and child processes on the service's loop, as Node gave them to
 * the TypeScript: a stream over an overlapped pipe (its writes queued in
 * order and counted while they wait, `writableLength`), a child process
 * started with pipes for its standard streams, and a named-pipe server
 * that keeps instances waiting so a client never finds none.
 */

#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <span>
#include <string>
#include <variant>
#include <vector>

#include "fluideq/io/loop.h"

namespace feq::io {

using Bytes = std::vector<std::uint8_t>;

class PipeStream : public std::enable_shared_from_this<PipeStream> {
 public:
  struct Events {
    std::function<void(std::span<const std::uint8_t>)> data;
    /** The other end closed (Node's `end`). */
    std::function<void()> end;
    /** Gone, once, with what ended it or nothing. */
    std::function<void(const std::optional<Failure>&)> closed;
  };

  /** An overlapped handle already attached to the loop. */
  explicit PipeStream(HANDLE handle);
  ~PipeStream();
  PipeStream(const PipeStream&) = delete;
  PipeStream& operator=(const PipeStream&) = delete;

  /** Starts reading; a stream that is only written never calls this. */
  void start(Events events);
  void replace_events(Events events) { events_ = std::move(events); }
  /** Hears only when it is gone: for a stream that is written, not read. */
  void watch_closed(std::function<void(const std::optional<Failure>&)> closed) {
    events_.closed = std::move(closed);
  }

  void write(Bytes bytes,
             std::function<void(const std::optional<Failure>&)> done = {});
  /** Bytes written that the other end has not taken yet. */
  std::size_t writable_length() const { return pending_bytes_; }
  /** Writes `last`, then closes this end once everything queued has gone. */
  void end(Bytes last = {});
  void destroy();
  bool destroyed() const { return closed_handle_; }

 private:
  void read();
  void close_with(std::optional<Failure> failure);
  void close_when_written();

  HANDLE handle_;
  Events events_;
  std::size_t pending_bytes_ = 0;
  std::size_t writes_in_flight_ = 0;
  bool reading_ = false;
  bool ending_ = false;
  bool closed_handle_ = false;
  bool announced_ = false;
};

/** One of a child's standard streams: this side's end, and the child's. */
struct ChildPipe {
  std::shared_ptr<PipeStream> ours;
  /** Inheritable; handed to the child and closed here once it has it. */
  HANDLE theirs = nullptr;
};

/** A pipe the child reads from (`child_writes` false) or writes to. */
std::optional<ChildPipe> child_pipe(bool child_writes);

class ChildProcess : public std::enable_shared_from_this<ChildProcess> {
 public:
  /**
   * Starts `executable` with `arguments`, hidden, its standard streams on
   * the three handles and no other handle of this process inherited.
   * `exited` hears its exit code on the loop.
   */
  static std::variant<std::shared_ptr<ChildProcess>, Failure> spawn(
      const std::wstring& executable, const std::vector<std::wstring>& arguments,
      HANDLE input, HANDLE output, HANDLE error,
      std::function<void(DWORD code)> exited);

  ChildProcess(HANDLE process, DWORD pid);
  ~ChildProcess();
  ChildProcess(const ChildProcess&) = delete;
  ChildProcess& operator=(const ChildProcess&) = delete;

  DWORD pid() const { return pid_; }
  void kill();

  /** What the wait for its exit tells, kept apart from the process. */
  struct Watch;

 private:
  HANDLE process_;
  DWORD pid_;
  HANDLE wait_ = nullptr;
  std::shared_ptr<Watch> watch_;
  std::weak_ptr<Watch>* context_ = nullptr;
};

class PipeServer : public std::enable_shared_from_this<PipeServer> {
 public:
  using Connected = std::function<void(std::shared_ptr<PipeStream>)>;

  /** Serves `name`; nothing else may serve it while this does. */
  static std::variant<std::shared_ptr<PipeServer>, Failure> listen(
      const std::wstring& name);

  PipeServer(std::wstring name, std::vector<HANDLE> waiting);
  ~PipeServer();
  PipeServer(const PipeServer&) = delete;
  PipeServer& operator=(const PipeServer&) = delete;

  void start(Connected connected);
  void close();

 private:
  void wait_on(HANDLE instance);
  void replenish();

  std::wstring name_;
  std::vector<HANDLE> waiting_;
  Connected connected_;
  bool closed_ = false;
};

/** One argument as `CommandLineToArgvW` reads it back: Windows' own rules. */
std::wstring quoted_argument(const std::wstring& argument);

/** `"\\.\pipe\" + prefix + 32 random hex digits`. */
std::wstring unique_pipe_name(const std::wstring& prefix);

}  // namespace feq::io
