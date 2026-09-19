/* FluidEQ — GPL-3.0-or-later */
#pragma once

#include <array>
#include <atomic>
#include <cstddef>
#include <cstdint>

constexpr std::uint32_t kCaptureFrameMagic = 0x314e414cU;
// Version 2 requires overlapped stdout; the 24-byte audio/control wire is
// unchanged. The ready sequence identifies the helper's pipe contract.
constexpr std::uint32_t kCapturePipeVersion = 2;
constexpr std::uint16_t kCaptureMaxChannels = 8;
constexpr std::uint16_t kCaptureMaxFrames = 1'920;
constexpr std::size_t kCaptureQueuePackets = 8;

struct CaptureFrameHeader {
  std::uint32_t magic = kCaptureFrameMagic;
  std::uint32_t kind = 0;
  std::uint32_t sequence = 0;
  std::uint32_t sample_rate = 0;
  std::uint16_t channels = 0;
  std::uint16_t frames = 0;
  std::uint32_t payload_bytes = 0;
};
static_assert(sizeof(CaptureFrameHeader) == 24);

struct CapturePacket {
  CaptureFrameHeader header;
  std::array<float, kCaptureMaxFrames * kCaptureMaxChannels> samples;
  std::uint32_t generation = 0;
};
static_assert(offsetof(CapturePacket, samples) == sizeof(CaptureFrameHeader));

// Each side owns its own cursor. A slow pipe can make the producer drop a
// packet, but it can never make it wait, allocate, or overwrite a reader.
template <typename T, std::size_t Capacity>
class CaptureRing final {
 public:
  T* write_slot() noexcept {
    const auto write = written_.load(std::memory_order_relaxed);
    if (write - read_.load(std::memory_order_acquire) >= Capacity) {
      return nullptr;
    }
    return &slots_[write % Capacity];
  }
  void publish() noexcept {
    written_.store(written_.load(std::memory_order_relaxed) + 1,
                   std::memory_order_release);
  }
  const T* read_slot() const noexcept {
    const auto read = read_.load(std::memory_order_relaxed);
    return read == written_.load(std::memory_order_acquire)
               ? nullptr : &slots_[read % Capacity];
  }
  void release() noexcept {
    read_.store(read_.load(std::memory_order_relaxed) + 1,
                std::memory_order_release);
  }

 private:
  std::array<T, Capacity> slots_;
  std::atomic<std::uint32_t> written_{0};
  std::atomic<std::uint32_t> read_{0};
};
static_assert(std::atomic<std::uint32_t>::is_always_lock_free);

std::uint16_t capture_chunk_frames(std::uint32_t sample_rate) noexcept;

class CaptureQueue final {
 public:
  CaptureQueue(std::uint32_t sample_rate, std::uint16_t channels,
               std::uint32_t first_sequence = 0) noexcept;
  // Only the capture thread calls push. Silence is WASAPI's flag, never a
  // signal-level inference; every non-silent Float32 bit passes unchanged.
  void push(const float* samples, std::uint32_t frames, bool silent,
            bool discontinuity) noexcept;
  // Only the pipe writer calls pop. Audio invalidated by overflow or a WASAPI
  // gap is consumed without being sent; an already issued write must finish
  // its one frame to preserve stream framing.
  bool pop(CapturePacket& packet) noexcept;
  bool current(const CapturePacket& packet) const noexcept;
  void stop() noexcept { stopped_.store(true, std::memory_order_release); }
  std::uint16_t chunk_frames() const noexcept { return chunk_frames_; }

 private:
  CaptureRing<CapturePacket, kCaptureQueuePackets> packets_;
  std::array<float, kCaptureMaxFrames * kCaptureMaxChannels> partial_;
  const std::uint32_t sample_rate_;
  const std::uint16_t channels_;
  const std::uint16_t chunk_frames_;
  std::uint16_t filled_ = 0;
  std::uint32_t sequence_;
  std::atomic<std::uint32_t> generation_{0};
  std::atomic<bool> stopped_{false};
};
