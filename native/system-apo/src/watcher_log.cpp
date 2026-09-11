/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// What the watcher tells `engine.log` about each graph it publishes. Its own
// file because `watcher.cpp` is about threads and handovers, and this is only
// ever about words.

#include "watcher.h"

#include <algorithm>
#include <string>
#include <vector>

#include "paths.h"

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

}  // namespace fluideq_engine
