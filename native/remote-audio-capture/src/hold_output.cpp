/* FluidEQ — GPL-3.0-or-later */
#include "hold_output.h"

#include <mmdeviceapi.h>

#include <algorithm>
#include <cstring>

using Microsoft::WRL::ComPtr;

HoldOutput::~HoldOutput() {
  if (client_) { client_->Stop(); }
  renderer_.Reset();
  client_.Reset();
  if (event_ != nullptr) { CloseHandle(event_); }
}

HRESULT HoldOutput::open(const std::string& guid) {
  // An endpoint id only, as for a mirror: never a name, never the default.
  const std::wstring id = L"{0.0.0.00000000}." +
                          std::wstring(guid.begin(), guid.end());
  ComPtr<IMMDeviceEnumerator> enumerator;
  HRESULT hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr,
                                CLSCTX_ALL, IID_PPV_ARGS(&enumerator));
  if (FAILED(hr)) { return hr; }
  ComPtr<IMMDevice> device;
  hr = enumerator->GetDevice(id.c_str(), &device);
  if (FAILED(hr)) { return hr; }
  hr = device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr, &client_);
  if (FAILED(hr)) { return hr; }
  // The device's own mix format, so Windows converts nothing on the way to
  // the effect that does the playing.
  WAVEFORMATEX* format = nullptr;
  hr = client_->GetMixFormat(&format);
  if (FAILED(hr) || format == nullptr) { return FAILED(hr) ? hr : E_FAIL; }
  frame_bytes_ = format->nBlockAlign;
  // Request a shorter period only on this secondary. Main's stream, format,
  // effects and scheduling are never reopened or changed for sharing.
  ComPtr<IAudioClient3> low_latency;
  hr = E_NOINTERFACE;
  if (SUCCEEDED(client_.As(&low_latency))) {
    UINT32 ordinary = 0, fundamental = 0, minimum = 0, maximum = 0;
    hr = low_latency->GetSharedModeEnginePeriod(
        format, &ordinary, &fundamental, &minimum, &maximum);
    if (SUCCEEDED(hr) && fundamental != 0 && minimum != 0 &&
        minimum <= maximum) {
      const UINT32 wanted = std::max<UINT32>(minimum, format->nSamplesPerSec / 200);
      const UINT32 period = std::min(
          maximum, ((wanted + fundamental - 1) / fundamental) * fundamental);
      hr = low_latency->InitializeSharedAudioStream(
          AUDCLNT_STREAMFLAGS_EVENTCALLBACK, period, format, nullptr);
    } else {
      hr = E_FAIL;
    }
  }
  if (FAILED(hr)) {
    // Some drivers or another shared stream pin the ordinary period. A
    // fresh client avoids reusing a partially initialized low-latency one.
    low_latency.Reset();
    client_.Reset();
    hr = device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr, &client_);
    if (SUCCEEDED(hr)) {
      hr = client_->Initialize(AUDCLNT_SHAREMODE_SHARED,
                              AUDCLNT_STREAMFLAGS_EVENTCALLBACK, 0, 0,
                              format, nullptr);
    }
  }
  CoTaskMemFree(format);
  if (FAILED(hr)) { return hr; }
  event_ = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  if (event_ == nullptr) { return HRESULT_FROM_WIN32(GetLastError()); }
  hr = client_->SetEventHandle(event_);
  if (FAILED(hr)) { return hr; }
  hr = client_->GetBufferSize(&device_frames_);
  if (FAILED(hr)) { return hr; }
  hr = client_->GetService(IID_PPV_ARGS(&renderer_));
  if (FAILED(hr)) { return hr; }
  hr = render();
  return FAILED(hr) ? hr : client_->Start();
}

HRESULT HoldOutput::render() {
  UINT32 padding = 0;
  HRESULT hr = client_->GetCurrentPadding(&padding);
  if (FAILED(hr)) { return hr; }
  if (padding >= device_frames_) { return S_OK; }
  const UINT32 frames = device_frames_ - padding;
  BYTE* bytes = nullptr;
  hr = renderer_->GetBuffer(frames, &bytes);
  if (FAILED(hr)) { return hr; }
  std::memset(bytes, 0, static_cast<std::size_t>(frames) * frame_bytes_);
  return renderer_->ReleaseBuffer(frames, 0);
}
