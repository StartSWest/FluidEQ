/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Getting a new `Graph` onto the audio thread, and the old one off it again
 * without either thread waiting for the other.
 *
 * The audio thread may not allocate, free, lock or block, and the thread that
 * builds a graph does all four. So the handover is one atomic pointer each
 * way and nothing else: the builder stores a finished graph in `pending`, the
 * audio thread takes it at a block boundary, and the builder — the only
 * thread that ever calls `delete` — frees the previous one once it can prove
 * the audio thread cannot still be inside it.
 *
 * Its own header, free of any operating system, because every engine host
 * uses it: the effect Windows loads into audiodg.exe (`watcher.h`) and the
 * macOS engine (`native/mac-engine`). Moved here verbatim from `watcher.h`.
 */
#ifndef FLUIDEQ_ENGINE_GRAPH_SLOT_H
#define FLUIDEQ_ENGINE_GRAPH_SLOT_H

#include <atomic>
#include <cstdint>

#include "fluideq_engine/graph.h"

namespace fluideq_engine {

/**
 * The two-pointer handover between the watcher thread and the audio thread.
 *
 * Owns nothing: every graph it points at belongs to the `Watcher`, which is
 * the only thread allowed to destroy one.
 */
class GraphSlot {
 public:
  /**
   * Audio thread, at the start of a block. Copies biquad histories into
   * preallocated storage here, when the previous graph is no longer being
   * processed. No allocation, destruction, lock or operating system call.
   *
   * THE INVARIANT: a graph is taken OUT of `pending_` by the exchange before
   * it is published into `active_`, so exactly one thread ever holds a graph
   * that came out of the slot. That is what makes `publish`'s reasoning true
   * — a non-null result there is proof this thread never got it.
   *
   * Reading `pending_` first and clearing it afterwards is the shape that
   * looks safer and is not: the watcher's own exchange could take the same
   * graph back out in between and destroy it as unadopted, while this thread
   * was already about to run it.
   */
  Graph* adopt() noexcept {
    Graph* next = pending_.exchange(nullptr, std::memory_order_acq_rel);
    if (next != nullptr) {
      next->adopt_state(active_.load(std::memory_order_relaxed));
      active_.store(next, std::memory_order_release);
    }
    return active_.load(std::memory_order_relaxed);
  }

  /**
   * Audio thread, at the end of a block. This counter is the grace period:
   * it is the only evidence the watcher has that a block which could have
   * been holding an old graph has finished.
   */
  void finish_block() noexcept {
    blocks_.fetch_add(1, std::memory_order_release);
  }

  /**
   * Watcher thread: what the audio thread is running now, for state
   * carry-over.
   *
   * It cannot return a destroyed graph. A graph is only ever destroyed once
   * two blocks have completed after the publish that superseded it, and the
   * second of those two started after that publish — so its `adopt` stored
   * the newer graph into `active_` before its `finish_block`. The watcher
   * reads that counter with acquire, so observing the count that permits the
   * free also makes the newer `active_` visible, and read-read coherence
   * stops any later load here from seeing the older pointer again.
   */
  Graph* active() const noexcept {
    return active_.load(std::memory_order_acquire);
  }

  /**
   * The latest published graph's added delay, cached here rather than read
   * back off the graph.
   *
   * `GetLatency` is called from whichever thread Windows feels like, and the
   * graph it would have to ask belongs to the watcher, which may destroy it
   * at any moment. A number copied out at publish time cannot dangle.
   */
  void set_latency(uint32_t frames) noexcept {
    latency_.store(frames, std::memory_order_relaxed);
  }
  uint32_t latency() const noexcept {
    return latency_.load(std::memory_order_relaxed);
  }

  uint64_t blocks() const noexcept {
    return blocks_.load(std::memory_order_acquire);
  }

  /**
   * Watcher thread. Returns the graph this one replaced in `pending` — a
   * non-null result is proof, from the atomic exchange itself, that the audio
   * thread never took it and it can be destroyed at once.
   */
  Graph* publish(Graph* graph) noexcept {
    return pending_.exchange(graph, std::memory_order_acq_rel);
  }

  /** After the watcher has stopped and the audio thread is gone. */
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

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_GRAPH_SLOT_H
