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
#include "owner_link.h"
#include "status_file.h"
#include "analysis_link.h"
#include "input_history.h"
#include "level_prediction.h"
#include "leveling_board.h"

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
          uint32_t sample_rate, uint32_t channels, uint32_t max_frames,
          unsigned long channel_mask = 0);
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
   * Ask for the graph to be rebuilt after a pipeline flush. Any thread.
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
   * So the reset goes through the same rebuild every configuration change
   * does, handed over the same way, landing a block or two after the call
   * returns — which is what a flush of the audio pipeline can afford; the
   * alternative lands sooner and corrupts state.
   *
   * And it KEEPS what is already in flight. A fresh graph with nothing
   * carried was the obvious reading of `Reset` and the wrong one here: this
   * is an endpoint effect, so it processes the output's mix, and Windows
   * flushes that pipeline whenever any stream on the machine starts, stops or
   * changes format — while the music that was already playing carries on
   * through it. With the room on, every channel is folded through its
   * convolution, so emptying it put 512 frames of silence into the middle of
   * whatever was playing each time anything opened a sound. Because an
   * unchanged configuration then short-circuits, the ordinary flush now costs
   * a directory read rather than a graph.
   */
  void request_reset() noexcept;

  /**
   * The audio thread saying sound has reached this instance, so the status
   * file can carry it — `EngineStatus::carried`.
   *
   * Called at most once per lock, from `APOProcess`, and guarded there by a
   * flag so nothing happens on any block after the first with sound in it.
   * It is the one call on that thread that reaches the operating system, and
   * it earns the exception: without it the app can never learn that audio
   * has come — the status file is rewritten only when the engine is asked to
   * do something different, and a machine playing music while its engine is
   * passed over is asked for nothing at all. One `SetEvent` on an auto-reset
   * event, once, against a block of ten milliseconds.
   */
  void say_it_carried() noexcept;

 private:
  /** A graph this object owns, and the block count when it was superseded. */
  struct Retired {
    Graph* graph;
    uint64_t blocks_at_publish;
  };

  static unsigned __stdcall thread_entry(void* self);
  void run();
  /**
   * Resolve the config and publish a graph if anything actually changed.
   *
   * Every rebuild carries the running graph's state into its successor —
   * histories, delay lines and the convolvers' pipelines — so a band drag has
   * no click and a flush of the audio pipeline has no hole. There is no
   * variant that does not: one existed for `Reset`, and what it produced is
   * written up on `request_reset`.
   */
  void reload();
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
  /**
   * The level `graph` should take when it takes over, worked out on the music
   * just heard (`level_prediction.h`), and the chain it was worked out for
   * once published. A prediction that fails is logged and left out: the edit
   * is then heard with its level found the old way, never held back.
   */
  void open_level_prediction();
  void predict_level(const Chain& chain, Graph& graph);
  void accept_level(const Chain& chain);
  void reclaim();
  void log_chain(const Chain& chain, const Graph& graph, bool owner_present);
  /** No link means the link could not run: then FluidEQ counts as present. */
  bool owner_present() const noexcept;
  /**
   * Tell the app what this output is doing — `status_file.h`. `locked` is
   * false only from `stop()`. Never throws; a file that cannot be written
   * is logged once and otherwise changes nothing about the audio.
   */
  void report_status(bool locked) noexcept;
  /**
   * Tell the output's leveling which song is playing — `programme.h`. True
   * when that finished a named song, which the status file then carries for
   * the app to remember. Never throws.
   */
  bool follow_programme() noexcept;

  GraphSlot& slot_;
  Log& log_;
  const Endpoint endpoint_;
  const std::wstring config_dir_;
  const uint32_t sample_rate_;
  const uint32_t channels_;
  const uint32_t max_frames_;
  /**
   * The stream's channel mask (0 for a plain format); every graph this
   * builds is told, and reads the subwoofer feed and the room's speakers
   * from it.
   */
  const unsigned long channel_mask_;
  std::unique_ptr<AnalysisLink> analysis_;
  // The output's, shared with every instance locked on it and kept across
  // locks (`leveling_board.h`). Null only if it could not be allocated, and
  // then leveling forgets with each chain, as it always used to.
  std::shared_ptr<Leveling> leveling_;
  // The music as it reaches the EQ, and what replays it through each new EQ
  // before that EQ is heard. Null if either could not be allocated: every
  // edit's level is then found the old way.
  std::unique_ptr<InputHistory> history_;
  std::unique_ptr<LevelPredictor> predictor_;
  // The graph last published: what the next prediction is made against.
  // Compared, never followed.
  const Graph* last_published_ = nullptr;
  // What the last prediction came to, for the chain's log line.
  std::string level_note_;

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

  // What the last published graph does, for the status file.
  bool last_processing_ = false;
  bool last_owner_ = true;
  std::vector<std::string> graph_problems_;
  /** The last graph's `room_state()`, for the status. */
  std::string room_state_ = "off";
  /** The last graph's delay, stage by stage, and game mode, for the status. */
  uint32_t latency_ = 0;
  std::vector<std::pair<std::string, unsigned>> latency_parts_;
  std::vector<std::string> latency_active_;
  bool game_mode_ = false;
  // The watcher's own problems: a reload that threw (the previous graph
  // keeps running) until one works again, and a directory it cannot watch.
  bool reload_failed_ = false;
  bool unwatched_ = false;
  // This instance's place among the output's in the status file.
  StatusShare status_;
  bool status_failure_logged_ = false;

  HANDLE stop_event_ = nullptr;
  // Auto-reset: one wake per request, and a request that arrives while a
  // rebuild is already running is served by the next wait rather than lost.
  HANDLE reset_event_ = nullptr;
  // Auto-reset, set once per lock by the audio thread — `say_it_carried`.
  HANDLE carried_event_ = nullptr;
  HANDLE thread_ = nullptr;

  // Whether FluidEQ is running — see `owner_link.h`. Without it the engine
  // passes every endpoint through untouched, whatever the files say: a
  // configuration nobody is left running to take off again must not go on
  // shaping somebody's audio.
  std::shared_ptr<OwnerLink> owner_;
  // Auto-reset, set by the link each time FluidEQ comes or goes.
  HANDLE owner_event_ = nullptr;
};

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_WATCHER_H
