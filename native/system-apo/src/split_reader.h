/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The second output's engine playing the main output's sound out of its ring
 * (`split_board.h`), in time with it.
 *
 * Two devices, two clocks: the main output's engine writes a block whenever
 * its device asks, this one reads whenever its own device asks, and the two
 * drift apart by up to a few hundred parts per million. So the reader keeps a
 * fractional position in the main output's frames and plays a hair fast or
 * slow — never more than 0.5% — to hold a set distance behind it, reading
 * through the same windowed-sinc kernel Share Audio's playback uses, which
 * also converts between two different rates.
 *
 * The distance is measured against the writer's clock, not against what
 * happens to be in the ring: each block is stamped with the moment it reached
 * the writer, so "where the main output is now" is that block's first frame
 * plus the time since, at its rate. Measured that way it does not saw up and
 * down by a whole block every time the writer writes, and the distance it has
 * to keep is only what one of this output's blocks reads — this device's
 * period, the kernel's 33 frames ahead, and a margin for the two threads'
 * jitter that starts at 2 ms, grows by 1 ms each time the sound was not
 * there in time and gives half a millisecond back every quiet half minute.
 * That is only this reader's software reserve: about 13 ms at Windows'
 * 10 ms period. The device's presentation queue, transport and each output's
 * own DSP are outside this measurement.
 */
#ifndef FLUIDEQ_ENGINE_SPLIT_READER_H
#define FLUIDEQ_ENGINE_SPLIT_READER_H

#include <array>
#include <cstdint>
#include <vector>

#include "split_board.h"

namespace fluideq_engine {

/** The sinc table for one pair of rates. Built on a control thread. */
class SplitKernel {
 public:
  SplitKernel(uint32_t source_rate, uint32_t target_rate);
  uint32_t source_rate() const noexcept { return source_rate_; }
  const float* table() const noexcept { return table_.data(); }

 private:
  uint32_t source_rate_;
  std::vector<float> table_;
};

class SplitReader {
 public:
  /** This output's own format, as it locked. */
  SplitReader(uint32_t rate, uint32_t channels, unsigned long mask) noexcept;

  /**
   * Audio thread. Adds what the ring holds, `volume` times, into `planes` —
   * `frames` frames of this output's channels. `now` is
   * `QueryPerformanceCounter`, `ticks_per_second` its frequency.
   *
   * `kernel` must be one for the ring's rate, or the block is left as it is
   * and `wanted_rate` names the rate one is needed for. True when anything
   * the status reports changed, or a kernel is wanted: the caller then wakes
   * its watcher, which is the one thing it may not do itself.
   */
  bool mix(const SplitRing& ring, const SplitKernel* kernel, float volume,
           float* const* planes, uint32_t frames, int64_t now,
           int64_t ticks_per_second, SplitStats& stats) noexcept;

  /**
   * Audio thread: nothing to read — the main output has never been a main
   * output in this process. Fades out what was playing; true on a change.
   */
  bool idle(float* const* planes, uint32_t frames, SplitStats& stats) noexcept;

  /** Whether what it played has faded all the way out. */
  bool faded() const noexcept { return fade_ <= 0.0f; }

  /** The main output's rate a kernel is wanted for, or 0. */
  uint32_t wanted_rate() const noexcept { return wanted_rate_; }

  /** Starts over, as for a new main output. Audio thread, or before it runs. */
  void restart() noexcept;

 private:
  /** Sets `state` and says whether that is a change. */
  bool become(SplitState state, SplitStats& stats) noexcept;
  void build_matrix(const SplitRing::Clock& clock) noexcept;
  /** Fades out from the last sample played, so stopping never clicks. */
  void fade_out(float* const* planes, uint32_t frames) noexcept;

  const uint32_t rate_;
  const uint32_t channels_;
  const unsigned long mask_;

  SplitRing::Clock clock_;
  bool have_clock_ = false;
  uint32_t generation_ = 0;
  bool synced_ = false;
  SplitState state_ = SplitState::off;
  uint32_t wanted_rate_ = 0;
  /**
   * The writer's sound was missed while playing; `late_from_` is the stamp
   * of the last block it had written then. Judged once it writes again.
   */
  bool late_pending_ = false;
  int64_t late_from_ = 0;
  /** In the main output's frames; absolute, as the ring counts them. */
  double position_ = 0;
  /** The distance kept behind the writer, and its jitter part, in seconds. */
  double margin_ = 0;
  double lag_ = 0;
  /**
   * The trim the two clocks' difference needs, learned from the distance's
   * error and kept across a resync: the devices' clocks have not changed.
   */
  double drift_ = 0;
  uint64_t steady_frames_ = 0;
  /** Gain toward `volume`, and the 0-to-1 fade of starting and stopping. */
  float gain_ = 0;
  float fade_ = 0;
  std::array<std::array<float, SplitRing::kStride>, SplitRing::kStride> matrix_{};
  std::array<float, SplitRing::kStride> last_{};
};

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_SPLIT_READER_H
