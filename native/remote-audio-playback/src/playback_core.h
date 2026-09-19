/* FluidEQ — GPL-3.0-or-later */
#pragma once
#include <cstdint>
#include <memory>

namespace feq::remote {
constexpr std::uint32_t kMaxChannels = 8;
constexpr std::uint32_t kMaxPeers = 8;
constexpr std::uint32_t kMaxPacketFrames = 8192;

struct PlaybackStats {
  double buffered_ms = 0;
  double target_ms = 30;
  double correction_ppm = 0;
  double peak = 0;
  double rms = 0;
  std::uint64_t underruns = 0;
  std::uint64_t discontinuities = 0;
  std::uint64_t trimmed_frames = 0;
};

// One pipe producer and one render consumer. Construction/reconfiguration
// belongs to the control thread; neither push nor mix allocates or takes locks.
class PeerPlayback {
 public:
  PeerPlayback(std::uint32_t rate, std::uint16_t channels);
  ~PeerPlayback();
  PeerPlayback(const PeerPlayback&) = delete;
  PeerPlayback& operator=(const PeerPlayback&) = delete;
  bool output_format(std::uint32_t rate, std::uint16_t channels,
                     std::uint32_t speaker_mask);
  bool push(const float* samples, std::uint32_t frames,
            std::uint32_t sequence) noexcept;
  void mix(float* output, std::uint32_t frames) noexcept;
  void reset() noexcept;
  PlaybackStats stats() const noexcept;
  std::uint32_t source_rate() const noexcept;
  std::uint16_t source_channels() const noexcept;

 private:
  struct State;
  std::unique_ptr<State> state_;
};
}  // namespace feq::remote
