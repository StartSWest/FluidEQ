/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How long the engine takes over each of Windows' audio blocks on one
 * output, against the time the block lasts.
 *
 * Windows gives an endpoint effect one period to return each block — 10 ms
 * on most outputs, 11 ms on a Bluetooth headset at 528 frames — and a call
 * that takes longer is heard as gaps: the sound flipping between itself and
 * silence, with clicks. That is what a reporter heard as Exciter bands were
 * added (GitHub issue 30), and nothing the engine wrote could say whether it
 * had been too slow on that machine or something else had: the bench put
 * three bands and Organic at 2.4 ms of an 11 ms block on a fast efficiency
 * core, and the reporter's processor was unknown. This is the engine's own
 * answer, in its status and its log.
 *
 * Wall time, from the counter the Share Audio tap already reads on this
 * thread: what decides a missed period is when the call returns, preemption
 * included, not the cycles the engine spent. Kept per output and shared by
 * every instance Windows runs on it, as `output_carried_flag` is, because
 * the instance carrying the music is not always the one that writes the
 * status last.
 */
#ifndef FLUIDEQ_ENGINE_BLOCK_TIMING_H
#define FLUIDEQ_ENGINE_BLOCK_TIMING_H

#include <atomic>
#include <cstdint>
#include <string>

namespace fluideq_engine {

class BlockTiming {
 public:
  /** What the status and the log say, read on the control thread. */
  struct Reading {
    uint64_t blocks = 0;
    /** Blocks that took more than half the time they last. */
    uint64_t over_half = 0;
    /** The slowest block's call, and how long that block lasts. */
    double slowest_ms = 0.0;
    double period_ms = 0.0;
    /** The slowest call as thousandths of its own block's time. */
    uint32_t slowest_permille = 0;
  };

  /**
   * One processed block: `elapsed` counter ticks at `ticks_per_second`,
   * for a block of `frames` at `rate`. Audio thread; a few atomic
   * operations, no call into Windows. Returns the slowest block's share of
   * its period so far, in thousandths, so the caller can tell the control
   * thread when that has climbed.
   */
  uint32_t record(uint64_t elapsed, uint64_t ticks_per_second, uint32_t frames,
                  uint32_t rate) noexcept;

  Reading read() const noexcept;

 private:
  std::atomic<uint64_t> blocks_{0};
  std::atomic<uint64_t> over_half_{0};
  /**
   * The slowest block, packed so two instances recording at once can never
   * pair one block's share with another block's period: the share in
   * thousandths in the high half, that block's period in microseconds in
   * the low half. Ordered by the share, which is what "slowest" means when
   * blocks are not all the same length.
   */
  std::atomic<uint64_t> slowest_{0};
};

/**
 * The step of a share in thousandths that is worth telling the app about:
 * quarters of the period, so a stream writes its status at most a handful of
 * times for its timing — at a quarter, a half, three quarters, the whole
 * period and past it — rather than for every new slowest block.
 */
uint32_t timing_step(uint32_t permille) noexcept;

/**
 * "slowest block 6.10 ms of its 11.00 ms (55%), 3 of 12000 over half": the
 * engine log's line, and the bug report's, word for word.
 */
std::string describe_timing(const BlockTiming::Reading& reading);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_BLOCK_TIMING_H
