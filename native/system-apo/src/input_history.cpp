/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "input_history.h"

#include <algorithm>
#include <cstddef>

namespace fluideq_engine {

namespace {

/**
 * The most the history may hold, in samples' bytes, per output. Ten seconds
 * of 48 kHz stereo is 3.8 MB; the same at 192 kHz or in 7.1 would be 15 MB
 * inside audiodg.exe for one output, so those get what this holds instead —
 * about four and a half seconds, which still judges a level (three seconds
 * measured only a little worse than ten, `level_prediction.h`).
 */
constexpr size_t kMaxBytes = size_t{8} << 20;

/**
 * Kept beyond the window so the writer is a second away from the oldest frame
 * a copy asks for: a copy of the whole window takes about a millisecond, so
 * nothing it returns is ever cut for having been written over.
 */
constexpr double kSlackSeconds = 1.0;

}  // namespace

InputHistory::InputHistory(uint32_t rate, uint32_t channels, double seconds)
    : rate_(rate),
      channels_(std::max(1u, channels)),
      chunk_frames_(std::max(1u, rate / kPeakChunksPerSecond)) {
  const auto slack = static_cast<uint64_t>(rate_ * kSlackSeconds);
  const auto wanted = static_cast<uint64_t>(rate_ * std::max(0.0, seconds));
  const uint64_t affordable = kMaxBytes / (sizeof(float) * channels_);
  capacity_ = std::min(wanted + slack, affordable);
  window_ = capacity_ > slack ? capacity_ - slack : 0;
  if (capacity_ > 0) {
    samples_ = std::make_unique<std::atomic<float>[]>(
        static_cast<size_t>(capacity_) * channels_);
    peak_capacity_ = capacity_ / chunk_frames_ + 2;
    peaks_ = std::make_unique<std::atomic<float>[]>(
        static_cast<size_t>(peak_capacity_));
  }
}

void InputHistory::record(const float* const* planar, uint32_t frames) noexcept {
  if (frames == 0 || capacity_ == 0) {
    return;
  }
  // The only writer, so its own count needs no ordering to read.
  const uint64_t start = written_.load(std::memory_order_relaxed);
  block_start_ = start;
  block_end_ = start + frames;
  // Said before the first sample lands: a reader that sees any sample of
  // this block also sees this, through the fences on either side — which is
  // what lets it tell a slot it read from one being written over.
  reserved_.store(start + frames, std::memory_order_relaxed);
  std::atomic_thread_fence(std::memory_order_release);
  for (uint32_t channel = 0; channel < channels_; ++channel) {
    const float* in = planar != nullptr ? planar[channel] : nullptr;
    std::atomic<float>* lane =
        samples_.get() + static_cast<size_t>(channel) * capacity_;
    uint64_t slot = start % capacity_;
    for (uint32_t at = 0; at < frames; ++at) {
      lane[slot].store(in != nullptr ? in[at] : 0.0f, std::memory_order_relaxed);
      if (++slot == capacity_) {
        slot = 0;
      }
    }
  }
  written_.store(start + frames, std::memory_order_release);
}

void InputHistory::record_peak(float peak) noexcept {
  if (peak_capacity_ == 0 || block_end_ <= block_start_) {
    return;
  }
  const uint64_t first = block_start_ / chunk_frames_;
  const uint64_t last = (block_end_ - 1) / chunk_frames_;
  for (uint64_t chunk = first; chunk <= last; ++chunk) {
    std::atomic<float>& slot = peaks_[chunk % peak_capacity_];
    // A chunk this lap has not reached yet starts from this block's peak; one
    // the previous block already began keeps the louder of the two.
    if (peak_chunk_ == UINT64_MAX || chunk > peak_chunk_) {
      slot.store(peak, std::memory_order_relaxed);
      peak_chunk_ = chunk;
    } else {
      slot.store(std::max(slot.load(std::memory_order_relaxed), peak),
                 std::memory_order_relaxed);
    }
  }
  // Once per block: a second call would find nothing new to say.
  block_start_ = block_end_;
}

std::optional<double> InputHistory::peak_over(uint64_t from,
                                              uint64_t to) const {
  if (peak_capacity_ == 0) {
    return std::nullopt;
  }
  // The newest two chunks may still be waiting for the peak of a block whose
  // samples are already counted: `record_peak` comes after the EQ has run.
  const uint64_t newest = written_.load(std::memory_order_acquire) / chunk_frames_;
  const uint64_t first = (from + chunk_frames_ - 1) / chunk_frames_;
  const uint64_t end =
      std::min(to / chunk_frames_, newest > 1 ? newest - 1 : uint64_t{0});
  const uint64_t kept = peak_capacity_ - 2;
  if (first >= end || (newest > kept && first < newest - kept)) {
    return std::nullopt;
  }
  double peak = 0.0;
  for (uint64_t chunk = first; chunk < end; ++chunk) {
    peak = std::max(peak, static_cast<double>(peaks_[chunk % peak_capacity_].load(
                              std::memory_order_relaxed)));
  }
  // Lapped while reading: the oldest chunks may now hold newer peaks.
  std::atomic_thread_fence(std::memory_order_acquire);
  const uint64_t after = written_.load(std::memory_order_relaxed) / chunk_frames_;
  if (after > kept && first < after - kept) {
    return std::nullopt;
  }
  return peak;
}

InputHistory::Stretch InputHistory::copy(
    uint64_t from, uint64_t to, std::vector<std::vector<float>>& out) const {
  out.resize(channels_);
  const uint64_t done = written_.load(std::memory_order_acquire);
  to = std::min(to, done);
  from = std::max(from, done > capacity_ ? done - capacity_ : uint64_t{0});
  if (capacity_ == 0 || from >= to) {
    for (std::vector<float>& lane : out) lane.clear();
    return {to, to};
  }
  const auto count = static_cast<size_t>(to - from);
  for (uint32_t channel = 0; channel < channels_; ++channel) {
    const std::atomic<float>* lane =
        samples_.get() + static_cast<size_t>(channel) * capacity_;
    std::vector<float>& copied = out[channel];
    copied.resize(count);
    uint64_t slot = from % capacity_;
    for (size_t at = 0; at < count; ++at) {
      copied[at] = lane[slot].load(std::memory_order_relaxed);
      if (++slot == capacity_) {
        slot = 0;
      }
    }
  }
  // Every sample above is read before the writer's position below: a frame
  // `f` was written over once the writer reached `f + capacity`, and the
  // block it was in the middle of counts as reached.
  std::atomic_thread_fence(std::memory_order_acquire);
  const uint64_t reached = reserved_.load(std::memory_order_relaxed);
  const uint64_t intact =
      reached > capacity_ ? std::max(from, reached - capacity_) : from;
  if (intact >= to) {
    for (std::vector<float>& lane : out) lane.clear();
    return {to, to};
  }
  if (intact > from) {
    const auto cut = static_cast<std::ptrdiff_t>(intact - from);
    for (std::vector<float>& lane : out) {
      lane.erase(lane.begin(), lane.begin() + cut);
    }
  }
  return {intact, to};
}

}  // namespace fluideq_engine
