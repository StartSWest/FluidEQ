/* FluidEQ — GPL-3.0-or-later */
#pragma once

#ifndef NOMINMAX
#define NOMINMAX
#endif

#include <Windows.h>
#include <audioclient.h>
#include <wrl/client.h>
#include <cstdint>
#include <string>
#include <vector>

// Owned and serviced on the capture thread. Playback must live in this process:
// process-loopback excludes this tree, preventing mirrors from being recaptured.
class MirrorOutput final {
 public:
  ~MirrorOutput();
  HRESULT open(const std::string& guid, std::uint32_t rate,
               std::uint16_t channels, bool video, float volume);
  HRESULT push(const float* samples, std::uint32_t frames, bool silent);
  HRESULT render();
  void set_volume(float volume) { volume_ = volume; }
  HANDLE event() const { return event_; }

 private:
  Microsoft::WRL::ComPtr<IAudioClient> client_;
  Microsoft::WRL::ComPtr<IAudioRenderClient> renderer_;
  HANDLE event_ = nullptr;
  std::vector<float> ring_;
  std::uint32_t capacity_ = 0;
  std::uint32_t device_frames_ = 0;
  std::uint32_t rate_ = 0;
  std::uint16_t channels_ = 0;
  std::uint64_t written_ = 0;
  std::uint64_t read_ = 0;
  double phase_ = 0;
  double target_ = 0;
  double base_target_ = 0;
  double stable_frames_ = 0;
  float volume_ = 1;
  bool video_ = false;
  bool primed_ = false;
};
