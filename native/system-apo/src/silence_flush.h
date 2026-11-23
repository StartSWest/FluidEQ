/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How long a microphone's rack keeps running once Windows starts sending
 * silence: until what was still inside it has come out.
 *
 * A silent block skips the graph, which is right for an output - nothing to
 * do, and the next sound starts where it starts. For a mic it cut the last of
 * a word off at the instant the mic was muted or the app stopped sending, and
 * kept that word's tail in the rack's delay lines to play out at the front of
 * the next sound, up to the cleaner's 20 ms of the old voice before the new
 * one. Running silence through the rack for its delay and a tail after the
 * last sound lets the word end and leaves the lines empty; after that the
 * silent blocks skip the graph as before.
 *
 * Audio thread only; no allocation, no call out.
 */

#ifndef FLUIDEQ_ENGINE_SILENCE_FLUSH_H
#define FLUIDEQ_ENGINE_SILENCE_FLUSH_H

#include <cstdint>

namespace fluideq_engine {

class SilenceFlush {
 public:
  /** What runs through after the delay: a gate's release, a limiter's. */
  static constexpr uint32_t kTailMs = 200;

  /** A block with sound went through a rack `latency` frames long. */
  void heard(uint32_t latency, uint32_t rate) noexcept {
    left_ = latency + static_cast<uint64_t>(rate) * kTailMs / 1000u;
  }

  /**
   * A silent block of `frames`: true while it is still to go through the
   * rack (the frames it covers are then counted off), false once the rack
   * has emptied, until the next sound.
   */
  bool take(uint32_t frames) noexcept {
    if (left_ == 0) {
      return false;
    }
    left_ = left_ > frames ? left_ - frames : 0;
    return true;
  }

  /** Nothing to flush: a new stream, or a rack with nothing inside to keep. */
  void clear() noexcept { left_ = 0; }

 private:
  uint64_t left_ = 0;
};

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_SILENCE_FLUSH_H
