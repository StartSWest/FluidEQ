/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How an edit's level reaches the audio thread after the edit itself has.
 *
 * An edit used to wait for its level before it was heard: the watcher
 * replayed the last ten seconds of music through the new EQ
 * (`level_prediction.h`) and only then published the graph. That took 70 to
 * 140 ms on a quiet machine and 200 to 300 inside audiodg with the window
 * busy, and every change the app wrote while it ran waited behind it — a
 * drag was heard three or four times a second (engine.log, 2026-09-26, Ivan:
 * "the EQ changes are very slow ... this needs to be instant"). Now the graph
 * is published the moment it is built, and the level follows through here.
 *
 * One word, so the audio thread reads it with one load and no lock: the
 * generation of the graph the level is for in the high half — the watcher
 * numbers every graph it publishes, from 1 — and the level as a float's
 * bits in the low half. A NaN there is a prediction that had nothing to go
 * on. A graph only ever takes the word carrying its own generation, so a
 * level worked out for a graph since replaced is never applied to its
 * successor.
 */
#ifndef FLUIDEQ_ENGINE_LEVEL_MAILBOX_H
#define FLUIDEQ_ENGINE_LEVEL_MAILBOX_H

#include <atomic>
#include <cstdint>
#include <cstring>

namespace fluideq_engine {

class LevelMailbox {
 public:
  /** Watcher thread: `shift_db` for the graph published as `generation`. */
  void post(uint32_t generation, float shift_db) noexcept {
    uint32_t bits = 0;
    std::memcpy(&bits, &shift_db, sizeof(bits));
    word_.store((static_cast<uint64_t>(generation) << 32) | bits,
                std::memory_order_release);
  }

  /** Audio thread: the level posted for `generation`, if it has been. */
  bool take(uint32_t generation, float& shift_db) const noexcept {
    const uint64_t word = word_.load(std::memory_order_acquire);
    if (generation == 0 || static_cast<uint32_t>(word >> 32) != generation) {
      return false;
    }
    const auto bits = static_cast<uint32_t>(word & 0xffffffffu);
    std::memcpy(&shift_db, &bits, sizeof(shift_db));
    return true;
  }

 private:
  std::atomic<uint64_t> word_{0};
};

static_assert(std::atomic<uint64_t>::is_always_lock_free,
              "the audio thread may not take a lock to read its level");

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_LEVEL_MAILBOX_H
