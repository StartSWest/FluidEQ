/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the engine just played, handed to the "FluidEQ Monitor" source.
 *
 * The window draws its live graph, wave and meters from a capture of what
 * the output plays. Windows gives it that as the endpoint's loopback;
 * Chromium on Linux has no loopback and lists no sound-server monitors, only
 * inputs. So the engine publishes its own output as an input
 * (`pw_monitor.cpp`), and this is the hand-off: the playback's cycle writes
 * the processed planes, the source's cycle reads them.
 *
 * Single producer, single consumer, no allocation and no lock after
 * construction. Both run on PipeWire's data thread, but the indices are
 * atomics all the same, so nothing here depends on that. A reader that falls
 * behind skips ahead to the newest audio, and one that runs dry plays
 * silence: this feeds a picture, which wants the present, never a backlog.
 */
#ifndef FLUIDEQ_LINUX_MONITOR_RING_H
#define FLUIDEQ_LINUX_MONITOR_RING_H

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <cstring>
#include <vector>

namespace fluideq_linux {

class MonitorRing {
 public:
  /** `capacity` frames per channel, a power of two. Control thread. */
  MonitorRing(uint32_t channels, uint32_t capacity)
      : channels_(channels),
        capacity_(capacity),
        planes_(channels, std::vector<float>(capacity, 0.0f)) {}

  uint32_t channels() const noexcept { return channels_; }

  /** Data thread: after the engine has processed a block. */
  void write(float* const* planes, uint32_t channels, uint32_t frames) noexcept {
    const uint64_t at = written_.load(std::memory_order_relaxed);
    const uint32_t count = std::min(channels, channels_);
    for (uint32_t frame = 0; frame < frames; ++frame) {
      const uint32_t slot = static_cast<uint32_t>((at + frame) & (capacity_ - 1));
      for (uint32_t c = 0; c < count; ++c) planes_[c][slot] = planes[c][frame];
    }
    written_.store(at + frames, std::memory_order_release);
  }

  /** Data thread: `frames` of the newest audio, silence where there is none. */
  void read(float* const* planes, uint32_t channels, uint32_t frames) noexcept {
    const uint64_t newest = written_.load(std::memory_order_acquire);
    uint64_t from = read_;
    // Behind by more than the ring holds, or by more than a few blocks: skip
    // to the present rather than draw what played a while ago.
    const uint64_t keep = std::min<uint64_t>(capacity_ / 2, frames * 4ull);
    if (newest - from > keep) from = newest > frames ? newest - frames : 0;
    const uint64_t available = newest - from;
    const uint32_t take = static_cast<uint32_t>(std::min<uint64_t>(available, frames));
    for (uint32_t c = 0; c < channels; ++c) {
      float* out = planes[c];
      if (c >= channels_) {
        std::memset(out, 0, frames * sizeof(float));
        continue;
      }
      for (uint32_t frame = 0; frame < take; ++frame) {
        out[frame] = planes_[c][static_cast<uint32_t>((from + frame) & (capacity_ - 1))];
      }
      if (take < frames) std::memset(out + take, 0, (frames - take) * sizeof(float));
    }
    read_ = from + take;
  }

 private:
  const uint32_t channels_;
  const uint32_t capacity_;
  std::vector<std::vector<float>> planes_;
  std::atomic<uint64_t> written_{0};
  uint64_t read_ = 0;
};

}  // namespace fluideq_linux

#endif  // FLUIDEQ_LINUX_MONITOR_RING_H
