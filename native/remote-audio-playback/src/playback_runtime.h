/* FluidEQ — GPL-3.0-or-later */
#pragma once
#include "playback_core.h"
#include "wasapi_output.h"
#include <array>
#include <atomic>
#include <memory>
#include <vector>

class PlaybackRuntime {
 public:
  explicit PlaybackRuntime(HANDLE parent);
  ~PlaybackRuntime();
  HRESULT open(const std::wstring& guid);
  bool push(unsigned id, std::uint32_t rate, std::uint16_t channels,
            std::uint32_t frames, std::uint32_t sequence, const float* pcm);
  void remove(unsigned id);
  void reset();
  void volume(float value) { volume_.store(value); }
  feq::remote::PlaybackStats stats(unsigned id) const;
  const WasapiOutput& output() const { return output_; }
 private:
  static void render(void* self, float* pcm, std::uint32_t frames);
  void reclaim();
  struct Retired { std::unique_ptr<feq::remote::PeerPlayback> peer; std::uint64_t block; };
  std::array<std::unique_ptr<feq::remote::PeerPlayback>, 8> peers_{};
  std::array<std::atomic<feq::remote::PeerPlayback*>, 8> audible_{};
  std::vector<Retired> retired_;
  std::atomic<std::uint64_t> blocks_{0};
  std::atomic<float> volume_{1};
  float volume_now_ = 1;
  WasapiOutput output_;
};
