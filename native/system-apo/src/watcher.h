/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Getting a new `Graph` from the file system onto the audio thread, and the
 * old one off it again without either thread waiting for the other.
 *
 * The audio thread may not allocate, free, lock or block, and the thread that
 * builds a graph does all four. So the handover is one atomic pointer each
 * way and nothing else: the watcher stores a finished graph in `pending`, the
 * audio thread takes it at a block boundary, and the watcher — the only
 * thread that ever calls `delete` — frees the previous one once it can prove
 * the audio thread cannot still be inside it.
 *
 * That proof is what `GraphSlot` exists for, and it is easy to get subtly
 * wrong: a graph must never be invisible to the watcher while the audio
 * thread is picking it up, or a reclaim landing in that window frees a graph
 * that is one instruction away from being used.
 */
#ifndef FLUIDEQ_ENGINE_WATCHER_H
#define FLUIDEQ_ENGINE_WATCHER_H

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <atomic>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

#include "fluideq_engine/config.h"
#include "fluideq_engine/graph.h"
#include "log.h"

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
   * Audio thread, at the start of a block. Real-time safe: two atomic loads,
   * at most one store and one compare-exchange, no allocation and no branch
   * into the operating system.
   *
   * The order matters. `active_` is stored BEFORE `pending_` is cleared, so
   * the incoming graph is reachable from one of the two pointers at every
   * instant; taking it out of `pending_` first would leave a window in which
   * the watcher, looking at both, would see it in neither and free it.
   */
  Graph* adopt() noexcept {
    Graph* next = pending_.load(std::memory_order_acquire);
    if (next != nullptr) {
      active_.store(next, std::memory_order_release);
      pending_.compare_exchange_strong(next, nullptr,
                                       std::memory_order_acq_rel,
                                       std::memory_order_relaxed);
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

  /** Watcher thread: what the audio thread is running now, for state carry-over. */
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

/**
 * The thread that reads the configuration directory and builds graphs.
 *
 * One per locked endpoint. It waits on a change notification and a stop
 * event and nothing else — no timeout, no poll, no sleep — so a machine with
 * a static configuration pays exactly nothing for having the effect
 * installed.
 */
class Watcher {
 public:
  Watcher(GraphSlot& slot, Log& log, Endpoint endpoint, std::wstring config_dir,
          uint32_t sample_rate, uint32_t channels, uint32_t max_frames);
  ~Watcher();

  Watcher(const Watcher&) = delete;
  Watcher& operator=(const Watcher&) = delete;

  /**
   * Resolve, build and publish the first graph on the calling thread.
   *
   * `LockForProcess` calls this before starting the thread: audio must not
   * start unprocessed and then jump to processed a moment later, which is
   * heard as the volume changing by itself right after a device switch.
   */
  void load_initial();

  /** Starts the thread. False if it could not be created; audio still runs. */
  bool start();

  /** Signals, joins, and destroys every graph. Safe to call more than once. */
  void stop() noexcept;

 private:
  /** A graph this object owns, and the block count when it was superseded. */
  struct Retired {
    Graph* graph;
    uint64_t blocks_at_publish;
  };

  static unsigned __stdcall thread_entry(void* self);
  void run();
  /** Resolve the config and publish a graph if anything actually changed. */
  void reload();
  void publish(std::unique_ptr<Graph> graph);
  void reclaim();
  void log_chain(const Chain& chain, const Graph& graph);

  GraphSlot& slot_;
  Log& log_;
  const Endpoint endpoint_;
  const std::wstring config_dir_;
  const uint32_t sample_rate_;
  const uint32_t channels_;
  const uint32_t max_frames_;

  // Watcher-thread state (plus `load_initial`, which runs before the thread
  // exists — never both at once).
  std::vector<Retired> owned_;
  std::string signature_;
  bool have_signature_ = false;
  std::vector<std::string> logged_ignored_;
  std::string passthrough_reason_;
  // False until the first chain is logged, so the first one always says
  // which of the two states it is in rather than only saying so on a change.
  bool have_passthrough_reason_ = false;

  HANDLE stop_event_ = nullptr;
  HANDLE thread_ = nullptr;
};

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_WATCHER_H
