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
  double control_target_lufs = -120;
  double control_ceiling_db = -120;
  bool retarget_pending = false;
  bool established = false;  // a gain has been decided from music or memory
  bool named = false;        // the programme has a song identity right now
  bool known = false;        // the song's level came from an earlier play
  bool glide = false;        // a remembered level is still being reached
  // Learned by True Peak, whose gain is the song's peak room and no loudness
  // level's: a leveler in the other mode adopts nothing from it.
  bool peak_mode = false;
};

inline constexpr std::size_t kLevelingWords = 12;

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
  // The Maximizer's platform and the push it was settled under, as two
  // floats in one word (`feq_leveling::remember_platform`). All ones: nothing
  // settled yet — two NaNs, no platform a limiter could reach.
  std::atomic<uint64_t> platform{~uint64_t{0}};
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
/*
 * The Maximizer's platform on this output, for the next chain Windows builds
 * on it: the reduction a driven record had settled at, and the push behind it
 * — the drive over the ceiling, in dB. Audio thread; one relaxed store.
 */
void remember_platform(FeqLevelingMemory& memory, double platform_db, double push_db) noexcept;
/*
 * Where a new chain's platform starts under a push of `push_db`: the one
 * remembered, deeper or shallower by however much more or less this chain
 * pushes into its ceiling, and never above 0 dB. Nothing remembered: 0 dB,
 * where every chain used to start.
 */
double platform_start(const FeqLevelingMemory& memory, double push_db) noexcept;
}

#endif
