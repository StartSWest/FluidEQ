/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#include "leveling_memory_internal.h"
#include <bit>
#include <cmath>
#include <memory>
#include <new>
#include <thread>

namespace {
constexpr uint64_t kValid = 1, kEstablished = 2, kNamed = 4, kKnown = 8, kGlide = 16;
constexpr int kControlAttempts = 1024;

uint64_t word(double value) noexcept { return std::bit_cast<uint64_t>(value); }
double number(uint64_t value) noexcept { return std::bit_cast<double>(value); }
}

namespace feq_leveling {
bool read_cue(const FeqLevelingMemory& memory, Cue& out) noexcept {
  const uint64_t before = memory.cue_sequence.load(std::memory_order_acquire);
  if ((before & 1) != 0) return false;
  out.sequence = before;
  out.song_id = memory.cue_id.load(std::memory_order_acquire);
  out.level_lufs = number(memory.cue_level.load(std::memory_order_acquire));
  out.peak_db = number(memory.cue_peak.load(std::memory_order_acquire));
  return memory.cue_sequence.load(std::memory_order_acquire) == before;
}

Read read_learned(const FeqLevelingMemory& memory, FeqLevelingState& out) noexcept {
  const uint64_t before = memory.learned_sequence.load(std::memory_order_acquire);
  if ((before & 1) != 0) return Read::busy;
  std::array<uint64_t, kLevelingWords> words{};
  for (std::size_t at = 0; at < kLevelingWords; ++at)
    words[at] = memory.learned[at].load(std::memory_order_acquire);
  if (memory.learned_sequence.load(std::memory_order_acquire) != before) return Read::busy;
  const uint64_t flags = words[9];
  if ((flags & kValid) == 0) return Read::empty;
  out.cue_seen = words[0];
  out.song_id = words[1];
  out.gain_db = number(words[2]);
  out.target_db = number(words[3]);
  out.song_level = number(words[4]);
  out.song_peak_db = number(words[5]);
  out.settled_level = number(words[6]);
  out.settled_peak_db = number(words[7]);
  out.foreground_seconds = number(words[8]);
  out.established = (flags & kEstablished) != 0;
  out.named = (flags & kNamed) != 0;
  out.known = (flags & kKnown) != 0;
  out.glide = (flags & kGlide) != 0;
  return Read::ready;
}

bool publish(FeqLevelingMemory& memory, const FeqLevelingState& state, bool valid) noexcept {
  uint64_t sequence = memory.learned_sequence.load(std::memory_order_acquire);
  if ((sequence & 1) != 0 ||
      !memory.learned_sequence.compare_exchange_strong(sequence, sequence + 1,
          std::memory_order_acq_rel, std::memory_order_acquire)) {
    return false;
  }
  const std::array<uint64_t, kLevelingWords> words = {
      state.cue_seen, state.song_id, word(state.gain_db), word(state.target_db),
      word(state.song_level), word(state.song_peak_db), word(state.settled_level),
      word(state.settled_peak_db), word(state.foreground_seconds),
      valid ? kValid | (state.established ? kEstablished : 0) | (state.named ? kNamed : 0) |
                  (state.known ? kKnown : 0) | (state.glide ? kGlide : 0)
            : 0};
  for (std::size_t at = 0; at < kLevelingWords; ++at)
    memory.learned[at].store(words[at], std::memory_order_release);
  memory.learned_sequence.store(sequence + 2, std::memory_order_release);
  return true;
}
}

extern "C" {
FeqLevelingMemory* feq_leveling_memory_create(void) {
  auto memory = std::unique_ptr<FeqLevelingMemory>(new (std::nothrow) FeqLevelingMemory());
  if (memory == nullptr) return nullptr;
  // A double's bits, not zero: an announcement nobody made reads as unknown.
  memory->cue_level.store(word(-120), std::memory_order_relaxed);
  memory->cue_peak.store(word(-120), std::memory_order_relaxed);
  return memory.release();
}

void feq_leveling_memory_destroy(FeqLevelingMemory* memory) { delete memory; }

int feq_leveling_memory_begin_song(FeqLevelingMemory* memory, uint64_t song_id,
                                   double known_level_lufs, double known_peak_db) {
  if (memory == nullptr) return 0;
  const std::lock_guard<std::mutex> guard(memory->announcer);
  const uint64_t sequence = memory->cue_sequence.load(std::memory_order_acquire);
  if (sequence != 0 && memory->cue_id.load(std::memory_order_acquire) == song_id) return 0;
  memory->cue_sequence.store(sequence + 1, std::memory_order_release);
  memory->cue_id.store(song_id, std::memory_order_release);
  memory->cue_level.store(word(std::isfinite(known_level_lufs) ? known_level_lufs : -120),
                          std::memory_order_release);
  memory->cue_peak.store(word(std::isfinite(known_peak_db) ? known_peak_db : -120),
                         std::memory_order_release);
  memory->cue_sequence.store(sequence + 2, std::memory_order_release);
  return 1;
}

int feq_leveling_memory_read_song(const FeqLevelingMemory* memory, FeqSongLevel* out) {
  if (memory == nullptr || out == nullptr) return 0;
  FeqLevelingState state;
  for (int attempt = 0; attempt < kControlAttempts; ++attempt) {
    const auto read = feq_leveling::read_learned(*memory, state);
    if (read == feq_leveling::Read::empty) return 0;
    if (read == feq_leveling::Read::ready) {
      if (state.song_id == 0 || state.settled_level <= -100) return 0;
      *out = {state.song_id, state.settled_level, state.settled_peak_db,
              state.foreground_seconds};
      return 1;
    }
    // A publish takes a handful of stores; on a machine with one free core the
    // writer can be preempted mid-publish, and yielding is what lets it finish.
    std::this_thread::yield();
  }
  return 0;
}
}
