/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The macOS engine's hold on one graph.
 *
 * The same `Graph` the Windows effect runs, built off the audio thread from
 * the same files by the same resolver, handed to the audio thread through the
 * same `GraphSlot`, and freed by the Windows effect's own rule
 * (`graph_reclaim.h`): two completed blocks after the publish that
 * superseded it, and never while a newer graph is still crossing over from
 * it. A preset switch that moves the delay plays the old graph beside the new
 * one until the cross is done, and this engine once freed it at the grace
 * period alone — the audio thread then ran a freed rack, and the engine
 * crashed on preset switches (2026-10-01, four times in a day).
 *
 * The DSP rack comes with it, as it does there: the resolver reads the app's
 * `fluideq-dsp-<guid>.txt`, the rack's live leveling keeps what it learns in the
 * output's memory (`leveling_board.h`) across every rebuild and follows the
 * song the app names in `fluideq-programme-<guid>.txt`, and the room is built from
 * the head the app writes beside them. Nothing here knows about Core Audio:
 * the tap, the device and the directory watch are the rest of this program.
 */
#ifndef FLUIDEQ_MAC_ENGINE_ENGINE_H
#define FLUIDEQ_MAC_ENGINE_ENGINE_H

#include <atomic>
#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "fluideq_engine/config.h"
#include "fluideq_engine/graph.h"
#include "graph_reclaim.h"
#include "graph_slot.h"
#include "leveling_board.h"
#include "mac_analysis_link.h"

namespace fluideq_mac {

/** The tap is a stereo mixdown, so the graph is always two channels wide. */
constexpr uint32_t kEngineChannels = 2;

struct EngineFormat {
  uint32_t sample_rate = 0;
  /** The largest block one `Graph::process` call takes; bigger ones are cut. */
  uint32_t max_frames = 0;
};

/** What one reload found, for the log and for whether to tap at all. */
struct ReloadResult {
  /** The graph now published does work: the sound must come through here. */
  bool processing = false;
  /** A new graph was built; false when nothing that decides it had changed. */
  bool rebuilt = false;
  /** The resolver found a block for this output (`Chain::matched`). */
  bool matched = false;
  /** This wake ended a song the app had named, which the status reports. */
  bool finished_song = false;
  std::vector<std::string> warnings;
  std::vector<std::string> problems;
  /** What the room folds and through which head, or empty. */
  std::string room_note;
};

/**
 * What the published graph does, in the status file's own terms
 * (`EngineStatus`). Kept from the build rather than read off the graph when a
 * status is written, because statuses are also written when no graph is
 * built — the tap starting, sound first arriving, a song ending — and the
 * published graph belongs to the audio thread by then.
 */
struct GraphFacts {
  bool processing = false;
  std::vector<std::string> problems;
  std::string room = "off";
  uint32_t latency = 0;
  std::vector<std::pair<std::string, unsigned>> latency_parts;
  std::vector<std::string> latency_active;
  bool game_mode = false;
};

class Engine {
 public:
  /**
   * `analysis` is where the published graphs report what the DSP page and
   * the automatic preamp's readout draw, or null for nowhere; it outlives
   * this engine.
   */
  Engine(std::wstring config_dir, fluideq_engine::AnalysisLink* analysis);
  ~Engine();
  Engine(const Engine&) = delete;
  Engine& operator=(const Engine&) = delete;

  /**
   * Control thread. Reads the configuration for `endpoint` and publishes a
   * graph for it when anything that decides the graph has changed — the
   * bytes of any file the resolver opened, the room's head, the output, or
   * the format. Follows the song the app names on every call, whether or not
   * a graph is built. Throws only what `Graph`'s constructor throws (an
   * allocation failure).
   */
  ReloadResult reload(const fluideq_engine::Endpoint& endpoint,
                      const EngineFormat& format);

  /**
   * Control thread, once the audio thread has stopped for good: every graph
   * is freed and the next `reload` builds from scratch. What leveling learned
   * is kept — it is the output's, not the graph's.
   */
  void release_all() noexcept;

  /**
   * Audio thread. In place over `kEngineChannels` planar buffers. `frames`
   * may be larger than the graph's block; it is processed in pieces.
   * No allocation, lock, system call or throw.
   */
  void process(float* const* planar, uint32_t frames) noexcept;

  /** Control thread: the published graph, as the status describes it. */
  const GraphFacts& facts() const noexcept { return facts_; }

  /** Control thread: the last song live leveling finished on this output. */
  std::optional<fluideq_engine::SongReport> last_song() const;

 private:
  bool follow_programme() noexcept;
  void publish(std::unique_ptr<fluideq_engine::Graph> graph);
  void reclaim() noexcept;

  std::wstring config_dir_;
  fluideq_engine::AnalysisLink* analysis_;
  fluideq_engine::GraphSlot slot_;
  /** Every graph that may still be reachable, oldest first. */
  std::vector<fluideq_engine::OwnedGraph> owned_;
  std::string signature_;
  bool have_signature_ = false;
  bool processing_ = false;
  bool matched_ = false;
  GraphFacts facts_;
  /** The output's leveling, for as long as this process lives. */
  std::shared_ptr<fluideq_engine::Leveling> leveling_;
  std::wstring leveling_endpoint_;
  /** The published graphs' block size, read by the audio thread to cut. */
  std::atomic<uint32_t> chunk_frames_{0};
};

}  // namespace fluideq_mac

#endif  // FLUIDEQ_MAC_ENGINE_ENGINE_H
