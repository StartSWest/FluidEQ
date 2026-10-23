/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The two-pointer handover between the watcher thread and the audio thread,
 * for the Linux engine.
 *
 * The same protocol as the Windows engine's `GraphSlot` (`watcher.h`), which
 * cannot be included here because that header carries the Windows watcher
 * with it. The reasoning lives there and holds unchanged: a graph leaves
 * `pending_` exactly once, by an atomic exchange, so exactly one thread ever
 * holds it; the audio thread never allocates, frees or locks; the watcher
 * frees a superseded graph only once two blocks have completed after the
 * publish that replaced it (`graph_reclaim.h`).
 */
#ifndef FLUIDEQ_LINUX_GRAPH_SLOT_H
#define FLUIDEQ_LINUX_GRAPH_SLOT_H

#include <atomic>
#include <cstdint>

#include "fluideq_engine/graph.h"

namespace fluideq_linux {

class GraphSlot {
 public:
  using Graph = fluideq_engine::Graph;

  /** Audio thread, at the start of a block. */
  Graph* adopt() noexcept {
    Graph* next = pending_.exchange(nullptr, std::memory_order_acq_rel);
    if (next != nullptr) {
      next->adopt_state(active_.load(std::memory_order_relaxed));
      active_.store(next, std::memory_order_release);
    }
    return active_.load(std::memory_order_relaxed);
  }

  /** Audio thread, at the end of every block that reached `adopt`. */
  void finish_block() noexcept {
    blocks_.fetch_add(1, std::memory_order_release);
  }

  /** Watcher thread: what the audio thread runs now (never a freed graph). */
  Graph* active() const noexcept {
    return active_.load(std::memory_order_acquire);
  }

  void set_latency(uint32_t frames) noexcept {
    latency_.store(frames, std::memory_order_relaxed);
  }
  uint32_t latency() const noexcept {
    return latency_.load(std::memory_order_relaxed);
  }

  uint64_t blocks() const noexcept {
    return blocks_.load(std::memory_order_acquire);
  }

  /** Watcher thread. Non-null: the audio thread never took it. */
  Graph* publish(Graph* graph) noexcept {
    return pending_.exchange(graph, std::memory_order_acq_rel);
  }

  /** Once the audio thread can no longer reach this slot. */
  void clear() noexcept {
    pending_.store(nullptr, std::memory_order_relaxed);
    active_.store(nullptr, std::memory_order_relaxed);
  }

 private:
  std::atomic<Graph*> pending_{nullptr};
  std::atomic<Graph*> active_{nullptr};
  std::atomic<uint64_t> blocks_{0};
  std::atomic<uint32_t> latency_{0};
};

}  // namespace fluideq_linux

#endif  // FLUIDEQ_LINUX_GRAPH_SLOT_H
