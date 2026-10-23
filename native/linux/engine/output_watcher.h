/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The thread that reads the configuration directory and builds graphs, for
 * the Linux engine: the Windows `Watcher` with inotify and eventfds where
 * that one has change notifications and events.
 *
 * What it does is the Windows engine's, step for step, so an EQ sounds the
 * same on both: resolve the chain with the shared resolver, skip it when the
 * signature has not changed, build the graph off the audio thread (keeping a
 * rack that did not change, `rack_from`), publish it through the slot, send
 * its level after (`level_mailbox.h`), and tell the app in the status file.
 * Left out, because nothing on Linux plays the part yet: the second output
 * fed from this one (`split_*`), the Library host's source analysis, and the
 * owner pipe — this engine is FluidEQ's own child process and exits with it,
 * which is the guarantee the pipe exists to give the Windows engine.
 *
 * It waits on file-system events and two eventfds and nothing else — no
 * timeout, no poll interval — as the Windows watcher waits on handles.
 */
#ifndef FLUIDEQ_LINUX_OUTPUT_WATCHER_H
#define FLUIDEQ_LINUX_OUTPUT_WATCHER_H

#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <thread>
#include <utility>
#include <vector>

#include "fluideq_engine/config.h"
#include "fluideq_engine/graph.h"
#include "graph_reclaim.h"
#include "graph_slot.h"
#include "input_history.h"
#include "level_mailbox.h"
#include "level_prediction.h"
#include "leveling_board.h"
#include "log.h"
#include "room_head.h"
#include "status_file.h"

namespace fluideq_linux {

class OutputWatcher {
 public:
  using Chain = fluideq_engine::Chain;
  using Endpoint = fluideq_engine::Endpoint;
  using Graph = fluideq_engine::Graph;

  OutputWatcher(GraphSlot& slot, fluideq_engine::Log& log, Endpoint endpoint,
                std::wstring config_dir, uint32_t sample_rate,
                uint32_t channels, uint32_t max_frames,
                unsigned long channel_mask,
                std::function<void()> latency_changed = {});
  ~OutputWatcher();

  OutputWatcher(const OutputWatcher&) = delete;
  OutputWatcher& operator=(const OutputWatcher&) = delete;

  /**
   * Resolve, build and publish the first graph on the calling thread, before
   * any audio flows: starting unprocessed and switching a moment later is
   * heard as the volume changing by itself.
   */
  void load_initial();

  /** Starts the thread. False if it could not; audio still runs. */
  bool start();

  /**
   * Joins the thread and says the output is let go. Graphs are NOT freed
   * here: the audio thread may still be inside one until its stream is gone
   * (`release_graphs`).
   */
  void stop() noexcept;

  /** After the audio thread can no longer reach the slot. */
  void release_graphs() noexcept;

  /**
   * Audio thread, at most a handful of times a stream: sound has reached
   * this output, or a block took a larger share of its period than any
   * before. One eventfd write, never a wait.
   */
  void say_it_carried() noexcept;
  void say_it_was_slow() noexcept;

 private:
  void run();
  /** Re-arms the inotify watch; true when it now watches the config dir itself. */
  bool arm_watch();
  /** Reads every pending inotify event; true when any was read. */
  bool drain_changes() noexcept;
  bool stop_requested() const noexcept;
  bool change_pending() const noexcept;

  void reload();
  void load_chain();
  void publish(std::unique_ptr<Graph> graph);
  void reclaim();

  void open_level_prediction();
  bool plan_level(const Chain& chain, Graph& graph);
  void owe_level(const Chain& chain, bool owed);
  void settle_level();
  void accept_level(const Chain& chain, uint64_t heard_frames);

  void log_chain(const Chain& chain, const Graph& graph);
  void log_timing() noexcept;
  void report_status(bool locked) noexcept;
  bool follow_programme() noexcept;
  std::optional<std::string> read_endpoint_file(const wchar_t* stem) const;

  GraphSlot& slot_;
  fluideq_engine::Log& log_;
  const Endpoint endpoint_;
  const std::wstring config_dir_;
  const uint32_t sample_rate_;
  const uint32_t channels_;
  const uint32_t max_frames_;
  const unsigned long channel_mask_;
  // Called on this thread after a publish that changed the delay, so the
  // router can tell the sound server (video players keep lips in sync by it).
  const std::function<void()> latency_changed_;
  uint32_t latency_reported_ = UINT32_MAX;

  std::shared_ptr<fluideq_engine::Leveling> leveling_;
  std::shared_ptr<fluideq_engine::InputHistory> history_;
  std::unique_ptr<fluideq_engine::LevelPredictor> predictor_;
  fluideq_engine::LevelMailbox level_mailbox_;
  uint32_t generation_ = 0;
  struct OwedLevel {
    Chain chain;
    uint32_t generation = 0;
    uint64_t published_at = 0;
  };
  std::optional<OwedLevel> owed_level_;
  uint64_t others_from_ = UINT64_MAX;

  std::optional<std::string> room_head_text_;
  std::optional<fluideq_engine::RoomHead> room_head_;
  uint64_t room_head_generation_ = 0;
  const Graph* rack_source_ = nullptr;
  uint64_t rack_source_head_ = 0;

  std::vector<fluideq_engine::OwnedGraph> owned_;
  std::string signature_;
  bool have_signature_ = false;
  std::vector<std::string> logged_ignored_;
  std::string passthrough_reason_;
  bool have_passthrough_reason_ = false;

  bool last_processing_ = false;
  std::vector<std::string> graph_problems_;
  std::string room_state_ = "off";
  uint32_t latency_ = 0;
  std::vector<std::pair<std::string, unsigned>> latency_parts_;
  std::vector<std::string> latency_active_;
  bool game_mode_ = false;
  bool reload_failed_ = false;
  bool unwatched_ = false;
  fluideq_engine::StatusShare status_;
  bool status_failure_logged_ = false;
  uint32_t timing_step_logged_ = 0;

  // The inotify descriptor, the watch on it, and whether that watch is the
  // config directory itself or an ancestor waiting for it to appear.
  int inotify_ = -1;
  int watch_ = -1;
  bool watching_config_ = false;
  int stop_fd_ = -1;
  int status_fd_ = -1;
  std::thread thread_;
};

}  // namespace fluideq_linux

#endif  // FLUIDEQ_LINUX_OUTPUT_WATCHER_H
