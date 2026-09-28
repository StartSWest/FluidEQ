/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The watcher's reload: reading the configuration, building the graph it
 * describes and handing that graph to the audio thread. Split from
 * `watcher.cpp`, which runs the thread and decides when a reload happens.
 */

#include <algorithm>
#include <exception>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "chain_signature.h"
#include "config_file.h"
#include "room_head.h"
#include "watcher.h"

namespace fluideq_engine {

namespace {

/**
 * The graph's delay stage by stage, by the names the app reads, in the order
 * the audio meets them, and only the stages that add anything.
 */
std::vector<std::pair<std::string, unsigned>> latency_parts_of(
    const Graph& graph) {
  const Graph::LatencyParts& parts = graph.latency_parts();
  // In the order the sound meets them — the rack's stages as
  // `feq_chain_process` runs them, then the graph's as `Graph::process`
  // does — because the page lists them as they come.
  const std::pair<const char*, uint32_t> named[] = {
      {"leveler", parts.rack.leveler},
      {"restoration", parts.rack.restoration},
      {"exciter", 0u},
      {"bassForge", 0u},
      {"linearEq", parts.rack.linear_eq},
      {"bassPunch", parts.rack.bass_punch},
      {"room", parts.rack.room},
      {"dimension", 0u},
      {"maximizer", parts.rack.maximizer},
      {"headroom", parts.rack.headroom},
      {"master", 0u},
      {"eqPhase", parts.eq_phase},
      {"curvePhase", parts.curve_phase},
      {"convolution", parts.convolution},
      {"curves", parts.curves},
      {"guard", parts.guard},
      {"filters", 0u},
      {"preamp", 0u},
  };
  std::vector<std::pair<std::string, unsigned>> out;
  for (const auto& one : named) {
    const auto& active = graph.active_stages();
    if (one.second > 0u || std::find(active.begin(), active.end(), one.first) != active.end()) {
      out.emplace_back(one.first, one.second);
    }
  }
  return out;
}

}  // namespace

void Watcher::reload() {
  // The edit is heard first; its level follows (`level_mailbox.h`). A wake
  // that changed nothing — a flush, the app's temporary files — still gets
  // on with a level an interrupted reload left owed.
  load_chain();
  settle_level();
}

void Watcher::load_chain() {
  if (analysis_) analysis_->retry();
  try {
    const FileProvider provider = [](const std::wstring& path) {
      return read_config_file(path);
    };
    // With FluidEQ gone, nothing is read at all: the graph is built from an
    // empty chain, which is pass-through, rack included.
    const bool owner = owner_present();
    const Chain chain =
        owner ? resolve_chain(config_dir_, endpoint_, provider) : Chain{};
    // `UnlockForProcess` waits for this thread with no timeout, so every
    // phase that takes real time is followed by a chance to abandon: the
    // resolve above reads a directory of files, the construction below
    // designs a FIR and allocates a convolver per channel.
    if (stop_requested()) {
      return;
    }

    // FluidEQ's presence is part of what was loaded: the same files with and
    // without it build different graphs.
    std::string next = signature_of(chain) + (owner ? "|o=1" : "|o=0");
    // Before the comparison and outside the signature: a new song is a
    // change worth reading on every wake, and never one worth a new chain.
    const bool finished_song = owner && follow_programme();
    // Nothing to do when the configuration is byte-for-byte what it already
    // was — which is every flush of the audio pipeline, and most of the wakes
    // this directory produces, the app's own temporary files included.
    if (have_signature_ && next == signature_) {
      if (finished_song) {
        report_status(true);
      }
      return;
    }

    // The room's head, beside the rack file: read with the rest of the
    // configuration, so a head written after the rack is picked up by the
    // same notification. No file is no head, which the rack reports. Parsed
    // again only when the text is not what was parsed last.
    const std::optional<std::string> head_text =
        read_config_file(config_dir_ + L"\\" + kRoomHeadFileName);
    if (!head_text) {
      if (room_head_) room_head_generation_ += 1;
      room_head_text_.clear();
      room_head_.reset();
    } else if (*head_text != room_head_text_ || !room_head_) {
      room_head_ = parse_room_head(*head_text, static_cast<double>(sample_rate_));
      room_head_text_ = room_head_ ? *head_text : std::string();
      room_head_generation_ += 1;
    }
    const RoomHead* const head = room_head_ ? &*room_head_ : nullptr;
    // The graph published last runs a rack this one may be able to keep
    // running (`Graph`'s `rack_from`), but only if it was built through the
    // same head: the head is one object, re-parsed in place when it changes.
    const Graph* const rack_from =
        rack_source_head_ == room_head_generation_ ? rack_source_ : nullptr;
    // Whether the graph being replaced was changing the sound: if so, a
    // chain with nothing for this output still fades the EQ out rather than
    // cutting it, and keeps the timeline (`Graph`'s `follows_processing`).
    // `active()` cannot return a graph already destroyed — see `GraphSlot`.
    const Graph* const running = slot_.active();
    const bool follows_processing =
        running != nullptr && !running->is_passthrough();
    auto graph = std::make_unique<Graph>(
        chain, sample_rate_, channels_, max_frames_,
        leveling_ ? leveling_->memory() : nullptr, channel_mask_, head,
        follows_processing, rack_from);
    // Once per rack built: a kept rack has said it already.
    const bool rack_kept = rack_from != nullptr && graph->rack_is_shared_with(*rack_from);
    if (!graph->room_note().empty() && !rack_kept) {
      log_.write(graph->room_note());
    }
    if (stop_requested()) {
      // The half-built graph dies with the `unique_ptr`, having never been
      // reachable from the slot. Recording the signature is left undone with
      // it, so an abandoned rebuild cannot be mistaken for a loaded one.
      return;
    }
    graph->request_state_transfer();
    const bool level_owed = plan_level(chain, *graph);
    // Said once, as the graph that did it is replaced: a count that only
    // ever lived on the audio thread, where nothing may write a log line.
    if (const Graph* previous = slot_.active()) {
      const uint32_t silenced = previous->silenced_blocks();
      if (silenced > 0) {
        log_.write("silenced " + std::to_string(silenced) +
                   " block(s) whose samples were not all real numbers");
      }
    }
    log_chain(chain, *graph, owner);
    const bool processing = !graph->is_passthrough();
    std::vector<std::string> problems = graph->problems();
    room_state_ = graph->room_state();
    latency_ = processing ? graph->latency_frames() : 0u;
    latency_active_ = processing ? graph->active_stages() : std::vector<std::string>{};
    latency_parts_ = processing ? latency_parts_of(*graph)
                                : std::vector<std::pair<std::string, unsigned>>{};
    // Like the delay above: passing the sound through, nothing runs in any
    // mode, and a page saying "game mode" over a chain that is not playing
    // would be describing the configuration, not the sound.
    game_mode_ = processing && graph->low_latency();
    publish(std::move(graph));
    owe_level(chain, level_owed);
    signature_.swap(next);
    have_signature_ = true;
    last_processing_ = processing;
    last_owner_ = owner;
    graph_problems_.swap(problems);
    reload_failed_ = false;
    report_status(true);
  } catch (const std::exception& error) {
    log_.write(std::string("configuration reload failed: ") + error.what());
    reload_failed_ = true;
    report_status(true);
  } catch (...) {
    log_.write("configuration reload failed");
    reload_failed_ = true;
    report_status(true);
  }
}

void Watcher::publish(std::unique_ptr<Graph> graph) {
  if (analysis_) graph->set_meters(analysis_->meters(), analysis_->activity());
  if (analysis_) graph->set_output_meters(&analysis_->output_gain, &analysis_->output_enabled, &analysis_->output_active);
  graph->set_history(history_.get());
  // Ownership is recorded before the graph becomes reachable: if this
  // allocation throws, the unique_ptr still holds the only reference and
  // frees it, and the audio thread never saw it.
  owned_.push_back(OwnedGraph{graph.get(), 0});
  Graph* const raw = graph.release();
  rack_source_ = raw;
  rack_source_head_ = room_head_generation_;

  slot_.set_latency(raw->latency_frames());
  Graph* const unconsumed = slot_.publish(raw);
  // Read after the exchange: a block that increments this counter from here
  // on cannot have adopted anything older than what was just published.
  owned_.back().blocks_at_publish = slot_.blocks();

  if (unconsumed != nullptr) {
    // The exchange took it back out of `pending` still unread, which is proof
    // the audio thread never adopted it — the common case on an idle endpoint,
    // and what stops a user dragging a band with nothing playing from piling
    // up a graph per frame until the stream starts.
    const auto found = std::find_if(
        owned_.begin(), owned_.end(),
        [unconsumed](const OwnedGraph& at) { return at.graph == unconsumed; });
    if (found != owned_.end()) {
      delete found->graph;
      owned_.erase(found);
    }
  }
  reclaim();
}

void Watcher::reclaim() { reclaim_graphs(owned_, slot_.blocks()); }

}  // namespace fluideq_engine
