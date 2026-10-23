/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "engine.h"

#include <algorithm>
#include <utility>

#include "config_file.h"
#include "posix_path.h"
#include "programme.h"
#include "room_head.h"
#include "status_report.h"

namespace fluideq_mac {

Engine::Engine(std::wstring config_dir, fluideq_engine::AnalysisLink* analysis)
    : config_dir_(std::move(config_dir)), analysis_(analysis) {}

Engine::~Engine() { release_all(); }

std::optional<fluideq_engine::SongReport> Engine::last_song() const {
  return leveling_ ? leveling_->last_song() : std::nullopt;
}

bool Engine::follow_programme() noexcept {
  if (!leveling_) {
    return false;
  }
  try {
    const auto name = fluideq_engine::endpoint_config_name(
        fluideq_engine::kProgrammeFileStem,
        fluideq_engine::Endpoint{leveling_endpoint_, {}});
    const std::optional<std::string> text = name
        ? read_config_file(config_dir_ + L"\\" + *name) : std::nullopt;
    // No file is no song: the app deletes it on quit, and silence is then
    // what ends a programme — the Windows effect's own rule.
    return leveling_->announce(text ? fluideq_engine::parse_programme(*text)
                                    : fluideq_engine::Programme{});
  } catch (...) {
    return false;  // A song not followed levels like a source with no title.
  }
}

ReloadResult Engine::reload(const fluideq_engine::Endpoint& endpoint,
                            const EngineFormat& format) {
  reclaim();
  // The app's display connection, if it is not up: the effect asks again on
  // every reload too, which is how a window opened after the engine started
  // gets its meters without anything waiting on a clock.
  if (analysis_ != nullptr) {
    analysis_->retry();
  }

  ReloadResult result;
  // Kept per output for the life of this process, so a song learned on the
  // headphones is still learned when they come back from the speakers.
  if (!leveling_ || leveling_endpoint_ != endpoint.guid) {
    leveling_ = fluideq_engine::leveling_for(endpoint.guid);
    leveling_endpoint_ = endpoint.guid;
  }
  // Before the comparison and outside the signature: a new song is a change
  // worth reading on every wake, and never one worth a new chain.
  result.finished_song = follow_programme();

  // Everything the resolver opened, byte for byte, with the output and the
  // format beside it. The watch wakes this for every file the app writes —
  // its temporary files included — and most of those wakes change nothing
  // the graph is made of; rebuilding anyway would re-prime every filter for
  // a configuration that is the same one.
  std::string seen;
  const fluideq_engine::FileProvider provider =
      [&seen](const std::wstring& path) {
        std::optional<std::string> text = read_config_file(path);
        seen += fluideq_engine::posix_path(path);
        seen.push_back('\0');
        if (text) {
          seen += *text;
        } else {
          // A byte no text file FluidEQ writes contains, so "absent" can
          // never be confused with a file whose contents are that word.
          seen.push_back('\x01');
        }
        seen.push_back('\0');
        return text;
      };
  const fluideq_engine::Chain chain =
      fluideq_engine::resolve_chain(config_dir_, endpoint, provider);
  // The room's head, beside the rack file, read through the same provider so
  // a new head is a change like any other file. No file is no head, which the
  // rack reports as a room it cannot build.
  std::optional<fluideq_engine::RoomHead> head;
  // Main writes a head per output. The retired shared file must never supply
  // another output's head when this one has none.
  const auto head_name = fluideq_engine::endpoint_config_name(
      fluideq_engine::kRoomHeadFileStem, endpoint);
  if (const std::optional<std::string> text = head_name
          ? provider(config_dir_ + L"\\" + *head_name) : std::nullopt) {
    head = fluideq_engine::parse_room_head(
        *text, static_cast<double>(format.sample_rate));
  }

  std::string next = std::move(seen);
  next += fluideq_engine::posix_path(endpoint.guid);
  next += '|';
  next += std::to_string(format.sample_rate);
  next += '|';
  next += std::to_string(format.max_frames);

  if (have_signature_ && next == signature_) {
    result.processing = processing_;
    result.matched = matched_;
    return result;
  }

  // No channel mask: the tap is a stereo mixdown, which is what a plain
  // two-channel format means to the rack — the front pair, and no subwoofer
  // feed for the exciter to leave alone.
  auto graph = std::make_unique<fluideq_engine::Graph>(
      chain, format.sample_rate, kEngineChannels, format.max_frames,
      leveling_ ? leveling_->memory() : nullptr, 0,
      head ? &*head : nullptr);
  graph->request_state_transfer();

  result.rebuilt = true;
  result.processing = !graph->is_passthrough();
  result.matched = chain.matched;
  result.warnings = graph->warnings();
  result.problems = graph->problems();
  result.room_note = graph->room_note();

  // Like the delay itself: passing the sound through, nothing runs in any
  // mode, and a page saying "game mode" over a chain that is not playing
  // would be describing the configuration, not the sound.
  GraphFacts facts;
  facts.processing = result.processing;
  facts.problems = graph->problems();
  facts.room = graph->room_state();
  if (result.processing) {
    facts.latency = graph->latency_frames();
    facts.latency_parts = latency_parts_of(*graph);
    facts.latency_active = graph->active_stages();
    facts.game_mode = graph->low_latency();
  }

  if (analysis_ != nullptr) {
    graph->set_meters(analysis_->meters(), analysis_->activity());
    graph->set_output_meters(&analysis_->output_gain,
                             &analysis_->output_enabled,
                             &analysis_->output_active);
  }
  chunk_frames_.store(format.max_frames, std::memory_order_relaxed);
  publish(std::move(graph));
  signature_.swap(next);
  have_signature_ = true;
  processing_ = result.processing;
  matched_ = result.matched;
  facts_ = std::move(facts);
  return result;
}

void Engine::publish(std::unique_ptr<fluideq_engine::Graph> graph) {
  // Ownership is recorded before the graph becomes reachable: if this
  // allocation throws, the unique_ptr still holds the only reference and
  // frees it, and the audio thread never saw it.
  owned_.push_back(fluideq_engine::OwnedGraph{graph.get(), 0});
  fluideq_engine::Graph* const raw = graph.release();

  fluideq_engine::Graph* const unconsumed = slot_.publish(raw);
  // Read after the exchange: a block that increments this counter from here
  // on cannot have adopted anything older than what was just published.
  owned_.back().blocks_at_publish = slot_.blocks();

  if (unconsumed != nullptr) {
    // Taken back out of `pending` unread, which is proof the audio thread
    // never adopted it — a band dragged with nothing playing.
    const auto found = std::find_if(
        owned_.begin(), owned_.end(),
        [unconsumed](const fluideq_engine::OwnedGraph& at) {
          return at.graph == unconsumed;
        });
    if (found != owned_.end()) {
      delete found->graph;
      owned_.erase(found);
    }
  }
  reclaim();
}

void Engine::reclaim() noexcept {
  fluideq_engine::reclaim_graphs(owned_, slot_.blocks());
}

void Engine::release_all() noexcept {
  slot_.clear();
  for (const fluideq_engine::OwnedGraph& retired : owned_) {
    delete retired.graph;
  }
  owned_.clear();
  have_signature_ = false;
  processing_ = false;
  matched_ = false;
  facts_ = GraphFacts{};
  chunk_frames_.store(0, std::memory_order_relaxed);
}

void Engine::process(float* const* planar, uint32_t frames) noexcept {
  fluideq_engine::Graph* const graph = slot_.adopt();
  const uint32_t chunk = chunk_frames_.load(std::memory_order_relaxed);
  if (graph != nullptr) {
    // Every block, as the effect does, so the DSP page stops on the last
    // frame of music rather than freezing on it when there is none.
    graph->report_meter_activity(chunk > 0 && !graph->is_passthrough());
  }
  if (graph != nullptr && chunk > 0 && !graph->is_passthrough()) {
    float* pieces[kEngineChannels];
    for (uint32_t done = 0; done < frames;) {
      const uint32_t now = std::min(chunk, frames - done);
      for (uint32_t channel = 0; channel < kEngineChannels; ++channel) {
        pieces[channel] = planar[channel] + done;
      }
      graph->process(pieces, now);
      done += now;
    }
  }
  slot_.finish_block();
}

}  // namespace fluideq_mac
