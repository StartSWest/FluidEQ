/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One writer, one reader, no lock.
 *
 * The decoder thread writes and the audio callback reads, and the callback may
 * not take a mutex another thread can hold — not because a lock is slow, but
 * because the decoder thread can be preempted while holding it and then the
 * callback waits on a thread the scheduler has parked. That is a dropout with
 * no bug in it.
 *
 * The cursors are free-running 64-bit counters rather than wrapped indices.
 * Wrapped indices make full and empty look identical and are usually fixed by
 * wasting a slot; free-running ones make `write - read` the exact fill at any
 * moment, and 2^64 frames is six million years at 96 kHz.
 */
#ifndef FLUIDEQ_RING_H
#define FLUIDEQ_RING_H

#include <atomic>
#include <cstdint>
#include <vector>

/** Planar: one contiguous span per channel, all the same length. */
class PlanarRing {
 public:
  void reset(uint32_t channels, uint32_t capacity) {
    channels_ = channels;
    capacity_ = capacity;
    storage_.assign(static_cast<size_t>(channels) * capacity, 0.0f);
    read_.store(0, std::memory_order_relaxed);
    write_.store(0, std::memory_order_relaxed);
  }

  uint32_t capacity() const { return capacity_; }

  /** Readable frames. Safe from either side; the answer only grows for the
   * reader and only shrinks for the writer, so neither can act on a stale
   * value in the direction that would overrun. */
  uint32_t available() const {
    const uint64_t write = write_.load(std::memory_order_acquire);
    const uint64_t read = read_.load(std::memory_order_acquire);
    return static_cast<uint32_t>(write - read);
  }

  uint32_t space() const { return capacity_ - available(); }

  /** Writer side. Returns frames actually taken. */
  uint32_t write(const float* const* input, uint32_t frames) {
    const uint32_t room = space();
    const uint32_t span = frames < room ? frames : room;
    uint64_t at = write_.load(std::memory_order_relaxed);
    for (uint32_t frame = 0; frame < span; ++frame) {
      const size_t slot = static_cast<size_t>((at + frame) % capacity_);
      for (uint32_t channel = 0; channel < channels_; ++channel) {
        storage_[static_cast<size_t>(channel) * capacity_ + slot] =
            input[channel][frame];
      }
    }
    write_.store(at + span, std::memory_order_release);
    return span;
  }

  /**
   * Reader side. Frames beyond what is available are written as silence.
   *
   * Silence rather than a short read on purpose: the caller is a device
   * callback with a fixed block to fill, and leaving the tail alone would
   * replay whatever the previous block left in it — a stutter rather than a
   * gap, which is louder and sounds like the material.
   */
  uint32_t read(float* const* output, uint32_t frames) {
    const uint32_t ready = available();
    const uint32_t span = frames < ready ? frames : ready;
    uint64_t at = read_.load(std::memory_order_relaxed);
    for (uint32_t frame = 0; frame < span; ++frame) {
      const size_t slot = static_cast<size_t>((at + frame) % capacity_);
      for (uint32_t channel = 0; channel < channels_; ++channel) {
        output[channel][frame] =
            storage_[static_cast<size_t>(channel) * capacity_ + slot];
      }
    }
    for (uint32_t channel = 0; channel < channels_; ++channel) {
      for (uint32_t frame = span; frame < frames; ++frame) {
        output[channel][frame] = 0.0f;
      }
    }
    read_.store(at + span, std::memory_order_release);
    return span;
  }

  uint64_t write_cursor() const {
    return write_.load(std::memory_order_acquire);
  }

  /**
   * Reader side only: throw away everything up to `cursor`.
   *
   * The seek handshake. The writer records the write cursor at the moment of
   * the seek and the reader skips to it, which drops exactly what was decoded
   * before the seek and keeps everything decoded after — no ack, no wait, and
   * the writer never stops.
   */
  void discard_until(uint64_t cursor) {
    const uint64_t at = read_.load(std::memory_order_relaxed);
    const uint64_t write = write_.load(std::memory_order_acquire);
    uint64_t target = cursor > at ? cursor : at;
    if (target > write) {
      target = write;
    }
    read_.store(target, std::memory_order_release);
  }

 private:
  uint32_t channels_ = 0;
  uint32_t capacity_ = 0;
  std::vector<float> storage_;
  std::atomic<uint64_t> read_{0};
  std::atomic<uint64_t> write_{0};
};

#endif /* FLUIDEQ_RING_H */
