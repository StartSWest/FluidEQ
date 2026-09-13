/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// What the watcher tells others about the graphs it publishes: `engine.log`,
// and the status file the app reads. Its own file because `watcher.cpp` is
// about threads and handovers, and this is only ever about saying so.

#include "watcher.h"

#include <algorithm>
#include <cstdio>
#include <optional>
#include <string>
#include <vector>

#include "config_file.h"
#include "paths.h"
#include "programme.h"
#include "status_file.h"

namespace fluideq_engine {

namespace {

// The `ignored` line is emitted once per distinct set. The cap stops a config
// being rewritten with a different stray command every second from growing
// this list without bound; a machine that reaches it has already told the log
// everything it had to say.
constexpr size_t kMaxIgnoredSetsLogged = 32;

std::string join(const std::vector<std::string>& items) {
  std::string out;
  for (const std::string& item : items) {
    if (!out.empty()) {
      out += ", ";
    }
    out += item;
  }
  return out;
}

}  // namespace

void Watcher::log_chain(const Chain& chain, const Graph& graph,
                        bool owner_present) {
  std::string files;
  for (const std::wstring& file : chain.files_read) {
    if (!files.empty()) {
      files += ", ";
    }
    files += to_utf8(file_name_of(file));
  }
  std::string line = "chain loaded: files=" +
                     std::to_string(chain.files_read.size());
  if (!files.empty()) {
    line += " (" + files + ")";
  }
  line += " bands=" + std::to_string(chain.bands.size());
  line += " graphic_curves=" + std::to_string(chain.graphic_curves.size());
  line += " preamp=" + decibels(chain.preamp_db) + " dB";
  line += " ir=" + (chain.convolution_path.empty()
                        ? std::string("none")
                        : to_utf8(chain.convolution_path));
  line += " rack=" + (chain.dsp_values.empty()
                          ? std::string("none")
                          : std::to_string(chain.dsp_values.size()) +
                                " values");
  line += " latency=" + std::to_string(graph.latency_frames()) + " frames";
  log_.write(line);

  for (const std::string& warning : graph.warnings()) {
    log_.write("graph warning: " + warning);
  }

  if (!chain.ignored.empty() &&
      logged_ignored_.size() < kMaxIgnoredSetsLogged) {
    const std::string set = join(chain.ignored);
    const bool seen = std::find(logged_ignored_.begin(), logged_ignored_.end(),
                                set) != logged_ignored_.end();
    if (!seen) {
      // Recorded before it is written, so reaching the cap silences the line
      // rather than turning it into one entry per reload.
      logged_ignored_.push_back(set);
      log_.write("ignored commands (this engine does not run them): " + set);
    }
  }

  std::string reason;
  if (graph.is_passthrough()) {
    if (!owner_present) {
      reason = "FluidEQ is not running";
    } else if (!is_directory(config_dir_)) {
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
    if (!reason.empty()) {
      log_.write("pass-through: " + reason);
    } else {
      log_.write("processing this endpoint");
    }
  }
}

void Watcher::report_status(bool locked) noexcept {
  try {
    bool written = true;
    if (!locked) {
      written = status_.leave();
    } else if (!endpoint_.guid.empty()) {  // Else nothing to match it to.
      EngineStatus status;
      status.endpoint = endpoint_.guid;
      status.locked = true;
      status.processing = last_processing_;
      status.owner = last_owner_;
      status.reason = passthrough_reason_;
      status.problems = graph_problems_;
      if (reload_failed_) {
        status.problems.push_back("reload-failed");
      }
      if (unwatched_) {
        status.problems.push_back("unwatched");
      }
      if (const auto song = leveling_ ? leveling_->last_song() : std::nullopt) {
        char id[17] = {};
        std::snprintf(id, sizeof(id), "%016llx",
                      static_cast<unsigned long long>(song->song_id));
        status.last_song = EngineStatus::FinishedSong{
            id, song->level_lufs, song->peak_db, song->seconds};
      }
      written = status_.publish(status);
    }
    if (!written && !status_failure_logged_) {
      status_failure_logged_ = true;
      log_.write("could not write this output's status for the app");
    }
  } catch (...) {
    // A status the app never sees costs its notice, not the audio.
  }
}

bool Watcher::follow_programme() noexcept {
  if (!leveling_) {
    return false;
  }
  try {
    const std::optional<std::string> text =
        read_config_file(config_dir_ + L"\\" + kProgrammeFileName);
    // No file is no song: the app deletes it on quit and writes nothing under
    // Equalizer APO, and silence is then what ends a programme.
    return leveling_->announce(text ? parse_programme(*text) : Programme{});
  } catch (...) {
    return false;  // A song not followed levels like a source with no title.
  }
}

}  // namespace fluideq_engine
