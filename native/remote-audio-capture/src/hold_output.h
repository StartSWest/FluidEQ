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

// Digital silence on a second output, for as long as it is held.
//
// Under the FluidEQ Engine a second output plays the main output's sound
// straight from the main output's engine (`native/system-apo/src/split_tap.h`),
// but Windows runs an output's effects only while something plays there.
// This is that something: a stream of zeros, written as ordinary samples —
// not flagged silent, so it is exactly what any player keeps open between
// two songs. The engine adds the main output's sound to it and then plays
// the result through that output's own EQ.
class HoldOutput final {
 public:
  ~HoldOutput();
  HRESULT open(const std::string& guid);
  HRESULT render();
  HANDLE event() const { return event_; }

 private:
  Microsoft::WRL::ComPtr<IAudioClient> client_;
  Microsoft::WRL::ComPtr<IAudioRenderClient> renderer_;
  HANDLE event_ = nullptr;
  std::uint32_t device_frames_ = 0;
  std::uint32_t frame_bytes_ = 0;
};
