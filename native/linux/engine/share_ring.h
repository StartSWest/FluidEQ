/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What "FluidEQ Share In" delivered, held for the playback's cycle to add in
 * (`pw_share.cpp`). Both ends run on PipeWire's data thread, in whichever
 * order the graph puts them in a cycle; the ring is what makes the order not
 * matter. A buffer written after the playback read stays for the next
 * cycle, so the sound arrives one quantum later and whole.
 *
 * The backlog is bounded: past three of the reader's quanta it is cut back to
 * one, so a stall (the window's stream starting, an output switch) costs a
 * single skip instead of a delay that never goes away.
 */
#ifndef FLUIDEQ_LINUX_SHARE_RING_H
#define FLUIDEQ_LINUX_SHARE_RING_H

#include <algorithm>
#include <cstdint>
#include <vector>

namespace fluideq_linux {

class ShareRing {
 public:
  /** Control thread. 32768 frames: two thirds of a second at 48 kHz. */
  explicit ShareRing(uint32_t channels)
      : planes_(channels, std::vector<float>(kCapacity, 0.0f)) {}

  /** Data thread: `frames` of planar float, as the sink received them. */
  void write(const float* const* planes, uint32_t channels,
             uint32_t frames) noexcept {
    frames = std::min(frames, kCapacity);
    const uint32_t count =
        std::min(channels, static_cast<uint32_t>(planes_.size()));
    for (uint32_t c = 0; c < count; ++c) {
      for (uint32_t f = 0; f < frames; ++f) {
        planes_[c][(written_ + f) & (kCapacity - 1)] =
            planes[c] != nullptr ? planes[c][f] : 0.0f;
      }
    }
    written_ += frames;
  }

  /** Data thread: frames held and not yet added. */
  uint32_t available() const noexcept {
    return static_cast<uint32_t>(std::min<uint64_t>(written_ - read_, kCapacity));
  }

  /** Data thread: adds up to `frames` of the oldest held into `planes`. */
  void add_into(float* const* planes, uint32_t channels,
                uint32_t frames) noexcept {
    if (frames == 0) return;
    const uint64_t most = static_cast<uint64_t>(frames) * 3;
    if (written_ - read_ > most) read_ = written_ - frames;
    const uint32_t take = std::min(frames, available());
    const uint32_t count =
        std::min(channels, static_cast<uint32_t>(planes_.size()));
    for (uint32_t c = 0; c < count; ++c) {
      if (planes[c] == nullptr) continue;
      for (uint32_t f = 0; f < take; ++f) {
        planes[c][f] += planes_[c][(read_ + f) & (kCapacity - 1)];
      }
    }
    read_ += take;
  }

 private:
  static constexpr uint32_t kCapacity = 32768;  // A power of two.
  std::vector<std::vector<float>> planes_;
  uint64_t written_ = 0;
  uint64_t read_ = 0;
};

}  // namespace fluideq_linux

#endif  // FLUIDEQ_LINUX_SHARE_RING_H
