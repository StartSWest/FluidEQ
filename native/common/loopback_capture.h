/* FluidEQ — GPL-3.0-or-later */
#pragma once

// What the speakers play, heard by a helper with no window: the default
// output's WASAPI loopback, the hidden stream of silence that keeps it
// sending while nothing plays, and the watch that says when Windows moves the
// default elsewhere. FluidEQ-Listen hands the sound to the window
// (`system-listen`); the scene host draws the lamps from it (`scene-host`).

#include <Windows.h>
#include <audioclient.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>
#include <wrl/implements.h>

#include <cstdint>

#include "float_mix_format.h"

namespace feq::listen {

using Microsoft::WRL::ClassicCom;
using Microsoft::WRL::ComPtr;
using Microsoft::WRL::RuntimeClass;
using Microsoft::WRL::RuntimeClassFlags;

class UniqueHandle final {
 public:
  explicit UniqueHandle(HANDLE value) : value_(value) {}
  ~UniqueHandle() {
    if (valid()) {
      CloseHandle(value_);
    }
  }
  UniqueHandle(const UniqueHandle&) = delete;
  UniqueHandle& operator=(const UniqueHandle&) = delete;

  [[nodiscard]] HANDLE get() const { return value_; }
  [[nodiscard]] bool valid() const {
    return value_ != nullptr && value_ != INVALID_HANDLE_VALUE;
  }

 private:
  HANDLE value_;
};

/** Says when Windows moves the default output away from the one heard. */
class DefaultOutputWatch final
    : public RuntimeClass<RuntimeClassFlags<ClassicCom>, IMMNotificationClient> {
 public:
  HRESULT RuntimeClassInitialize(HANDLE moved) {
    moved_ = moved;
    return moved_ != nullptr ? S_OK : E_INVALIDARG;
  }

  STDMETHODIMP OnDefaultDeviceChanged(EDataFlow flow, ERole role,
                                      LPCWSTR /*device*/) override {
    if (flow == eRender && role == eConsole) {
      SetEvent(moved_);
    }
    return S_OK;
  }
  STDMETHODIMP OnDeviceStateChanged(LPCWSTR /*device*/, DWORD /*state*/) override {
    return S_OK;
  }
  STDMETHODIMP OnDeviceAdded(LPCWSTR /*device*/) override { return S_OK; }
  STDMETHODIMP OnDeviceRemoved(LPCWSTR /*device*/) override { return S_OK; }
  STDMETHODIMP OnPropertyValueChanged(LPCWSTR /*device*/,
                                      const PROPERTYKEY /*key*/) override {
    return S_OK;
  }

 private:
  HANDLE moved_ = nullptr;
};

struct Loopback {
  ComPtr<IAudioClient> client;
  ComPtr<IAudioCaptureClient> capture;
  std::uint32_t rate = 0;
  std::uint16_t channels = 0;
};

/**
 * A stream of silence on the output being heard, hidden from the volume
 * mixer.
 *
 * Windows sends a loopback nothing at all while nothing renders on its
 * output: no packets, not packets of silence. A desktop background fed from
 * here would then hold its last frame for as long as the room is quiet,
 * where the window's capture fell to rest, because the window's own audio
 * context was rendering silence onto the output the whole time. This is
 * that silence, kept by the helper for as long as it listens, so silence
 * arrives as silence. It keeps the output's engine running exactly as the
 * window's context did, and only while something is listening.
 */
struct Silence {
  ComPtr<IAudioClient> client;
  ComPtr<IAudioRenderClient> render;
  UINT32 frames = 0;
  /** The output's rate, for a listener the silence is the only clock of. */
  std::uint32_t rate = 0;
};

/**
 * Everything the silent stream has room for, written as silence; `written`,
 * when given, says how many frames that was.
 */
[[nodiscard]] inline HRESULT fill_silence(Silence* silence,
                                          UINT32* written = nullptr) {
  if (written != nullptr) {
    *written = 0;
  }
  UINT32 padding = 0;
  HRESULT result = silence->client->GetCurrentPadding(&padding);
  if (FAILED(result) || padding >= silence->frames) {
    return result;
  }
  const UINT32 room = silence->frames - padding;
  BYTE* data = nullptr;
  result = silence->render->GetBuffer(room, &data);
  if (FAILED(result)) {
    return result;
  }
  result = silence->render->ReleaseBuffer(room, AUDCLNT_BUFFERFLAGS_SILENT);
  if (SUCCEEDED(result) && written != nullptr) {
    *written = room;
  }
  return result;
}

/** The silent stream, started on `endpoint`, refilled on `event`. */
[[nodiscard]] inline HRESULT start_silence(IMMDevice* endpoint, HANDLE event,
                                           Silence* silence) {
  HRESULT result = endpoint->Activate(__uuidof(IAudioClient), CLSCTX_ALL,
                                      nullptr, &silence->client);
  if (FAILED(result)) {
    return result;
  }
  WAVEFORMATEX* mix_format = nullptr;
  result = silence->client->GetMixFormat(&mix_format);
  if (FAILED(result)) {
    return result;
  }
  silence->rate = mix_format->nSamplesPerSec;
  result = silence->client->Initialize(
      AUDCLNT_SHAREMODE_SHARED,
      AUDCLNT_STREAMFLAGS_EVENTCALLBACK | AUDCLNT_SESSIONFLAGS_DISPLAY_HIDE, 0,
      0, mix_format, nullptr);
  CoTaskMemFree(mix_format);
  if (FAILED(result)) {
    return result;
  }
  result = silence->client->SetEventHandle(event);
  if (FAILED(result)) {
    return result;
  }
  result = silence->client->GetBufferSize(&silence->frames);
  if (FAILED(result)) {
    return result;
  }
  result = silence->client->GetService(IID_PPV_ARGS(&silence->render));
  if (FAILED(result)) {
    return result;
  }
  result = fill_silence(silence);
  return FAILED(result) ? result : silence->client->Start();
}

/**
 * The default output's loopback, started, for a mix of at most
 * `max_channels`. `step` names what failed.
 */
[[nodiscard]] inline HRESULT start_loopback(IMMDevice* endpoint,
                                            HANDLE sample_event,
                                            std::uint16_t max_channels,
                                            Loopback* loopback,
                                            const char** step) {
  *step = "the output could not be opened";
  HRESULT result = endpoint->Activate(__uuidof(IAudioClient), CLSCTX_ALL,
                                      nullptr, &loopback->client);
  if (FAILED(result)) {
    return result;
  }
  WAVEFORMATEX* mix_format = nullptr;
  result = loopback->client->GetMixFormat(&mix_format);
  if (FAILED(result) || !feq::is_float_mix_format(mix_format, max_channels)) {
    CoTaskMemFree(mix_format);
    *step = "the output's mix is not Float32 PCM";
    return FAILED(result) ? result : E_FAIL;
  }
  loopback->rate = mix_format->nSamplesPerSec;
  loopback->channels = mix_format->nChannels;
  // Event-driven loopback is signalled from Windows 10 on, and only while
  // something plays: silence sends nothing, which the window reads as silence.
  result = loopback->client->Initialize(
      AUDCLNT_SHAREMODE_SHARED,
      AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK, 0, 0,
      mix_format, nullptr);
  CoTaskMemFree(mix_format);
  if (FAILED(result)) {
    *step = "the loopback could not be set up";
    return result;
  }
  result = loopback->client->SetEventHandle(sample_event);
  if (FAILED(result)) {
    *step = "the loopback's event could not be set";
    return result;
  }
  result = loopback->client->GetService(IID_PPV_ARGS(&loopback->capture));
  if (FAILED(result)) {
    *step = "the loopback's reader could not be made";
    return result;
  }
  *step = "the loopback would not start";
  return loopback->client->Start();
}

}  // namespace feq::listen
