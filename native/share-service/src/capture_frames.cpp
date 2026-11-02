/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The capture helpers' frames (`createCaptureFrameReader` in
// `core/platform/windows/captureFrames.ts`): a 24-byte header, then the
// payload, the first frame saying the helper is ready.

#include <vector>

#include "network_capture.h"

namespace feq::share::service {
namespace {

constexpr std::uint32_t kFrameMagic = 0x314e414c;
constexpr std::uint32_t kFrameReady = 1;
constexpr std::uint32_t kFrameAudio = 2;
constexpr std::size_t kCaptureHeaderBytes = 24;
constexpr std::uint32_t kMaxPayloadBytes = 8192 * 8 * 4;

std::uint32_t u32_at(const std::vector<std::uint8_t>& bytes, std::size_t at) {
  return static_cast<std::uint32_t>(bytes[at]) |
         (static_cast<std::uint32_t>(bytes[at + 1]) << 8) |
         (static_cast<std::uint32_t>(bytes[at + 2]) << 16) |
         (static_cast<std::uint32_t>(bytes[at + 3]) << 24);
}

std::uint16_t u16_at(const std::vector<std::uint8_t>& bytes, std::size_t at) {
  return static_cast<std::uint16_t>(bytes[at] | (bytes[at + 1] << 8));
}

/** The second output's replies, which carry no sound. */
bool is_mirror_reply(std::uint32_t kind) {
  return kind == 3 || kind == 4 || kind == 5;
}
}  // namespace

void CaptureFrameReader::push(std::span<const std::uint8_t> data) {
  if (broken_) {
    return;
  }
  buffered_.insert(buffered_.end(), data.begin(), data.end());
  std::size_t at = 0;
  const auto invalid = [this](const char* message) {
    broken_ = true;
    handlers_.invalid(failure_with(message));
  };
  while (buffered_.size() - at >= kCaptureHeaderBytes) {
    const std::vector<std::uint8_t> header(
        buffered_.begin() + static_cast<std::ptrdiff_t>(at),
        buffered_.begin() + static_cast<std::ptrdiff_t>(at + kCaptureHeaderBytes));
    if (u32_at(header, 0) != kFrameMagic) {
      invalid("The capture helper sent an invalid frame.");
      return;
    }
    const std::uint32_t kind = u32_at(header, 4);
    const std::uint32_t sequence = u32_at(header, 8);
    const std::uint32_t rate = u32_at(header, 12);
    const std::uint16_t channels = u16_at(header, 16);
    const std::uint16_t frames = u16_at(header, 18);
    const std::uint32_t payload_bytes = u32_at(header, 20);
    bool valid = false;
    if (is_mirror_reply(kind)) {
      valid = payload_bytes == 0 && frames == 0 && channels == 0;
    } else if (kind == kFrameReady) {
      valid = payload_bytes == 0 && frames == 0 && channels >= 1 &&
              channels <= 8 && rate >= 8000 && rate <= 384000;
    } else {
      valid = kind == kFrameAudio && channels >= 1 && channels <= 8 &&
              frames >= 1 && frames <= 8192 && rate >= 8000 && rate <= 384000 &&
              payload_bytes == static_cast<std::uint32_t>(frames) * channels * 4 &&
              payload_bytes <= kMaxPayloadBytes;
    }
    if (!valid) {
      invalid("The capture helper sent invalid audio metadata.");
      return;
    }
    const std::size_t frame_bytes = kCaptureHeaderBytes + payload_bytes;
    if (buffered_.size() - at < frame_bytes) {
      break;
    }
    const auto payload_at =
        buffered_.begin() + static_cast<std::ptrdiff_t>(at + kCaptureHeaderBytes);
    std::vector<std::uint8_t> payload(
        payload_at, payload_at + static_cast<std::ptrdiff_t>(payload_bytes));
    at += frame_bytes;
    if (kind == kFrameReady) {
      if (ready_) {
        invalid("The capture helper restarted its stream.");
        return;
      }
      ready_ = true;
      handlers_.ready();
    } else if (!ready_) {
      invalid("The capture helper sent audio before it was ready.");
      return;
    } else if (is_mirror_reply(kind)) {
      handlers_.reply(kind, sequence, rate);
    } else {
      share::lan::AudioChunk chunk;
      chunk.sequence = sequence;
      chunk.sample_rate = rate;
      chunk.channels = static_cast<std::uint8_t>(channels);
      chunk.frames = frames;
      chunk.pcm = std::move(payload);
      handlers_.audio(chunk);
    }
    if (broken_) {
      return;
    }
  }
  buffered_.erase(buffered_.begin(), buffered_.begin() + static_cast<std::ptrdiff_t>(at));
}

}  // namespace feq::share::service
