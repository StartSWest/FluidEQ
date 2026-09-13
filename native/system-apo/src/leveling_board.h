/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One leveling memory per output, for as long as audiodg.exe lives.
 *
 * Windows unlocks an output's effect and locks a new one whenever a stream
 * starts, stops or changes format, and each lock is a new `Watcher` with new
 * graphs. The memory is what the rack's live leveling keeps across all of
 * that (`fluideq/leveling_memory.h`), so it belongs to the output, not to any
 * one watcher — and several instances locked on the same output at once share
 * it, the way they share the output's status file.
 *
 * Never freed while the process runs. An output that comes back an hour later
 * should find what it learned, and a machine has a handful of outputs.
 */
#ifndef FLUIDEQ_ENGINE_LEVELING_BOARD_H
#define FLUIDEQ_ENGINE_LEVELING_BOARD_H

#include <cstdint>
#include <memory>
#include <mutex>
#include <optional>
#include <string>

#include "fluideq/leveling_memory.h"
#include "programme.h"

namespace fluideq_engine {

/** A song the leveler finished learning, for the app to remember it by. */
struct SongReport {
  uint64_t song_id = 0;
  double level_lufs = -120;
  double peak_db = -120;
  double seconds = 0;
};

class Leveling {
 public:
  Leveling();
  Leveling(const Leveling&) = delete;
  Leveling& operator=(const Leveling&) = delete;

  /** For a graph to hold while its rack uses the memory. Null if allocation failed. */
  std::shared_ptr<FeqLevelingMemory> memory() const noexcept { return memory_; }

  /**
   * Watcher thread: the programme the app says is playing now. True when this
   * call ended a named song, whose report `last_song` now holds.
   *
   * The report is taken before the announcement reaches the audio thread, so
   * it is the finished song's own and not the start of the next one. A title
   * that flickers out and back is the same song, and ends nothing.
   */
  bool announce(const Programme& programme);

  std::optional<SongReport> last_song() const;

 private:
  std::shared_ptr<FeqLevelingMemory> memory_;
  mutable std::mutex mutex_;
  std::optional<SongReport> last_;
};

/**
 * The output's leveling, made on first use. An endpoint with no identity gets
 * one of its own: without an id there is nothing to say it is the same output.
 */
std::shared_ptr<Leveling> leveling_for(const std::wstring& endpoint);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_LEVELING_BOARD_H
