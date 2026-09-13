/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#ifndef FLUIDEQ_LEVELING_MEMORY_INTERNAL_H
#define FLUIDEQ_LEVELING_MEMORY_INTERNAL_H
#include "fluideq/leveling_memory.h"
#include <array>
#include <atomic>
#include <cstdint>
#include <mutex>

/* Everything one leveler has decided, and all of it is what a successor adopts. */
struct FeqLevelingState {
  uint64_t cue_seen = 0;  // sequence of the last announcement acted on
  uint64_t song_id = 0;
  double gain_db = 0;     // applied now
  double target_db = 0;   // where the gain is heading
  double song_level = -120;
  double song_peak_db = -120;
  double settled_level = -120;
  double settled_peak_db = -120;
  double foreground_seconds = 0;
  bool established = false;  // a gain has been decided from music or memory
  bool named = false;        // the programme has a song identity right now
  bool known = false;        // the song's level came from an earlier play
  bool glide = false;        // a remembered level is still being reached
};

inline constexpr std::size_t kLevelingWords = 10;

struct FeqLevelingMemory {
  // Announcements come from watcher threads, several per output; the audio
  // thread only ever reads them, by sequence, so the lock is never its to take.
  std::mutex announcer;
  std::atomic<uint64_t> cue_sequence{0};
  std::atomic<uint64_t> cue_id{0};
  std::atomic<uint64_t> cue_level{0};
  std::atomic<uint64_t> cue_peak{0};
  // Published by audio threads. A writer claims the odd sequence by exchange
  // and gives up the block rather than wait when another holds it.
  std::atomic<uint64_t> learned_sequence{0};
  std::array<std::atomic<uint64_t>, kLevelingWords> learned{};
};

namespace feq_leveling {
enum class Read { busy, empty, ready };
struct Cue {
  uint64_t sequence;
  uint64_t song_id;
  double level_lufs;
  double peak_db;
};
/* Audio thread. No lock, no allocation, no wait. */
bool read_cue(const FeqLevelingMemory& memory, Cue& out) noexcept;
Read read_learned(const FeqLevelingMemory& memory, FeqLevelingState& out) noexcept;
/* `valid` false says nothing is learned: a leveler switched to another mode. */
bool publish(FeqLevelingMemory& memory, const FeqLevelingState& state, bool valid) noexcept;
}

#endif
