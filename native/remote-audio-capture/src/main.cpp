/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include <Windows.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <avrt.h>
#include <ks.h>
#include <ksmedia.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>
#include <wrl/implements.h>

#include <array>
#include <charconv>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string_view>
#include "mirror_control.h"
#include "capture_writer.h"

namespace {

using Microsoft::WRL::ClassicCom;
using Microsoft::WRL::ComPtr;
using Microsoft::WRL::FtmBase;
using Microsoft::WRL::Make;
using Microsoft::WRL::RuntimeClass;
using Microsoft::WRL::RuntimeClassFlags;

constexpr std::uint16_t kMaxChannels = 8;
constexpr DWORD kActivationTimeoutMilliseconds = 10'000;


class UniqueHandle final {
 public:
  UniqueHandle() = default;
  explicit UniqueHandle(HANDLE value) : value_(value) {}
  ~UniqueHandle() {
    if (value_ != nullptr && value_ != INVALID_HANDLE_VALUE) {
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
  HANDLE value_ = nullptr;
};

class ActivationHandler final
    : public RuntimeClass<RuntimeClassFlags<ClassicCom>, FtmBase,
                          IActivateAudioInterfaceCompletionHandler> {
 public:
  HRESULT RuntimeClassInitialize(HANDLE completed) {
    completed_ = completed;
    return completed_ != nullptr ? S_OK : E_INVALIDARG;
  }

  STDMETHODIMP ActivateCompleted(
      IActivateAudioInterfaceAsyncOperation* operation) override {
    ComPtr<IUnknown> activated;
    HRESULT activation_result = E_UNEXPECTED;
    result_ = operation->GetActivateResult(&activation_result, &activated);
    if (SUCCEEDED(result_)) {
      result_ = activation_result;
    }
    if (SUCCEEDED(result_)) {
      result_ = activated.As(&client_);
    }
    SetEvent(completed_);
    return S_OK;
  }

  [[nodiscard]] HRESULT result() const { return result_; }
  [[nodiscard]] ComPtr<IAudioClient> client() const { return client_; }

 private:
  HANDLE completed_ = nullptr;
  HRESULT result_ = E_UNEXPECTED;
  ComPtr<IAudioClient> client_;
};

CaptureWriter* reply_writer = nullptr;
bool mirror_reply(std::uint32_t kind, std::uint32_t id, HRESULT result) {
  return reply_writer != nullptr && reply_writer->reply(kind, id, result);
}

[[nodiscard]] bool is_float_mix_format(const WAVEFORMATEX* format) {
  if (format == nullptr || format->nChannels < 1 ||
      format->nChannels > kMaxChannels || format->nSamplesPerSec < 8'000 ||
      format->nSamplesPerSec > 384'000 || format->wBitsPerSample != 32 ||
      format->nBlockAlign != format->nChannels * sizeof(float)) {
    return false;
  }
  if (format->wFormatTag == WAVE_FORMAT_IEEE_FLOAT) {
    return true;
  }
  if (format->wFormatTag != WAVE_FORMAT_EXTENSIBLE ||
      format->cbSize < sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX)) {
    return false;
  }
  const auto* extensible =
      reinterpret_cast<const WAVEFORMATEXTENSIBLE*>(format);
  return IsEqualGUID(extensible->SubFormat, KSDATAFORMAT_SUBTYPE_IEEE_FLOAT) !=
         FALSE;
}

[[nodiscard]] HRESULT default_render_mix_format(WAVEFORMATEX** format) {
  ComPtr<IMMDeviceEnumerator> enumerator;
  HRESULT result = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr,
                                    CLSCTX_ALL, IID_PPV_ARGS(&enumerator));
  if (FAILED(result)) {
    return result;
  }
  ComPtr<IMMDevice> endpoint;
  result = enumerator->GetDefaultAudioEndpoint(eRender, eMultimedia, &endpoint);
  if (FAILED(result)) {
    return result;
  }
  ComPtr<IAudioClient> endpoint_client;
  result = endpoint->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr,
                              &endpoint_client);
  return FAILED(result) ? result : endpoint_client->GetMixFormat(format);
}

[[nodiscard]] bool parse_parent_pid(int argc, char** argv, DWORD* parent_pid) {
  if (argc != 4 || std::string_view(argv[1]) != "--parent-pid" ||
      std::string_view(argv[3]) != "--pipe-overlapped") {
    return false;
  }
  const std::string_view text(argv[2]);
  DWORD value = 0;
  const auto parsed =
      std::from_chars(text.data(), text.data() + text.size(), value);
  if (parsed.ec != std::errc() || parsed.ptr != text.data() + text.size() ||
      value == 0) {
    return false;
  }
  *parent_pid = value;
  return true;
}

[[nodiscard]] HRESULT activate_process_loopback(
    HANDLE activation_event, ComPtr<IAudioClient>* audio_client) {
  AUDIOCLIENT_ACTIVATION_PARAMS parameters{};
  parameters.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
  parameters.ProcessLoopbackParams.TargetProcessId = GetCurrentProcessId();
  parameters.ProcessLoopbackParams.ProcessLoopbackMode =
      PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE;

  PROPVARIANT activate_parameters{};
  activate_parameters.vt = VT_BLOB;
  activate_parameters.blob.cbSize = sizeof(parameters);
  activate_parameters.blob.pBlobData =
      reinterpret_cast<BYTE*>(&parameters);

  const auto handler = Make<ActivationHandler>();
  if (!handler) {
    return E_OUTOFMEMORY;
  }
  HRESULT result = handler->RuntimeClassInitialize(activation_event);
  if (FAILED(result)) {
    return result;
  }
  ComPtr<IActivateAudioInterfaceAsyncOperation> operation;
  result = ActivateAudioInterfaceAsync(
      VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK, __uuidof(IAudioClient),
      &activate_parameters, handler.Get(), &operation);
  if (FAILED(result)) {
    return result;
  }
  const DWORD wait_result =
      WaitForSingleObject(activation_event, kActivationTimeoutMilliseconds);
  if (wait_result == WAIT_TIMEOUT) {
    return HRESULT_FROM_WIN32(ERROR_TIMEOUT);
  }
  if (wait_result != WAIT_OBJECT_0) {
    return HRESULT_FROM_WIN32(wait_result == WAIT_FAILED ? GetLastError()
                                                        : ERROR_GEN_FAILURE);
  }
  result = handler->result();
  if (SUCCEEDED(result)) {
    *audio_client = handler->client();
  }
  return result;
}

[[nodiscard]] int fail(const char* message, HRESULT result) {
  std::fprintf(stderr, "FluidEQ-LAN-Capture: %s (0x%08lx)\n", message,
               static_cast<unsigned long>(result));
  return 1;
}

}  // namespace

int main(int argc, char** argv) {
  DWORD parent_pid = 0;
  if (!parse_parent_pid(argc, argv, &parent_pid)) {
    std::fprintf(stderr,
                 "FluidEQ-LAN-Capture: expected --parent-pid <positive pid>\n");
    return 2;
  }

  const UniqueHandle parent(
      OpenProcess(SYNCHRONIZE, FALSE, parent_pid));
  if (!parent.valid()) {
    return fail("could not watch the parent process",
                HRESULT_FROM_WIN32(GetLastError()));
  }
  const UniqueHandle activation_event(
      CreateEventW(nullptr, FALSE, FALSE, nullptr));
  const UniqueHandle sample_event(CreateEventW(nullptr, FALSE, FALSE, nullptr));
  if (!activation_event.valid() || !sample_event.valid()) {
    return fail("could not create capture events",
                HRESULT_FROM_WIN32(GetLastError()));
  }

  const HRESULT com_result = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  if (FAILED(com_result)) {
    return fail("could not initialize COM", com_result);
  }

  ComPtr<IAudioClient> audio_client;
  HRESULT result =
      activate_process_loopback(activation_event.get(), &audio_client);
  if (FAILED(result)) {
    CoUninitialize();
    return fail("process-loopback activation failed", result);
  }

  WAVEFORMATEX* mix_format = nullptr;
  result = audio_client->GetMixFormat(&mix_format);
  if (FAILED(result)) {
    result = default_render_mix_format(&mix_format);
  }
  if (FAILED(result) || !is_float_mix_format(mix_format)) {
    CoTaskMemFree(mix_format);
    CoUninitialize();
    return fail("the process mix is not Float32 PCM", FAILED(result) ? result
                                                                    : E_FAIL);
  }
  const std::uint32_t sample_rate = mix_format->nSamplesPerSec;
  const std::uint16_t channels = mix_format->nChannels;

  result = audio_client->Initialize(
      AUDCLNT_SHAREMODE_SHARED,
      AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK, 0, 0,
      mix_format, nullptr);
  CoTaskMemFree(mix_format);
  if (FAILED(result)) {
    CoUninitialize();
    return fail("capture format initialization failed", result);
  }
  result = audio_client->SetEventHandle(sample_event.get());
  if (FAILED(result)) {
    CoUninitialize();
    return fail("capture event registration failed", result);
  }

  ComPtr<IAudioCaptureClient> capture_client;
  result = audio_client->GetService(IID_PPV_ARGS(&capture_client));
  if (FAILED(result)) {
    CoUninitialize();
    return fail("capture client creation failed", result);
  }
  result = audio_client->Start();
  if (FAILED(result)) {
    CoUninitialize();
    return fail("capture start failed", result);
  }

  const HANDLE output = GetStdHandle(STD_OUTPUT_HANDLE);
  auto writer = std::make_unique<CaptureWriter>(output, parent.get(), sample_rate, channels);
  if (!writer->valid()) {
    audio_client->Stop();
    CoUninitialize();
    return fail("capture pipe is unavailable",
                HRESULT_FROM_WIN32(GetLastError()));
  }

  DWORD mmcss_task = 0;
  const HANDLE mmcss =
      AvSetMmThreadCharacteristicsW(L"Pro Audio", &mmcss_task);
  reply_writer = writer.get();
  bool running = true;
  // One helper serves LAN and local outputs. Its own playback is excluded
  // from process-loopback, while remote audio played by Electron is included.
  auto mirrors = std::make_unique<MirrorControl>(sample_rate, channels, mirror_reply);
  if (!mirrors->valid()) {
    audio_client->Stop();
    CoUninitialize();
    return fail("mirror command reader could not start", E_FAIL);
  }

  while (running) {
    std::vector<HANDLE> wait_handles{sample_event.get(), parent.get(), mirrors->event(), writer->event()};
    mirrors->append_events(wait_handles);
    const DWORD wait_result = WaitForMultipleObjects(
        static_cast<DWORD>(wait_handles.size()), wait_handles.data(), FALSE,
        INFINITE);
    if (wait_result == WAIT_OBJECT_0 + 1) {
      break;
    }
    if (wait_result == WAIT_OBJECT_0 + 2) {
      running = mirrors->commands();
      continue;
    }
    if (wait_result == WAIT_OBJECT_0 + 3) {
      running = !writer->failed();
      break;
    }
    if (wait_result >= WAIT_OBJECT_0 + 4 &&
        wait_result < WAIT_OBJECT_0 + wait_handles.size()) {
      mirrors->render(wait_handles[wait_result - WAIT_OBJECT_0]);
      continue;
    }
    if (wait_result != WAIT_OBJECT_0) {
      running = false;
      break;
    }

    while (running) {
      UINT32 packet_frames = 0;
      result = capture_client->GetNextPacketSize(&packet_frames);
      if (FAILED(result)) {
        running = false;
        break;
      }
      if (packet_frames == 0) {
        break;
      }
      BYTE* data = nullptr;
      DWORD flags = 0;
      UINT64 device_position = 0;
      UINT64 qpc_position = 0;
      result = capture_client->GetBuffer(&data, &packet_frames, &flags,
                                         &device_position, &qpc_position);
      if (FAILED(result)) {
        running = false;
        break;
      }

      const auto* samples = reinterpret_cast<const float*>(data);
      mirrors->push(samples, packet_frames,
                    (flags & AUDCLNT_BUFFERFLAGS_SILENT) != 0);
      writer->push(samples, packet_frames,
                   (flags & AUDCLNT_BUFFERFLAGS_SILENT) != 0,
                   (flags & AUDCLNT_BUFFERFLAGS_DATA_DISCONTINUITY) != 0);
      const HRESULT release_result = capture_client->ReleaseBuffer(packet_frames);
      if (FAILED(release_result)) {
        running = false;
      }
    }
  }

  mirrors.reset();
  reply_writer = nullptr;
  writer->stop();
  audio_client->Stop();
  if (mmcss != nullptr) {
    AvRevertMmThreadCharacteristics(mmcss);
  }
  CoUninitialize();
  return running ? 0 : 1;
}
