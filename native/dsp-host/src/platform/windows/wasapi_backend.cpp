/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Shared-mode WASAPI render, which is to say: an ordinary application.
 *
 * Nothing here is privileged and nothing is installed. WASAPI is a user-mode
 * COM API that ships with Windows, `ole32` and `avrt` are already on every
 * machine, and this process opens the default endpoint exactly the way any
 * media player does. Equalizer APO lives further down, inside the endpoint's
 * own processing chain, so audio written here passes through it afterwards —
 * the same relationship the Web Audio path already has, unchanged.
 *
 * Exclusive mode is deliberately not used. It would take the endpoint away
 * from every other application on the machine, which for a system equaliser
 * is precisely backwards.
 */

#include "../../audio_backend.h"

#include <atomic>
#include <thread>
#include <vector>

#define NOMINMAX
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <audioclient.h>
#include <avrt.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>

using Microsoft::WRL::ComPtr;

namespace {

/**
 * How much buffer to ask the engine for, in 100-nanosecond units.
 *
 * Shared mode treats this as a hint and the endpoint's own period usually
 * wins, so it is not a latency setting so much as a floor. Thirty milliseconds
 * is generous on purpose: this backend has no decoder feeding it yet, and a
 * bring-up that also fights for the smallest possible buffer is a bring-up
 * where an underrun could be either problem.
 */
constexpr REFERENCE_TIME kRequestedBufferDuration = 300000;

/** Does this mix format carry 32-bit floats, which is all this path writes? */
bool is_float32(const WAVEFORMATEX* format) {
  if (format == nullptr) {
    return false;
  }
  if (format->wFormatTag == WAVE_FORMAT_IEEE_FLOAT) {
    return format->wBitsPerSample == 32;
  }
  if (format->wFormatTag == WAVE_FORMAT_EXTENSIBLE) {
    const auto* extensible =
        reinterpret_cast<const WAVEFORMATEXTENSIBLE*>(format);
    return format->wBitsPerSample == 32 &&
           extensible->SubFormat == KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;
  }
  return false;
}

class WasapiBackend final : public IAudioOutputBackend {
 public:
  WasapiBackend(FeqRenderFn render, void* context)
      : render_(render), context_(context) {}

  ~WasapiBackend() override { close(); }

  bool open(FeqBackendFormat& negotiated, std::string& error) override {
    if (is_open()) {
      negotiated = format_;
      return true;
    }
    if (!prepare(error)) {
      teardown();
      return false;
    }
    negotiated = format_;
    open_.store(true, std::memory_order_release);
    return true;
  }

  bool start(std::string& error) override {
    if (!is_open()) {
      error = "the device was not opened";
      return false;
    }
    if (is_running()) {
      return true;
    }
    stop_.store(false, std::memory_order_release);
    running_.store(true, std::memory_order_release);
    thread_ = std::thread([this] { run(); });
    return true;
  }

  void close() override {
    const bool was_running = running_.exchange(false, std::memory_order_acq_rel);
    if (!open_.exchange(false, std::memory_order_acq_rel) && !was_running) {
      teardown();
      return;
    }
    stop_.store(true, std::memory_order_release);
    if (event_ != nullptr) {
      // Wake the thread rather than wait out its timeout. A stop that takes a
      // full period to be noticed is a stop somebody can hear as a tail.
      SetEvent(event_);
    }
    if (thread_.joinable()) {
      thread_.join();
    }
    teardown();
  }

  bool is_open() const override { return open_.load(std::memory_order_acquire); }

  bool is_running() const override {
    return running_.load(std::memory_order_acquire);
  }

  FeqBackendStats stats() const override {
    FeqBackendStats copy;
    copy.underruns = underruns_.load(std::memory_order_relaxed);
    copy.periods = periods_.load(std::memory_order_relaxed);
    return copy;
  }

  const char* name() const override { return "wasapi-shared"; }

 private:
  bool prepare(std::string& error) {
    // Apartment-agnostic on this thread; the render thread initialises its
    // own, because COM is per-thread and the interfaces are used from both.
    const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (com == RPC_E_CHANGED_MODE) {
      // Somebody already chose an apartment for this thread. That is fine —
      // it just means this call must not be the one that uninitialises it.
      owns_com_ = false;
    } else if (SUCCEEDED(com)) {
      owns_com_ = true;
    } else {
      error = "CoInitializeEx failed";
      return false;
    }

    ComPtr<IMMDeviceEnumerator> enumerator;
    if (FAILED(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr,
                                CLSCTX_ALL, IID_PPV_ARGS(&enumerator)))) {
      error = "no audio endpoint enumerator";
      return false;
    }
    if (FAILED(enumerator->GetDefaultAudioEndpoint(eRender, eConsole,
                                                   &device_))) {
      error = "no default output device";
      return false;
    }
    if (FAILED(device_->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr,
                                 &client_))) {
      error = "the output device refused to activate";
      return false;
    }

    WAVEFORMATEX* mix = nullptr;
    if (FAILED(client_->GetMixFormat(&mix)) || mix == nullptr) {
      error = "the output device reported no mix format";
      return false;
    }
    const bool floats = is_float32(mix);
    const uint32_t rate = mix->nSamplesPerSec;
    const uint32_t channels = mix->nChannels;

    HRESULT initialised = E_FAIL;
    if (floats) {
      initialised = client_->Initialize(
          AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
          kRequestedBufferDuration, 0, mix, nullptr);
    }
    CoTaskMemFree(mix);
    if (!floats) {
      // Refused with a reason rather than converted silently. Every shared-mode
      // endpoint on a supported Windows mixes in float; one that does not is a
      // machine worth hearing about instead of quietly serving worse audio.
      error = "the output device does not mix in 32-bit float";
      return false;
    }
    if (FAILED(initialised)) {
      error = "the output device refused the shared-mode format";
      return false;
    }

    if (FAILED(client_->GetBufferSize(&buffer_frames_))) {
      error = "the output device reported no buffer size";
      return false;
    }
    event_ = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    if (event_ == nullptr) {
      error = "no render event could be created";
      return false;
    }
    if (FAILED(client_->SetEventHandle(event_))) {
      error = "the output device refused the render event";
      return false;
    }
    if (FAILED(client_->GetService(IID_PPV_ARGS(&render_client_)))) {
      error = "the output device exposed no render client";
      return false;
    }

    format_.sample_rate = rate;
    format_.channels = channels;
    format_.max_block_frames = buffer_frames_;

    // Every buffer the render thread touches, allocated once, here. The engine
    // is planar and the device is interleaved, so the deinterleave scratch is
    // part of the contract rather than an optimisation.
    const uint32_t engine_channels = channels < 2 ? channels : 2;
    planar_.assign(engine_channels,
                   std::vector<float>(buffer_frames_, 0.0f));
    planar_pointers_.clear();
    for (auto& channel : planar_) {
      planar_pointers_.push_back(channel.data());
    }
    return true;
  }

  void teardown() {
    render_client_.Reset();
    client_.Reset();
    device_.Reset();
    if (event_ != nullptr) {
      CloseHandle(event_);
      event_ = nullptr;
    }
    if (owns_com_) {
      CoUninitialize();
      owns_com_ = false;
    }
  }

  /** The real-time thread. Everything it needs already exists. */
  void run() {
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);

    /**
     * Pro Audio, through MMCSS, and not `SetThreadPriority`.
     *
     * A raw priority bump makes the thread compete harder; MMCSS tells the
     * scheduler what kind of work this is, so it is given a guaranteed slice
     * and is exempted from the throttling that applies to ordinary busy
     * threads. Failing to register is survivable and is not treated as fatal —
     * it costs headroom, not correctness.
     */
    DWORD task_index = 0;
    HANDLE task = AvSetMmThreadCharacteristicsW(L"Pro Audio", &task_index);

    if (FAILED(client_->Start())) {
      if (task != nullptr) {
        AvRevertMmThreadCharacteristics(task);
      }
      CoUninitialize();
      return;
    }

    const uint32_t engine_channels =
        static_cast<uint32_t>(planar_pointers_.size());
    const uint32_t device_channels = format_.channels;

    while (!stop_.load(std::memory_order_acquire)) {
      // Two full buffers is far longer than any period; reaching it means the
      // device has stopped asking, which is a dead stream rather than a slow
      // one.
      const DWORD waited = WaitForSingleObject(event_, 2000);
      if (waited != WAIT_OBJECT_0 ||
          stop_.load(std::memory_order_acquire)) {
        break;
      }

      UINT32 padding = 0;
      if (FAILED(client_->GetCurrentPadding(&padding))) {
        break;
      }
      const UINT32 available = buffer_frames_ - padding;
      if (available == 0) {
        continue;
      }

      /**
       * An underrun, as closely as shared mode will admit to one.
       *
       * WASAPI does not report a glitch on the render path, so this is the
       * proxy: the endpoint had drained completely by the time we were woken,
       * which means anything it played in that gap was silence we did not
       * write. Counted from the second period onward — the first is empty by
       * definition, and counting it would report one underrun on every start.
       */
      if (padding == 0 && periods_.load(std::memory_order_relaxed) > 0) {
        underruns_.fetch_add(1, std::memory_order_relaxed);
      }

      BYTE* raw = nullptr;
      if (FAILED(render_client_->GetBuffer(available, &raw))) {
        break;
      }
      auto* interleaved = reinterpret_cast<float*>(raw);

      for (uint32_t channel = 0; channel < engine_channels; ++channel) {
        std::memset(planar_[channel].data(), 0,
                    static_cast<size_t>(available) * sizeof(float));
      }
      render_(context_, planar_pointers_.data(), available);

      // Interleave into whatever width the endpoint has. A stereo programme on
      // a 5.1 endpoint fills the front pair and leaves the rest silent, which
      // is what every other stereo application on the machine does.
      for (uint32_t frame = 0; frame < available; ++frame) {
        float* out = interleaved + static_cast<size_t>(frame) * device_channels;
        for (uint32_t channel = 0; channel < device_channels; ++channel) {
          out[channel] = channel < engine_channels
                             ? planar_[channel][frame]
                             : 0.0f;
        }
      }

      render_client_->ReleaseBuffer(available, 0);
      periods_.fetch_add(1, std::memory_order_relaxed);
    }

    client_->Stop();
    client_->Reset();
    if (task != nullptr) {
      AvRevertMmThreadCharacteristics(task);
    }
    CoUninitialize();
  }

  FeqRenderFn render_ = nullptr;
  void* context_ = nullptr;

  ComPtr<IMMDevice> device_;
  ComPtr<IAudioClient> client_;
  ComPtr<IAudioRenderClient> render_client_;
  HANDLE event_ = nullptr;
  UINT32 buffer_frames_ = 0;
  bool owns_com_ = false;

  FeqBackendFormat format_;
  std::vector<std::vector<float>> planar_;
  std::vector<float*> planar_pointers_;

  std::thread thread_;
  std::atomic<bool> open_{false};
  std::atomic<bool> running_{false};
  std::atomic<bool> stop_{false};
  std::atomic<uint64_t> underruns_{0};
  std::atomic<uint64_t> periods_{0};
};

}  // namespace

std::unique_ptr<IAudioOutputBackend> create_audio_backend(FeqRenderFn render,
                                                          void* context) {
  return std::make_unique<WasapiBackend>(render, context);
}
