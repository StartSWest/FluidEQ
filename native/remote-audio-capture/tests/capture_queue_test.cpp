/* FluidEQ — GPL-3.0-or-later */
#include "capture_queue.h"

#include <array>
#include <bit>
#include <cstdio>
#include <cstring>
#include <memory>
#include <vector>

namespace {
int failures = 0;
void check(bool condition, const char* description) {
  std::printf("  %s %s\n", condition ? "ok" : "FAIL", description);
  if (!condition) { ++failures; }
}

void packet_rates_and_raw_channels() {
  constexpr std::array<std::uint32_t, 6> rates{
      8'000, 44'100, 48'000, 96'000, 192'000, 384'000};
  for (const auto rate : rates) {
    for (std::uint16_t channels = 1; channels <= kCaptureMaxChannels; ++channels) {
      auto queue = std::make_unique<CaptureQueue>(rate, channels);
      const auto frames = queue->chunk_frames();
      check(frames == (rate + 199) / 200, "packet length follows the mix rate");
      std::vector<float> input(static_cast<std::size_t>(frames) * channels);
      for (std::size_t i = 0; i < input.size(); ++i) {
        // Include signed zero, denormals and non-finite bits: transport must
        // not normalize, clamp, remap or otherwise process any channel.
        constexpr std::array<std::uint32_t, 8> bits{
            0, 0x80000000U, 1, 0x7fc12345U, 0x3f800000U,
            0xbf800000U, 0x7f800000U, 0xff800000U};
        input[i] = std::bit_cast<float>(bits[i % bits.size()]);
      }
      queue->push(input.data(), frames - 1, false, false);
      CapturePacket packet;
      check(!queue->pop(packet), "partial audio waits for only one packet");
      queue->push(input.data() + (frames - 1) * channels, 1, false, false);
      check(queue->pop(packet) && packet.header.frames == frames &&
                packet.header.channels == channels &&
                packet.header.sample_rate == rate &&
                packet.header.payload_bytes == input.size() * sizeof(float) &&
                std::memcmp(packet.samples.data(), input.data(),
                            packet.header.payload_bytes) == 0,
            "all Float32 channel bits survive split capture buffers");
    }
  }
}

void ordering_silence_and_wrap() {
  auto queue = std::make_unique<CaptureQueue>(48'000, std::uint16_t{2}, UINT32_MAX);
  const auto frames = queue->chunk_frames();
  std::vector<float> input(static_cast<std::size_t>(frames) * 2 * 3);
  for (std::size_t i = 0; i < input.size(); ++i) {
    input[i] = static_cast<float>(i);
  }
  queue->push(input.data(), frames * 3U, false, false);
  CapturePacket packet;
  for (std::uint32_t i = 0; i < 3; ++i) {
    check(queue->pop(packet) && packet.header.sequence == UINT32_MAX + i &&
              std::memcmp(packet.samples.data(), input.data() + frames * 2 * i,
                          packet.header.payload_bytes) == 0,
          "packets stay ordered across capture buffers and sequence rollover");
  }
  queue->push(nullptr, frames, true, false);
  check(queue->pop(packet) && packet.header.sequence == 2,
        "silent capture advances the same stream sequence");
  bool zero = true;
  for (std::size_t i = 0; i < frames * 2U; ++i) {
    zero = zero && std::bit_cast<std::uint32_t>(packet.samples[i]) == 0;
  }
  check(zero, "WASAPI silence becomes exact zero in every channel");
}

void overflow_discards_backlog() {
  auto queue = std::make_unique<CaptureQueue>(48'000, std::uint16_t{2});
  const auto frames = queue->chunk_frames();
  std::vector<float> input(static_cast<std::size_t>(frames) * 2, 0.25F);
  queue->push(input.data(), frames, false, false);
  CapturePacket packet;
  check(queue->pop(packet) && packet.header.sequence == 0,
        "positive control establishes an audible stream before overflow");
  for (std::size_t i = 0; i <= kCaptureQueuePackets; ++i) {
    queue->push(input.data(), frames, false, false);
  }
  check(!queue->pop(packet), "overflow invalidates the entire stale backlog");
  input[0] = -0.75F;
  queue->push(input.data(), frames, false, false);
  check(queue->pop(packet) && packet.header.sequence > 1 &&
            packet.samples[0] == -0.75F,
        "recovery carries fresh samples with an observable sequence gap");
}

void discontinuity_discards_partial_and_queued_audio() {
  auto queue = std::make_unique<CaptureQueue>(48'000, std::uint16_t{2});
  const auto frames = queue->chunk_frames();
  std::vector<float> before(static_cast<std::size_t>(frames) * 4, 0.25F);
  queue->push(before.data(), frames, false, false);
  CapturePacket packet;
  check(queue->pop(packet) && packet.header.sequence == 0,
        "positive control establishes a stream before capture discontinuity");
  queue->push(before.data(), frames + frames / 2U, false, false);
  std::vector<float> after(static_cast<std::size_t>(frames) * 2, -0.5F);
  queue->push(after.data(), frames, false, true);
  check(queue->pop(packet) && packet.header.sequence > 1 &&
            std::memcmp(packet.samples.data(), after.data(),
                        packet.header.payload_bytes) == 0 &&
            !queue->pop(packet),
        "a capture gap discards partial and queued audio before restarting");
}

void stop_discards_and_refuses_new_audio() {
  auto queue = std::make_unique<CaptureQueue>(48'000, std::uint16_t{2});
  queue->push(nullptr, queue->chunk_frames(), true, false);
  queue->stop();
  queue->push(nullptr, queue->chunk_frames(), true, false);
  CapturePacket packet;
  check(!queue->pop(packet), "stop discards queued audio and refuses new audio");
  check(capture_chunk_frames(7'999) == 0 &&
            capture_chunk_frames(384'001) == 0,
        "packet storage rejects rates outside the native Float32 contract");
}
}  // namespace

int main() {
  packet_rates_and_raw_channels();
  ordering_silence_and_wrap();
  overflow_discards_backlog();
  discontinuity_discards_partial_and_queued_audio();
  stop_discards_and_refuses_new_audio();
  return failures == 0 ? 0 : 1;
}
