/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "leveling_board.h"

#include <map>

namespace fluideq_engine {

namespace {

struct Board {
  std::mutex mutex;
  std::map<std::wstring, std::shared_ptr<Leveling>> outputs;
};

Board& board() {
  static Board instance;
  return instance;
}

}  // namespace

Leveling::Leveling()
    : memory_(feq_leveling_memory_create(),
              [](FeqLevelingMemory* memory) { feq_leveling_memory_destroy(memory); }) {}

bool Leveling::announce(const Programme& programme) {
  if (!memory_) {
    return false;
  }
  const std::lock_guard<std::mutex> guard(mutex_);
  FeqSongLevel finished{};
  const bool learned = feq_leveling_memory_read_song(memory_.get(), &finished) != 0;
  if (feq_leveling_memory_begin_song(memory_.get(), programme.song_id,
                                     programme.level_lufs, programme.peak_db) == 0) {
    return false;
  }
  if (!learned || finished.song_id == programme.song_id) {
    return false;
  }
  last_ = SongReport{finished.song_id, finished.level_lufs, finished.peak_db,
                     finished.foreground_seconds};
  return true;
}

std::optional<SongReport> Leveling::last_song() const {
  const std::lock_guard<std::mutex> guard(mutex_);
  return last_;
}

std::shared_ptr<Leveling> leveling_for(const std::wstring& endpoint) {
  if (endpoint.empty()) {
    return std::make_shared<Leveling>();
  }
  Board& shared = board();
  const std::lock_guard<std::mutex> guard(shared.mutex);
  auto& slot = shared.outputs[endpoint];
  if (!slot) {
    slot = std::make_shared<Leveling>();
  }
  return slot;
}

}  // namespace fluideq_engine
