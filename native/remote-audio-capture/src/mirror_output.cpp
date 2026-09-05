/* FluidEQ — GPL-3.0-or-later */
#include "mirror_output.h"
#include <mmdeviceapi.h>
#include <algorithm>
#include <cmath>
#include <cstring>

using Microsoft::WRL::ComPtr;

MirrorOutput::~MirrorOutput() {
  if (client_) { client_->Stop(); }
  renderer_.Reset();
  client_.Reset();
  if (event_ != nullptr) { CloseHandle(event_); }
}

HRESULT MirrorOutput::open(const std::string& guid, std::uint32_t rate,
                           std::uint16_t channels, bool video, float volume) {
  // Only endpoint GUIDs are accepted; never resolve a name or fall back to the
  // default. The latter would duplicate the primary instead of opening B.
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
  WAVEFORMATEX format{};
  format.wFormatTag = WAVE_FORMAT_IEEE_FLOAT;
  format.nChannels = channels;
  format.nSamplesPerSec = rate;
  format.wBitsPerSample = 32;
  format.nBlockAlign = static_cast<WORD>(channels * sizeof(float));
  format.nAvgBytesPerSec = rate * format.nBlockAlign;
  // Shared mode with effects enabled: B's APO belongs here. Windows performs
  // endpoint rate/channel conversion; neither A's EQ nor an inverse is applied.
  hr = client_->Initialize(AUDCLNT_SHAREMODE_SHARED,
      AUDCLNT_STREAMFLAGS_EVENTCALLBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM |
      AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY, 0, 0, &format, nullptr);
  if (FAILED(hr)) { return hr; }
  event_ = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  if (event_ == nullptr) { return HRESULT_FROM_WIN32(GetLastError()); }
  hr = client_->SetEventHandle(event_);
  if (FAILED(hr)) { return hr; }
  hr = client_->GetBufferSize(&device_frames_);
  if (FAILED(hr)) { return hr; }
  hr = client_->GetService(IID_PPV_ARGS(&renderer_));
  if (FAILED(hr)) { return hr; }
  rate_ = rate;
  channels_ = channels;
  capacity_ = rate * 2;
  ring_.resize(static_cast<std::size_t>(capacity_) * channels);
  video_ = video;
  volume_ = volume;
  base_target_ = std::max(rate * (video ? 0.03 : 0.1),
                          static_cast<double>(device_frames_) * 2);
  target_ = base_target_;
  hr = render();
  return FAILED(hr) ? hr : client_->Start();
}

HRESULT MirrorOutput::push(const float* samples, std::uint32_t frames,
                           bool silent) {
  // Bounded even if a device stops requesting samples. Fail visibly instead
  // of quietly dropping music or accumulating an unbounded queue.
  if (written_ - read_ + frames > capacity_) { return E_OUTOFMEMORY; }
  for (std::uint32_t frame = 0; frame < frames; ++frame) {
    float* destination = ring_.data() +
        ((written_ + frame) % capacity_) * channels_;
    if (silent || samples == nullptr) {
      std::fill_n(destination, channels_, 0.0F);
    } else {
      std::memcpy(destination, samples + frame * channels_,
                  channels_ * sizeof(float));
    }
  }
  written_ += frames;
  return S_OK;
}

HRESULT MirrorOutput::render() {
  UINT32 padding = 0;
  HRESULT hr = client_->GetCurrentPadding(&padding);
  if (FAILED(hr)) { return hr; }
  if (padding >= device_frames_) { return S_OK; }
  const UINT32 frames = device_frames_ - padding;
  BYTE* bytes = nullptr;
  hr = renderer_->GetBuffer(frames, &bytes);
  if (FAILED(hr)) { return hr; }
  auto* output = reinterpret_cast<float*>(bytes);
  std::fill_n(output, static_cast<std::size_t>(frames) * channels_, 0.0F);
  double queued = static_cast<double>(written_ - read_) - phase_;
  if (!primed_ && queued >= target_ + frames) { primed_ = true; }
  if (primed_) {
    std::uint64_t skip = 0;
    if (video_ && queued > target_ + frames + rate_ * 0.03) {
      skip = static_cast<std::uint64_t>(queued - target_ - frames);
    }
    // Compensate independent device clocks gently. Large video backlog uses
    // a short crossfade, while music never discards a prefix to catch up.
    const double error = queued - target_ - frames;
    const double deadband = rate_ * (video_ ? 0.005 : 0.02);
    const double step = std::abs(error) <= deadband ? 1.0 :
        1.0 + std::clamp(error / (rate_ * 10.0), -0.003, 0.003);
    for (UINT32 frame = 0; frame < frames; ++frame) {
      if (read_ + skip + 1 >= written_) {
        primed_ = false;
        stable_frames_ = 0;
        target_ = std::min(target_ + rate_ * (video_ ? 0.01 : 0.05),
                          std::max(base_target_, rate_ * (video_ ? 0.12 : 0.5)));
        break;
      }
      for (std::uint16_t channel = 0; channel < channels_; ++channel) {
        const auto sample_at = [&](std::uint64_t position) {
          const float a = ring_[(position % capacity_) * channels_ + channel];
          const float b = ring_[((position + 1) % capacity_) * channels_ + channel];
          return a + static_cast<float>(phase_) * (b - a);
        };
        float sample = sample_at(read_ + skip);
        if (skip > 0 && frame < 128) {
          const float blend = static_cast<float>(frame) / 128.0F;
          sample = sample_at(read_) * (1 - blend) + sample * blend;
        }
        output[frame * channels_ + channel] = sample * volume_;
      }
      phase_ += step;
      const auto consumed = static_cast<std::uint64_t>(phase_);
      read_ += consumed;
      phase_ -= static_cast<double>(consumed);
    }
    read_ += skip;
    stable_frames_ += frames;
    if (video_ && stable_frames_ >= rate_ * 2.0) {
      target_ = std::max(base_target_, target_ - rate_ * 0.01);
      stable_frames_ = 0;
    }
  }
  return renderer_->ReleaseBuffer(frames, 0);
}
