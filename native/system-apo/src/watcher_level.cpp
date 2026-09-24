/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The watcher's side of Auto normalize's level for an edit: keeping the
 * music it is judged on, asking for the level before a graph is published,
 * and telling the predictor what was. Split from `watcher.cpp`, which gets a
 * graph onto the audio thread; this only decides what level that graph
 * starts at (`level_prediction.h`).
 */

#include <cstdio>
#include <exception>
#include <memory>
#include <string>

#include "watcher.h"

namespace fluideq_engine {

void Watcher::open_level_prediction() {
  try {
    history_ = std::make_unique<InputHistory>(sample_rate_, channels_,
                                              kLevelHistorySeconds);
    predictor_ = std::make_unique<LevelPredictor>(sample_rate_, channels_,
                                                  history_->window_frames());
  } catch (...) {
    history_.reset();
    predictor_.reset();
    log_.write("level prediction unavailable; each edit's level is found "
               "the old way");
  }
}

void Watcher::predict_level(const Chain& chain, Graph& graph) {
  level_note_.clear();
  if (!predictor_ || !history_) {
    return;
  }
  // Whatever goes wrong here, the edit is published: a level found the old
  // way is a worse level, while an edit held back is an edit not heard.
  try {
    const auto level = predictor_->predict(
        chain, *history_, [this] { return stop_requested(); });
    if (!level) {
      return;
    }
    graph.plan_level_shift(level->shift_db, last_published_);
    char note[64] = {};
    const int written =
        std::snprintf(note, sizeof(note), "%+.2f dB from %.1f s of music",
                      level->shift_db, level->seconds);
    if (written > 0) {
      level_note_.assign(note, static_cast<size_t>(written));
    }
  } catch (const std::exception& error) {
    log_.write(std::string("level prediction failed: ") + error.what());
  } catch (...) {
    log_.write("level prediction failed");
  }
}

void Watcher::accept_level(const Chain& chain) {
  if (!predictor_) {
    return;
  }
  try {
    predictor_->accept(chain, history_ ? history_->written() : 0);
  } catch (...) {
    // Half-accepted, the predictor would judge the next edit against a chain
    // that is not playing: without it, edits find their level the old way.
    predictor_.reset();
    log_.write("level prediction stopped: it could not keep up with the "
               "chain now playing");
  }
}

}  // namespace fluideq_engine
