/* FluidEQ — GPL-3.0-or-later */
#include "wasapi_output.h"
#include <avrt.h>
#include <ks.h>
#include <ksmedia.h>
#include <algorithm>
#include <cstring>

using Microsoft::WRL::ComPtr;
WasapiOutput::WasapiOutput(HANDLE parent, Render render, void* context)
    : parent_(parent), render_(render), context_(context) {}
WasapiOutput::~WasapiOutput() { close(); }

HRESULT WasapiOutput::open(const std::wstring& guid) {
  close();
  failure_.store(S_OK);
  ComPtr<IMMDeviceEnumerator> enumerator;
  HRESULT result = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr,
      CLSCTX_ALL, IID_PPV_ARGS(&enumerator));
  if (FAILED(result)) return result;
  ComPtr<IMMDevice> device;
  if (guid.empty()) result = enumerator->GetDefaultAudioEndpoint(eRender, eConsole, &device);
  else {
    ComPtr<IMMDeviceCollection> devices;
    result = enumerator->EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE, &devices);
    if (FAILED(result)) return result;
    UINT count = 0;
    devices->GetCount(&count);
    for (UINT i = 0; i < count; ++i) {
      ComPtr<IMMDevice> candidate;
      if (FAILED(devices->Item(i, &candidate))) continue;
      LPWSTR raw = nullptr;
      if (FAILED(candidate->GetId(&raw)) || raw == nullptr) continue;
      const std::wstring id(raw);
      CoTaskMemFree(raw);
      const auto at = id.rfind(L'{');
      if (at != std::wstring::npos && _wcsicmp(id.c_str() + at, guid.c_str()) == 0) {
        device = candidate;
        break;
      }
    }
    result = device ? S_OK : HRESULT_FROM_WIN32(ERROR_NOT_FOUND);
  }
  if (FAILED(result)) return result;
  result = device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr, &client_);
  if (FAILED(result)) return result;
  WAVEFORMATEX* format = nullptr;
  result = client_->GetMixFormat(&format);
  if (FAILED(result) || format == nullptr) return FAILED(result) ? result : E_FAIL;
  const bool extended = format->wFormatTag == WAVE_FORMAT_EXTENSIBLE &&
      format->cbSize >= sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX);
  const auto* ex = reinterpret_cast<WAVEFORMATEXTENSIBLE*>(format);
  const bool floating = format->wFormatTag == WAVE_FORMAT_IEEE_FLOAT ||
      (extended && IsEqualGUID(ex->SubFormat, KSDATAFORMAT_SUBTYPE_IEEE_FLOAT));
  if (!floating || format->wBitsPerSample != 32 || format->nChannels == 0 ||
      format->nChannels > 8 || format->nSamplesPerSec < 8000 || format->nSamplesPerSec > 384000) {
    CoTaskMemFree(format);
    return AUDCLNT_E_UNSUPPORTED_FORMAT;
  }
  rate_ = format->nSamplesPerSec;
  channels_ = format->nChannels;
  mask_ = extended ? ex->dwChannelMask : channels_ == 1 ? 4u : 3u;
  ComPtr<IAudioClient3> low_latency;
  result = E_NOINTERFACE;
  if (SUCCEEDED(client_.As(&low_latency))) {
    UINT32 ordinary = 0, fundamental = 0, minimum = 0, maximum = 0;
    result = low_latency->GetSharedModeEnginePeriod(format, &ordinary, &fundamental, &minimum, &maximum);
    if (SUCCEEDED(result) && fundamental != 0 && minimum <= maximum) {
      // Five milliseconds when supported, rounded to a legal driver period.
      // Normal shared-mode effects stay enabled on the receiving endpoint.
      const UINT32 wanted = std::max(minimum, rate_ / 200);
      const UINT32 period = std::min(maximum, ((wanted + fundamental - 1) / fundamental) * fundamental);
      result = low_latency->InitializeSharedAudioStream(AUDCLNT_STREAMFLAGS_EVENTCALLBACK, period, format, nullptr);
    } else result = E_FAIL;
  }
  if (FAILED(result)) {
    low_latency.Reset();
    client_.Reset();
    result = device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr, &client_);
    if (SUCCEEDED(result)) result = client_->Initialize(AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_EVENTCALLBACK, 0, 0, format, nullptr);
  }
  CoTaskMemFree(format);
  if (FAILED(result)) return result;
  samples_ = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  stop_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (!samples_ || !stop_) return HRESULT_FROM_WIN32(GetLastError());
  result = client_->SetEventHandle(samples_);
  if (SUCCEEDED(result)) result = client_->GetBufferSize(&frames_);
  if (SUCCEEDED(result)) result = client_->GetService(IID_PPV_ARGS(&render_client_));
  return result;
}

HRESULT WasapiOutput::start() {
  if (!client_ || !render_client_ || thread_.joinable()) return E_UNEXPECTED;
  BYTE* prime = nullptr;
  HRESULT result = render_client_->GetBuffer(frames_, &prime);
  if (SUCCEEDED(result)) result = render_client_->ReleaseBuffer(frames_, AUDCLNT_BUFFERFLAGS_SILENT);
  if (SUCCEEDED(result)) result = client_->Start();
  if (SUCCEEDED(result)) thread_ = std::thread([this] { run(); });
  return result;
}

void WasapiOutput::close() {
  if (stop_) SetEvent(stop_);
  if (thread_.joinable()) thread_.join();
  if (client_) client_->Stop();
  render_client_.Reset(); client_.Reset();
  if (samples_) CloseHandle(samples_);
  if (stop_) CloseHandle(stop_);
  samples_ = stop_ = nullptr;
}

void WasapiOutput::run() {
  const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  DWORD task = 0;
  const HANDLE mmcss = AvSetMmThreadCharacteristicsW(L"Pro Audio", &task);
  const HANDLE waits[] = {stop_, parent_, samples_};
  while (WaitForMultipleObjects(3, waits, FALSE, INFINITE) == WAIT_OBJECT_0 + 2) {
    UINT32 padding = 0;
    HRESULT result = client_->GetCurrentPadding(&padding);
    if (FAILED(result)) { failure_.store(result); break; }
    const UINT32 available = frames_ - std::min(frames_, padding);
    if (available == 0) continue;
    BYTE* bytes = nullptr;
    result = render_client_->GetBuffer(available, &bytes);
    if (FAILED(result)) { failure_.store(result); break; }
    std::memset(bytes, 0, static_cast<size_t>(available) * channels_ * sizeof(float));
    render_(context_, reinterpret_cast<float*>(bytes), available);
    result = render_client_->ReleaseBuffer(available, 0);
    if (FAILED(result)) { failure_.store(result); break; }
  }
  if (mmcss) AvRevertMmThreadCharacteristics(mmcss);
  if (SUCCEEDED(com)) CoUninitialize();
}
