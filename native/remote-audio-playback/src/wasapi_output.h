/* FluidEQ — GPL-3.0-or-later */
#pragma once
#include <Windows.h>
#include <audioclient.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>
#include <atomic>
#include <cstdint>
#include <string>
#include <thread>

class WasapiOutput {
 public:
  using Render = void (*)(void*, float*, std::uint32_t);
  WasapiOutput(HANDLE parent, Render render, void* context);
  ~WasapiOutput();
  HRESULT open(const std::wstring& guid);
  HRESULT start();
  void close();
  HRESULT failure() const { return failure_.load(); }
  std::uint32_t rate() const { return rate_; }
  std::uint16_t channels() const { return channels_; }
  std::uint32_t mask() const { return mask_; }
  std::uint32_t frames() const { return frames_; }
 private:
  void run();
  HANDLE parent_, samples_ = nullptr, stop_ = nullptr;
  Render render_;
  void* context_;
  Microsoft::WRL::ComPtr<IAudioClient> client_;
  Microsoft::WRL::ComPtr<IAudioRenderClient> render_client_;
  std::thread thread_;
  std::atomic<HRESULT> failure_{S_OK};
  std::uint32_t rate_ = 0, mask_ = 0, frames_ = 0;
  std::uint16_t channels_ = 0;
};
