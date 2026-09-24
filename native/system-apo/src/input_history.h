/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The last seconds of music as they reached the EQ, kept so Auto normalize can
 * replay them through a new EQ and know its level before anyone hears it
 * (`level_prediction.h`).
 *
 * One writer and one reader. The audio thread writes each block as it leaves
 * the rack (`Graph::process`) and does nothing else here: no allocation, no
 * lock, no call into the system. The watcher thread copies a stretch out, then
 * asks how far the writer had got by the time the copy was done, and keeps
 * only the frames the writer cannot have written over — a seqlock kept per
 * frame rather than per buffer, because the writer never waits for anybody.
 *
 * The samples are atomics, loaded and stored relaxed, and that is not
 * decoration: the reader does read slots the writer is filling, and throws
 * away what it read there. Plain floats would make that a data race even
 * though the values are discarded. On x86 a relaxed float store is the plain
 * store it replaces.
 */
#ifndef FLUIDEQ_ENGINE_INPUT_HISTORY_H
#define FLUIDEQ_ENGINE_INPUT_HISTORY_H

#include <atomic>
#include <cstdint>
#include <memory>
#include <optional>
#include <vector>

namespace fluideq_engine {

/**
 * Peaks are kept per fiftieth of a second, here and in every replay of the
 * history (`level_prediction.h`), on the same grid: a window compared across
 * the two lands on whole chunks of both, so a peak is never counted on one
 * side and missed on the other for straddling its edge.
 */
constexpr uint32_t kPeakChunksPerSecond = 50;

class InputHistory {
 public:
  /**
   * Room for `seconds` of `channels` at `rate`, within `kMaxBytes` of
   * samples: the whole ten seconds at 48 kHz stereo in 4.2 MB, less at
   * 192 kHz or in 7.1. Watcher thread: this allocates.
   */
  InputHistory(uint32_t rate, uint32_t channels, double seconds);

  uint32_t rate() const noexcept { return rate_; }
  uint32_t channels() const noexcept { return channels_; }
  /** The longest stretch `copy` can hand back whole. */
  uint64_t window_frames() const noexcept { return window_; }

  /**
   * Audio thread: the block about to enter the EQ, `channels()` planes of
   * `frames` samples. A null plane, or null planes, are recorded as silence.
   */
  void record(const float* const* planar, uint32_t frames) noexcept;

  /**
   * Audio thread, once the block `record` last took has been through the EQ:
   * the loudest true peak it reached the output guard with. What the chain
   * playing made of this music, so the level for an edit can be judged
   * without replaying that chain as well — when it has been playing all
   * along (`LevelPredictor`).
   */
  void record_peak(float peak) noexcept;

  /** Frames recorded so far. Every position `copy` speaks in counts these. */
  uint64_t written() const noexcept {
    return written_.load(std::memory_order_acquire);
  }

  uint32_t chunk_frames() const noexcept { return chunk_frames_; }

  /**
   * Watcher thread: the loudest peak `record_peak` was given in the whole
   * chunks of `[from, to)`, or nothing when some of them are no longer kept.
   */
  std::optional<double> peak_over(uint64_t from, uint64_t to) const;

  /** Frames `[from, to)` in the count `written()` gives. */
  struct Stretch {
    uint64_t from = 0;
    uint64_t to = 0;
  };

  /**
   * Watcher thread: frames `[from, to)`, one vector per channel, each resized
   * to the stretch returned — which is what was asked for, less the frames
   * never recorded or no longer kept, and less any the writer wrote over
   * while they were being copied. `out[c][0]` is frame `returned.from`.
   */
  Stretch copy(uint64_t from, uint64_t to,
               std::vector<std::vector<float>>& out) const;

 private:
  const uint32_t rate_;
  const uint32_t channels_;
  uint64_t capacity_ = 0;
  uint64_t window_ = 0;
  // `channels_` lanes of `capacity_` samples, one after another.
  std::unique_ptr<std::atomic<float>[]> samples_;
  // Frames the writer has finished, and the end of the block it is writing
  // (or last wrote): the reader keeps what neither can have overwritten.
  std::atomic<uint64_t> written_{0};
  std::atomic<uint64_t> reserved_{0};
  // The guard's peaks, one slot per chunk of the same ring of frames; the
  // writer's own bookkeeping of which block and chunk it is on.
  const uint32_t chunk_frames_;
  uint64_t peak_capacity_ = 0;
  std::unique_ptr<std::atomic<float>[]> peaks_;
  uint64_t block_start_ = 0;
  uint64_t block_end_ = 0;
  uint64_t peak_chunk_ = UINT64_MAX;
};

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_INPUT_HISTORY_H
