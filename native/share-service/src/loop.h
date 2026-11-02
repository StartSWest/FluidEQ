/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * The Share Audio service's one thread of work: an I/O completion port, the
 * way Node's own loop is one on Windows. Every socket, pipe and child of the
 * service completes here, and everything the service decides runs on this
 * thread, in order — so the link logic ported from TypeScript keeps the
 * ordering it was written against, with no lock anywhere in it.
 *
 * `defer` is JavaScript's microtask: work that runs once the event being
 * handled has finished, before the next one is taken. The TypeScript leans on
 * that ordering (a promise settles, and its `then` runs after the code that
 * settled it), and `Future` below keeps it.
 *
 * Nothing here waits on a clock. The loop sleeps in
 * `GetQueuedCompletionStatusEx` until Windows completes something or another
 * thread posts work.
 */

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include <cstdint>
#include <deque>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <utility>
#include <variant>
#include <vector>

namespace feq::share::service {

/**
 * Why something failed, as much as may leave the service: `code` and
 * `syscall` are the system's words for it (EADDRINUSE, listen), the ones
 * Node puts on its errors and main reads; `close_code` is set only when the
 * other side's WebSocket close is what ended it (`LanJoinClosed`).
 */
struct Failure {
  std::string message;
  std::string code;
  std::string syscall;
  int close_code = 0;
};

/** libuv's name for a Windows or Winsock error, as Node reports it. */
std::string error_name(DWORD error);

/** A failure from a system error, named the way Node names it. */
Failure system_failure(DWORD error, std::string syscall);

/** A failure that is only what went wrong, in words. */
Failure failure_with(std::string message);

/** One overlapped operation in flight; the loop runs `done` when it ends. */
struct Operation : OVERLAPPED {
  explicit Operation(std::function<void(DWORD error, DWORD bytes)> then)
      : OVERLAPPED{}, done(std::move(then)) {}
  std::function<void(DWORD error, DWORD bytes)> done;
};

class Loop {
 public:
  Loop();
  ~Loop();
  Loop(const Loop&) = delete;
  Loop& operator=(const Loop&) = delete;

  /** Completions for `handle` arrive here from now on. */
  bool attach(HANDLE handle);

  /** After the event being handled: a microtask. Loop thread only. */
  void defer(std::function<void()> task);

  /** From any thread: `task` runs on the loop, as an event of its own. */
  void post(std::function<void()> task);

  /**
   * An overlapped call that was issued with `operation`: when Windows said it
   * is pending or done, its completion arrives as usual; when it failed at
   * once, nothing will arrive, so its failure is delivered as an event of its
   * own, never inside the caller (Node never reports an I/O error from inside
   * the call that started it).
   */
  void issued(Operation* operation, bool succeeded);

  /** Runs until `stop`; the exit code `stop` was given. */
  int run();
  void stop(int code);

  /**
   * Every microtask waiting, and every one they defer in turn. The loop
   * does this after each event; a test with no I/O does it by hand.
   */
  void drain_deferred();

 private:
  HANDLE port_ = nullptr;
  std::deque<std::function<void()>> deferred_;
  bool stopping_ = false;
  int code_ = 0;
};

/** The loop this thread runs; the service has one. */
Loop& loop();
void set_loop(Loop* loop);

/** `undefined`, for a `Future` that settles with nothing. */
struct Nothing {};

/**
 * A promise, on the loop. Settled once; every `then` runs as a microtask
 * after the settling, in the order they were attached, as JavaScript's do.
 */
template <class T>
class Future {
 public:
  using Result = std::variant<T, Failure>;

  Future() : state_(std::make_shared<State>()) {}

  static Future resolved(T value) {
    Future future;
    future.resolve(std::move(value));
    return future;
  }
  static Future rejected(Failure failure) {
    Future future;
    future.reject(std::move(failure));
    return future;
  }

  void resolve(T value) const { settle(Result(std::in_place_index<0>, std::move(value))); }
  void reject(Failure failure) const {
    settle(Result(std::in_place_index<1>, std::move(failure)));
  }
  bool settled() const { return state_->result.has_value(); }

  /** `then(onResult)`: `onResult` hears the value or the failure. */
  void then(std::function<void(const Result&)> on_result) const {
    if (state_->result) {
      auto state = state_;
      loop().defer([state, on_result = std::move(on_result)] {
        on_result(*state->result);
      });
      return;
    }
    state_->waiting.push_back(std::move(on_result));
  }

  /** Another future that settles as this one does, after `on_value` ran. */
  template <class U>
  Future<U> map(std::function<U(const T&)> on_value) const {
    Future<U> next;
    then([next, on_value = std::move(on_value)](const Result& result) {
      if (result.index() == 0) {
        next.resolve(on_value(std::get<0>(result)));
      } else {
        next.reject(std::get<1>(result));
      }
    });
    return next;
  }

  /** Settles `other` the way this one settles. */
  void forward(const Future& other) const {
    then([other](const Result& result) { other.settle(result); });
  }

  bool same_as(const Future& other) const { return state_ == other.state_; }

 private:
  struct State {
    std::optional<Result> result;
    std::vector<std::function<void(const Result&)>> waiting;
  };

  void settle(Result result) const {
    if (state_->result) {
      return;
    }
    state_->result = std::move(result);
    auto waiting = std::move(state_->waiting);
    state_->waiting.clear();
    for (auto& on_result : waiting) {
      auto state = state_;
      loop().defer([state, on_result = std::move(on_result)] {
        on_result(*state->result);
      });
    }
  }

  std::shared_ptr<State> state_;
};

/**
 * `future.then(next)` where `next` returns a promise of its own: the result
 * settles as the promise `next` gave, as a JavaScript `then` does.
 */
template <class U, class T>
Future<U> chain(const Future<T>& future,
                std::function<Future<U>(const typename Future<T>::Result&)> next) {
  Future<U> out;
  future.then([out, next = std::move(next)](
                  const typename Future<T>::Result& result) {
    next(result).forward(out);
  });
  return out;
}

}  // namespace feq::share::service
