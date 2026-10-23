/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Linux watcher's level for an edit, its log lines, its status file and
 * the song it follows — the Windows watcher's `watcher_level.cpp` and
 * `watcher_log.cpp`, with the same words and fields so the app and a bug
 * report read both platforms alike.
 */

#include <algorithm>
#include <cstdio>
#include <exception>
#include <limits>
#include <string>
#include <string_view>

#include "config_file.h"
#include "output_watcher.h"
#include "paths.h"
#include "programme.h"

namespace fluideq_linux {

using fluideq_engine::Chain;
using fluideq_engine::EngineStatus;
using fluideq_engine::InputHistory;
using fluideq_engine::LevelPredictor;

namespace {

constexpr float kNoLevel = std::numeric_limits<float>::quiet_NaN();
constexpr size_t kMaxIgnoredSetsLogged = 32;

std::string join(const std::vector<std::string>& items) {
  std::string out;
  for (const std::string& item : items) {
    if (!out.empty()) out += ", ";
    out += item;
  }
  return out;
}

}  // namespace

void OutputWatcher::open_level_prediction() {
  try {
    history_ = std::make_shared<InputHistory>(
        sample_rate_, channels_, fluideq_engine::kLevelHistorySeconds);
    predictor_ = std::make_unique<LevelPredictor>(sample_rate_, channels_,
                                                  history_->window_frames());
  } catch (...) {
    history_.reset();
    predictor_.reset();
    log_.write("level prediction unavailable; each edit's level is found "
               "the old way");
  }
}

bool OutputWatcher::plan_level(const Chain& chain, Graph& graph) {
  if (!predictor_ || !history_) return false;
  try {
    if (predictor_->judge(chain) == LevelPredictor::Judgement::kNone) {
      return false;
    }
  } catch (...) {
    log_.write("level prediction skipped: out of memory");
    return false;
  }
  generation_ = generation_ == UINT32_MAX ? 1u : generation_ + 1u;
  graph.expect_level(&level_mailbox_, generation_);
  return true;
}

void OutputWatcher::owe_level(const Chain& chain, bool owed) {
  const uint64_t heard = history_ ? history_->written() : 0;
  if (!owed) {
    owed_level_.reset();
    others_from_ = UINT64_MAX;
    accept_level(chain, heard);
    return;
  }
  if (others_from_ == UINT64_MAX) others_from_ = heard;
  try {
    owed_level_ = OwedLevel{chain, generation_, heard};
  } catch (...) {
    owed_level_.reset();
    level_mailbox_.post(generation_, kNoLevel);
    log_.write("level prediction skipped: out of memory");
  }
}

void OutputWatcher::settle_level() {
  if (!owed_level_) return;
  float shift_db = kNoLevel;
  if (predictor_ && history_) {
    const auto superseded = [this] {
      return stop_requested() || change_pending();
    };
    try {
      switch (predictor_->judge(owed_level_->chain)) {
        case LevelPredictor::Judgement::kNone:
          break;
        case LevelPredictor::Judgement::kSame:
          shift_db = 0.0f;
          break;
        case LevelPredictor::Judgement::kChanged: {
          const auto level = predictor_->predict(owed_level_->chain, *history_,
                                                 superseded, others_from_);
          if (!level) {
            if (superseded()) return;  // Still owed; the next wake retries.
            break;
          }
          shift_db = static_cast<float>(level->shift_db);
          char note[64] = {};
          const int written = std::snprintf(
              note, sizeof(note), "level %+.2f dB from %.1f s of music",
              level->shift_db, level->seconds);
          if (written > 0) {
            log_.write(std::string_view(note, static_cast<size_t>(written)));
          }
          break;
        }
      }
    } catch (const std::exception& error) {
      log_.write(std::string("level prediction failed: ") + error.what());
    } catch (...) {
      log_.write("level prediction failed");
    }
  }
  level_mailbox_.post(owed_level_->generation, shift_db);
  accept_level(owed_level_->chain, owed_level_->published_at);
  owed_level_.reset();
  others_from_ = UINT64_MAX;
}

void OutputWatcher::accept_level(const Chain& chain, uint64_t heard_frames) {
  if (!predictor_) return;
  try {
    predictor_->accept(chain, heard_frames);
  } catch (...) {
    predictor_.reset();
    log_.write("level prediction stopped: it could not keep up with the "
               "chain now playing");
  }
}

void OutputWatcher::log_chain(const Chain& chain, const Graph& graph) {
  std::string files;
  for (const std::wstring& file : chain.files_read) {
    if (!files.empty()) files += ", ";
    files += fluideq_engine::to_utf8(fluideq_engine::file_name_of(file));
  }
  std::string line =
      "chain loaded: files=" + std::to_string(chain.files_read.size());
  if (!files.empty()) line += " (" + files + ")";
  line += " bands=" + std::to_string(chain.bands.size());
  line += " graphic_curves=" + std::to_string(chain.graphic_curves.size());
  line += " preamp=" + fluideq_engine::decibels(chain.preamp_db) + " dB";
  line += " ir=" + (chain.convolution_path.empty()
                        ? std::string("none")
                        : fluideq_engine::to_utf8(chain.convolution_path));
  line += " rack=" + (chain.dsp_values.empty()
                          ? std::string("none")
                          : std::to_string(chain.dsp_values.size()) + " values");
  line += " latency=" + std::to_string(graph.latency_frames()) + " frames";
  log_.write(line);

  for (const std::string& warning : graph.warnings()) {
    log_.write("graph warning: " + warning);
  }
  if (!chain.ignored.empty() &&
      logged_ignored_.size() < kMaxIgnoredSetsLogged) {
    const std::string set = join(chain.ignored);
    if (std::find(logged_ignored_.begin(), logged_ignored_.end(), set) ==
        logged_ignored_.end()) {
      logged_ignored_.push_back(set);
      log_.write("ignored commands (this engine does not run them): " + set);
    }
  }

  std::string reason;
  if (graph.is_passthrough()) {
    if (!fluideq_engine::is_directory(config_dir_)) {
      reason = "no configuration directory";
    } else if (chain.files_read.empty()) {
      reason = "no config.txt in the configuration directory";
    } else if (!chain.matched) {
      reason = "no configuration block names this endpoint";
    } else {
      reason = "the configuration asks for nothing on this endpoint";
    }
  }
  if (!have_passthrough_reason_ || reason != passthrough_reason_) {
    passthrough_reason_ = reason;
    have_passthrough_reason_ = true;
    log_.write(reason.empty() ? std::string("processing this endpoint")
                              : "pass-through: " + reason);
  }
}

void OutputWatcher::log_timing() noexcept {
  try {
    const auto timing = fluideq_engine::output_block_timing(endpoint_.guid);
    if (!timing) return;
    const fluideq_engine::BlockTiming::Reading reading = timing->read();
    const uint32_t step = fluideq_engine::timing_step(reading.slowest_permille);
    if (reading.blocks == 0 || step <= timing_step_logged_) return;
    timing_step_logged_ = step;
    log_.write(fluideq_engine::describe_timing(reading));
  } catch (...) {
    // A line the log never gets costs the report, not the audio.
  }
}

void OutputWatcher::report_status(bool locked) noexcept {
  try {
    bool written = true;
    std::string why;
    if (!locked) {
      written = status_.leave(&why);
    } else if (!endpoint_.guid.empty()) {
      EngineStatus status;
      status.endpoint = endpoint_.guid;
      status.locked = true;
      status.processing = last_processing_;
      status.owner = true;  // This engine only runs as FluidEQ's child.
      status.reason = passthrough_reason_;
      status.problems = graph_problems_;
      status.channels = channels_;
      status.room = room_state_;
      status.rate = sample_rate_;
      status.latency = latency_;
      status.latency_parts = latency_parts_;
      status.latency_active = latency_active_;
      status.game_mode = game_mode_;
      if (const auto carried = fluideq_engine::output_carried_flag(endpoint_.guid)) {
        status.carried = carried->load(std::memory_order_relaxed);
      }
      if (const auto timing = fluideq_engine::output_block_timing(endpoint_.guid)) {
        const fluideq_engine::BlockTiming::Reading reading = timing->read();
        if (reading.blocks > 0) status.load = reading;
      }
      if (reload_failed_) status.problems.push_back("reload-failed");
      if (unwatched_) status.problems.push_back("unwatched");
      if (const auto song = leveling_ ? leveling_->last_song() : std::nullopt) {
        char id[17] = {};
        std::snprintf(id, sizeof(id), "%016llx",
                      static_cast<unsigned long long>(song->song_id));
        status.last_song = EngineStatus::FinishedSong{
            id, song->level_lufs, song->peak_db, song->seconds};
      }
      written = status_.publish(status, &why);
    }
    if (written) {
      status_failure_logged_ = false;
    } else if (!status_failure_logged_) {
      status_failure_logged_ = true;
      log_.write("could not write this output's status for the app (" + why +
                 ")");
    }
  } catch (...) {
    // A status the app never sees costs its notice, not the audio.
  }
}

bool OutputWatcher::follow_programme() noexcept {
  if (!leveling_) return false;
  try {
    const std::optional<std::string> text =
        read_endpoint_file(fluideq_engine::kProgrammeFileStem);
    return leveling_->announce(text ? fluideq_engine::parse_programme(*text)
                                    : fluideq_engine::Programme{});
  } catch (...) {
    return false;
  }
}

}  // namespace fluideq_linux
