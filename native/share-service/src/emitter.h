/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * Node's EventEmitter for one event: listeners in the order they were
 * added, `once` ones taken off before they run, and an emit that calls
 * every listener that was there when it began — one removed by an earlier
 * listener of the same emit still hears it, as in Node. The link code was
 * written against exactly that, attaching and removing listeners as a
 * connection changes hands.
 */

#include <functional>
#include <utility>
#include <vector>

namespace feq::share::service {

template <class... Args>
class Emitter {
 public:
  using Listener = std::function<void(Args...)>;

  int on(Listener listener) { return add(std::move(listener), false); }
  int once(Listener listener) { return add(std::move(listener), true); }

  void off(int id) {
    for (auto it = entries_.begin(); it != entries_.end(); ++it) {
      if (it->id == id) {
        entries_.erase(it);
        return;
      }
    }
  }

  void clear() { entries_.clear(); }
  bool empty() const { return entries_.empty(); }

  void emit(Args... args) {
    const std::vector<Entry> snapshot = entries_;
    for (const Entry& entry : snapshot) {
      if (entry.once) {
        off(entry.id);
      }
      entry.listener(args...);
    }
  }

 private:
  struct Entry {
    int id;
    Listener listener;
    bool once;
  };

  int add(Listener listener, bool once) {
    next_ += 1;
    entries_.push_back(Entry{next_, std::move(listener), once});
    return next_;
  }

  std::vector<Entry> entries_;
  int next_ = 0;
};

}  // namespace feq::share::service
