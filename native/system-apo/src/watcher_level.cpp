/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The watcher's side of Auto normalize's level for an edit: keeping the
 * music it is judged on, saying before a graph is published whether a level
 * will follow it, working that level out once the graph is playing, and
 * telling the predictor which chain the level was settled for. Split from
 * `watcher.cpp`, which gets a graph onto the audio thread; this only decides
 * the level that graph plays at (`level_prediction.h`, `level_mailbox.h`).
 */

#include <cstdio>
#include <exception>
#include <limits>
#include <memory>
#include <string>
#include <string_view>

#include "watcher.h"

namespace fluideq_engine {

namespace {

/** A level with nothing to go on: the audio thread finds it the old way. */
constexpr float kNoLevel = std::numeric_limits<float>::quiet_NaN();

}  // namespace

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

bool Watcher::plan_level(const Chain& chain, Graph& graph) {
  if (!predictor_ || !history_) {
    return false;
  }
  try {
    if (predictor_->judge(chain) == LevelPredictor::Judgement::kNone) {
      return false;
    }
  } catch (...) {
    // Judging builds two signatures and nothing else; out of memory for
    // those, the edit's level is found the old way.
    log_.write("level prediction skipped: out of memory");
    return false;
  }
  generation_ = generation_ == UINT32_MAX ? 1u : generation_ + 1u;
  graph.expect_level(&level_mailbox_, generation_);
  return true;
}

void Watcher::owe_level(const Chain& chain, bool owed) {
  const uint64_t heard = history_ ? history_->written() : 0;
  if (!owed) {
    // Nothing will be sent, and this chain is what the next edit is judged
    // against.
    owed_level_.reset();
    others_from_ = UINT64_MAX;
    accept_level(chain, heard);
    return;
  }
  if (others_from_ == UINT64_MAX) {
    others_from_ = heard;
  }
  try {
    owed_level_ = OwedLevel{chain, generation_, heard};
  } catch (...) {
    // The graph is playing and holding its level for one that would now
    // never come: tell it at once to find its own.
    owed_level_.reset();
    level_mailbox_.post(generation_, kNoLevel);
    log_.write("level prediction skipped: out of memory");
  }
}

void Watcher::settle_level() {
  if (!owed_level_) {
    return;
  }
  float shift_db = kNoLevel;
  if (predictor_ && history_) {
    const auto superseded = [this] { return stop_requested() || change_pending(); };
    try {
      switch (predictor_->judge(owed_level_->chain)) {
        case LevelPredictor::Judgement::kNone:
          break;
        case LevelPredictor::Judgement::kSame:
          // Back to the EQ the level was last settled for, as a drag that
          // returns to where it started: that level again.
          shift_db = 0.0f;
          break;
        case LevelPredictor::Judgement::kChanged: {
          const auto level = predictor_->predict(owed_level_->chain, *history_,
                                                 superseded, others_from_);
          if (!level) {
            if (superseded()) {
              // Still owed: the next wake publishes the newer edit, or finds
              // nothing new and starts this one again.
              return;
            }
            break;
          }
          shift_db = static_cast<float>(level->shift_db);
          char note[64] = {};
          const int written =
              std::snprintf(note, sizeof(note), "level %+.2f dB from %.1f s of music",
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

void Watcher::accept_level(const Chain& chain, uint64_t heard_frames) {
  if (!predictor_) {
    return;
  }
  try {
    predictor_->accept(chain, heard_frames);
  } catch (...) {
    // Half-accepted, the predictor would judge the next edit against a chain
    // that is not playing: without it, edits find their level the old way.
    predictor_.reset();
    log_.write("level prediction stopped: it could not keep up with the "
               "chain now playing");
  }
}

}  // namespace fluideq_engine
