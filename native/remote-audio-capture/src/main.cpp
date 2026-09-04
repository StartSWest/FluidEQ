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

namespace {

using Microsoft::WRL::ClassicCom;
using Microsoft::WRL::ComPtr;
using Microsoft::WRL::FtmBase;
using Microsoft::WRL::Make;
using Microsoft::WRL::RuntimeClass;
using Microsoft::WRL::RuntimeClassFlags;

constexpr std::uint32_t kFrameMagic = 0x314e414cU;  // "LAN1" little-endian.
constexpr std::uint32_t kReadyFrame = 1;
constexpr std::uint32_t kAudioFrame = 2;
// Ten milliseconds at the standard 48 kHz mix rate. The previous 1,024-frame
// block held every sample for another 11 ms before transport could begin.
// Smaller packets change only delivery cadence; the Float32 samples themselves
// are copied verbatim.
constexpr std::uint16_t kChunkFrames = 480;
constexpr std::uint16_t kMaxChannels = 8;

#pragma pack(push, 1)
struct FrameHeader {
  std::uint32_t magic;
  std::uint32_t kind;
  std::uint32_t sequence;
  std::uint32_t sample_rate;
  std::uint16_t channels;
  std::uint16_t frames;
  std::uint32_t payload_bytes;
};
#pragma pack(pop)

static_assert(sizeof(FrameHeader) == 24);

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

[[nodiscard]] bool write_all(HANDLE output, const void* data,
                             std::uint32_t bytes) {
  const auto* cursor = static_cast<const std::uint8_t*>(data);
  std::uint32_t remaining = bytes;
  while (remaining > 0) {
    DWORD written = 0;
    if (WriteFile(output, cursor, remaining, &written, nullptr) == FALSE ||
        written == 0) {
      return false;
    }
    cursor += written;
    remaining -= written;
  }
  return true;
}

[[nodiscard]] bool write_header(HANDLE output, std::uint32_t kind,
                                std::uint32_t sequence,
                                std::uint32_t sample_rate,
                                std::uint16_t channels,
                                std::uint16_t frames) {
  const FrameHeader header{
      kFrameMagic,
      kind,
      sequence,
      sample_rate,
      channels,
      frames,
      static_cast<std::uint32_t>(frames) * channels * sizeof(float),
  };
  return write_all(output, &header,
                   static_cast<std::uint32_t>(sizeof(header)));
}

[[nodiscard]] bool write_audio(HANDLE output, std::uint32_t sequence,
                               std::uint32_t sample_rate,
                               std::uint16_t channels, const float* samples) {
  const std::uint32_t payload_bytes =
      kChunkFrames * channels * sizeof(float);
  return write_header(output, kAudioFrame, sequence, sample_rate, channels,
                      kChunkFrames) &&
         write_all(output, samples, payload_bytes);
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
  if (argc != 3 || std::string_view(argv[1]) != "--parent-pid") {
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
  if (WaitForSingleObject(activation_event, INFINITE) != WAIT_OBJECT_0) {
    return HRESULT_FROM_WIN32(GetLastError());
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
  if (output == nullptr || output == INVALID_HANDLE_VALUE ||
      !write_header(output, kReadyFrame, 0, sample_rate, channels, 0)) {
    audio_client->Stop();
    CoUninitialize();
    return fail("capture pipe is unavailable",
                HRESULT_FROM_WIN32(GetLastError()));
  }

  DWORD mmcss_task = 0;
  const HANDLE mmcss =
      AvSetMmThreadCharacteristicsW(L"Pro Audio", &mmcss_task);
  std::array<float, kChunkFrames * kMaxChannels> chunk{};
  std::uint16_t filled_frames = 0;
  std::uint32_t sequence = 0;
  bool running = true;
  const std::array<HANDLE, 2> wait_handles{sample_event.get(), parent.get()};

  while (running) {
    const DWORD wait_result = WaitForMultipleObjects(
        static_cast<DWORD>(wait_handles.size()), wait_handles.data(), FALSE,
        INFINITE);
    if (wait_result == WAIT_OBJECT_0 + 1) {
      break;
    }
    if (wait_result != WAIT_OBJECT_0) {
      running = false;
      break;
    }

    UINT32 packet_frames = 0;
    while (running &&
           SUCCEEDED(capture_client->GetNextPacketSize(&packet_frames)) &&
           packet_frames > 0) {
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
      UINT32 consumed = 0;
      while (running && consumed < packet_frames) {
        const UINT32 capacity = kChunkFrames - filled_frames;
        const UINT32 available = packet_frames - consumed;
        const UINT32 copied = capacity < available ? capacity : available;
        float* destination = chunk.data() + filled_frames * channels;
        if ((flags & AUDCLNT_BUFFERFLAGS_SILENT) != 0 || samples == nullptr) {
          std::memset(destination, 0, copied * channels * sizeof(float));
        } else {
          std::memcpy(destination, samples + consumed * channels,
                      copied * channels * sizeof(float));
        }
        filled_frames =
            static_cast<std::uint16_t>(filled_frames + copied);
        consumed += copied;
        if (filled_frames == kChunkFrames) {
          running =
              write_audio(output, sequence, sample_rate, channels, chunk.data());
          sequence = sequence == UINT32_MAX ? 0 : sequence + 1;
          filled_frames = 0;
        }
      }
      const HRESULT release_result = capture_client->ReleaseBuffer(packet_frames);
      if (FAILED(release_result)) {
        running = false;
      }
    }
  }

  audio_client->Stop();
  if (mmcss != nullptr) {
    AvRevertMmThreadCharacteristics(mmcss);
  }
  CoUninitialize();
  return running ? 0 : 1;
}
