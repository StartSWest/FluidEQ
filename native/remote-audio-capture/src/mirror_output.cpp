/* FluidEQ — GPL-3.0-or-later */
#include "mirror_output.h"
#include <mmdeviceapi.h>
#include <algorithm>

using Microsoft::WRL::ComPtr;

MirrorOutput::~MirrorOutput() {
  if (client_) { client_->Stop(); }
  renderer_.Reset();
  client_.Reset();
  if (event_ != nullptr) { CloseHandle(event_); }
}

HRESULT MirrorOutput::open(const std::string& guid, std::uint32_t rate,
                           std::uint16_t channels, float volume) {
  if (rate == 0 || channels == 0 || channels > feq::remote::kMaxChannels) {
    return E_INVALIDARG;
  }
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
  REFERENCE_TIME latency = 0;
  if (SUCCEEDED(client_->GetStreamLatency(&latency))) {
    stream_latency_ms_ = static_cast<double>(latency) / 10000.0;
  }
  hr = client_->GetService(IID_PPV_ARGS(&renderer_));
  if (FAILED(hr)) { return hr; }
  rate_ = rate;
  channels_ = channels;
  volume_ = volume;
  // The device was opened at the capture's own rate and layout, so the
  // engine plays one into the other unchanged but for its clock trim.
  playback_ = std::make_unique<feq::remote::PeerPlayback>(rate, channels);
  if (!playback_->output_format(rate, channels, 0)) { return E_INVALIDARG; }
  hr = render();
  return FAILED(hr) ? hr : client_->Start();
}

HRESULT MirrorOutput::push(const float* samples, std::uint32_t frames,
                           bool silent) {
  // In pieces the engine takes: one capture block never comes near it, but a
  // long silence reported at once could.
  while (frames != 0) {
    const std::uint32_t piece = std::min(frames, feq::remote::kMaxPacketFrames);
    const float* data = samples;
    if (silent || samples == nullptr) {
      const std::size_t needed = static_cast<std::size_t>(piece) * channels_;
      if (silence_.size() < needed) { silence_.assign(needed, 0.0F); }
      data = silence_.data();
    }
    // A full buffer is the engine's to handle — a device that stopped asking
    // for sound — and it starts again from the newest instead of growing.
    playback_->push(data, piece, ++sequence_);
    frames -= piece;
    if (samples != nullptr && !silent) {
      samples += static_cast<std::size_t>(piece) * channels_;
    }
  }
  return S_OK;
}

HRESULT MirrorOutput::render() {
  UINT32 padding = 0;
  HRESULT hr = client_->GetCurrentPadding(&padding);
  if (FAILED(hr)) { return hr; }
  padding_ = padding;
  if (padding >= device_frames_) { return S_OK; }
  const UINT32 frames = device_frames_ - padding;
  BYTE* bytes = nullptr;
  hr = renderer_->GetBuffer(frames, &bytes);
  if (FAILED(hr)) { return hr; }
  auto* output = reinterpret_cast<float*>(bytes);
  const std::size_t samples = static_cast<std::size_t>(frames) * channels_;
  std::fill_n(output, samples, 0.0F);
  playback_->mix(output, frames);
  for (std::size_t sample = 0; sample < samples; ++sample) { output[sample] *= volume_; }
  return renderer_->ReleaseBuffer(frames, 0);
}

std::uint32_t MirrorOutput::delay_us() const {
  if (!playback_ || rate_ == 0) { return 0; }
  const double held_ms = static_cast<double>(padding_) * 1000.0 / rate_;
  const double total_ms =
      playback_->stats().buffered_ms + held_ms + stream_latency_ms_;
  return static_cast<std::uint32_t>(std::clamp(total_ms * 1000.0, 0.0, 4.0e9));
}
