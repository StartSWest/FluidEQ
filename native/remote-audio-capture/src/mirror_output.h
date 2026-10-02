/* FluidEQ — GPL-3.0-or-later */
#pragma once

#ifndef NOMINMAX
#define NOMINMAX
#endif

#include <Windows.h>
#include <audioclient.h>
#include <wrl/client.h>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

#include "playback_core.h"

// Owned and serviced on the capture thread. Playback must live in this process:
// process-loopback excludes this tree, preventing mirrors from being recaptured.
//
// It keeps time the way Share Audio's playback does, with the same engine
// (`feq::remote::PeerPlayback`): it starts about 30 ms behind, adds 10 ms
// after a dropout, gives a millisecond back each quiet minute, and follows
// the second device's clock by playing up to 0.1% fast or slow — never by
// skipping. There used to be two fixed recipes, Game/Video and Music, and a
// picker between them; Ivan asked for the automatic one Share Audio already
// had (2026-10-02, "we dont need those selectors").
class MirrorOutput final {
 public:
  ~MirrorOutput();
  HRESULT open(const std::string& guid, std::uint32_t rate,
               std::uint16_t channels, float volume);
  HRESULT push(const float* samples, std::uint32_t frames, bool silent);
  HRESULT render();
  void set_volume(float volume) { volume_ = volume; }
  HANDLE event() const { return event_; }
  /** How far this output plays behind the sound it mirrors, in
   * microseconds: what waits in its buffer plus what the device holds. */
  std::uint32_t delay_us() const;

 private:
  Microsoft::WRL::ComPtr<IAudioClient> client_;
  Microsoft::WRL::ComPtr<IAudioRenderClient> renderer_;
  HANDLE event_ = nullptr;
  std::unique_ptr<feq::remote::PeerPlayback> playback_;
  std::vector<float> silence_;
  std::uint32_t device_frames_ = 0;
  std::uint32_t rate_ = 0;
  std::uint16_t channels_ = 0;
  std::uint32_t sequence_ = 0;
  std::uint32_t padding_ = 0;
  double stream_latency_ms_ = 0;
  float volume_ = 1;
};
