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
 * That proof is what `GraphSlot` exists for, and it rests on one invariant:
 * a graph leaves `pending_` exactly once, by an atomic exchange, so exactly
 * one thread ever holds it. The audio thread's exchange and the watcher's are
 * the same operation on the same pointer, and only one of them can win.
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

  /**
   * Ask for a graph carrying none of the previous one's state. Any thread.
   *
   * This is how `IAudioProcessingObject::Reset` is served. Its contract says
   * only that it "is not real-time compliant and must not be called from a
   * real-time processing thread" — which names the caller's thread and says
   * nothing about the audio thread being idle meanwhile. So `Reset` may not
   * zero a biquad history, a convolver's overlap or the rack's chain in
   * place: every one of those is memory the audio thread can be inside at
   * that instant, and writing it from another thread is the race this whole
   * two-pointer handover exists to avoid.
   *
   * A whole new graph is the reset instead — new biquads, new convolvers, a
   * new rack chain, all at their start-up state — handed over the same way
   * every other rebuild is. It lands a block or two later than the call
   * returns, which is what a flush of the audio pipeline can afford; the
   * alternative lands sooner and corrupts state.
   */
  void request_reset() noexcept;

 private:
  /** Whether a rebuild carries the running graph's state into its successor. */
  enum class Carry {
    /** An ordinary reload: histories move across so a band drag has no click. */
    State,
    /** A reset: nothing moves across, and the rebuild happens even if the
        configuration is byte-for-byte what it already was. */
    Nothing,
  };

  /** A graph this object owns, and the block count when it was superseded. */
  struct Retired {
    Graph* graph;
    uint64_t blocks_at_publish;
  };

  static unsigned __stdcall thread_entry(void* self);
  void run();
  /** Resolve the config and publish a graph if anything actually changed. */
  void reload(Carry carry);
  /**
   * Whether `stop()` has already been asked for.
   *
   * Not a wait and not a poll: the event is either set or it is not at the
   * instant this is called, and a zero timeout asks exactly that. `reload()`
   * consults it between its phases because `stop()` joins this thread with no
   * timeout, so a rebuild left running is time `UnlockForProcess` spends
   * blocked — and a rebuild is a directory of files read plus a 4097-tap FIR
   * designed.
   */
  bool stop_requested() const noexcept;
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
  // Auto-reset: one wake per request, and a request that arrives while a
  // rebuild is already running is served by the next wait rather than lost.
  HANDLE reset_event_ = nullptr;
  HANDLE thread_ = nullptr;
};

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_WATCHER_H
