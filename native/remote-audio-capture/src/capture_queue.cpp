/* FluidEQ — GPL-3.0-or-later */
#include "capture_queue.h"

#include <algorithm>
#include <cstring>

std::uint16_t capture_chunk_frames(std::uint32_t sample_rate) noexcept {
  if (sample_rate < 8'000 || sample_rate > 384'000) { return 0; }
  // Five milliseconds at every supported rate, rounded up by at most one
  // sample. A fixed 480 frames used to hold 60 ms at an 8 kHz mix rate.
  return static_cast<std::uint16_t>((sample_rate + 199) / 200);
}

CaptureQueue::CaptureQueue(std::uint32_t sample_rate, std::uint16_t channels,
                           std::uint32_t first_sequence) noexcept
    : sample_rate_(sample_rate), channels_(channels),
      chunk_frames_(capture_chunk_frames(sample_rate)), sequence_(first_sequence) {}

void CaptureQueue::push(const float* samples, std::uint32_t frames, bool silent,
                        bool discontinuity) noexcept {
  if (stopped_.load(std::memory_order_acquire) || chunk_frames_ == 0 ||
      channels_ == 0 || channels_ > kCaptureMaxChannels) { return; }
  if (discontinuity) {
    filled_ = 0;
    ++sequence_;
    generation_.fetch_add(1, std::memory_order_release);
  }
  std::uint32_t consumed = 0;
  while (consumed < frames) {
    const auto copied = std::min<std::uint32_t>(chunk_frames_ - filled_,
                                               frames - consumed);
    float* destination = partial_.data() + filled_ * channels_;
    const auto bytes = copied * channels_ * sizeof(float);
    if (silent || samples == nullptr) {
      std::memset(destination, 0, bytes);
    } else {
      std::memcpy(destination, samples + consumed * channels_, bytes);
    }
    filled_ = static_cast<std::uint16_t>(filled_ + copied);
    consumed += copied;
    if (filled_ != chunk_frames_) { continue; }

    auto* packet = packets_.write_slot();
    if (packet != nullptr) {
      packet->header = {
          kCaptureFrameMagic, 2, sequence_, sample_rate_, channels_, chunk_frames_,
          static_cast<std::uint32_t>(chunk_frames_ * channels_ * sizeof(float))};
      std::memcpy(packet->samples.data(), partial_.data(),
                  packet->header.payload_bytes);
      packet->generation = generation_.load(std::memory_order_relaxed);
      packets_.publish();
    } else {
      // Keeping the old queue after a stalled reader resumes would replay
      // delayed audio. Invalidate it; sequence still advances for every drop.
      generation_.fetch_add(1, std::memory_order_release);
    }
    ++sequence_;
    filled_ = 0;
  }
}

bool CaptureQueue::current(const CapturePacket& packet) const noexcept {
  return !stopped_.load(std::memory_order_acquire) &&
         packet.generation == generation_.load(std::memory_order_acquire);
}

bool CaptureQueue::pop(CapturePacket& packet) noexcept {
  while (!stopped_.load(std::memory_order_acquire)) {
    const auto* slot = packets_.read_slot();
    if (slot == nullptr) { return false; }
    if (current(*slot)) {
      packet.header = slot->header;
      packet.generation = slot->generation;
      std::memcpy(packet.samples.data(), slot->samples.data(),
                  slot->header.payload_bytes);
      packets_.release();
      if (current(packet)) { return true; }
    } else {
      packets_.release();
    }
  }
  return false;
}
