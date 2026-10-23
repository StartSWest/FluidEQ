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
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include "capture_args.h"
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

/**
 * One connection to the app's pipe, introduced.
 *
 * The app serves the pipe and takes the first two connections that open with
 * the token it put on this helper's command line; anything else on the pipe is
 * dropped. `frames` is opened overlapped because `CaptureWriter` writes that
 * way, `commands` synchronously because the command reader blocks on it. The
 * pipe exists before the playback helper is asked to start this one, so a
 * busy pipe is only ever another instance being set up: wait on Windows for it
 * to free, never on a clock.
 */
[[nodiscard]] HANDLE open_pipe_connection(const CaptureArgs& args,
                                          const char* role, bool overlapped) {
  for (;;) {
    const HANDLE pipe = CreateFileW(
        args.pipe_name.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr,
        OPEN_EXISTING, overlapped ? FILE_FLAG_OVERLAPPED : 0, nullptr);
    if (pipe != INVALID_HANDLE_VALUE) {
      const std::string hello = "FLUIDEQ-CAPTURE " + args.token + " " + role +
                                " " + std::to_string(GetCurrentProcessId()) +
                                "\n";
      OVERLAPPED operation{};
      operation.hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
      if (operation.hEvent == nullptr) {
        CloseHandle(pipe);
        return INVALID_HANDLE_VALUE;
      }
      DWORD written = 0;
      BOOL sent = WriteFile(pipe, hello.data(),
                            static_cast<DWORD>(hello.size()), &written,
                            overlapped ? &operation : nullptr);
      if (!sent && overlapped && GetLastError() == ERROR_IO_PENDING) {
        sent = GetOverlappedResult(pipe, &operation, &written, TRUE);
      }
      CloseHandle(operation.hEvent);
      if (!sent || written != hello.size()) {
        CloseHandle(pipe);
        return INVALID_HANDLE_VALUE;
      }
      return pipe;
    }
    if (GetLastError() != ERROR_PIPE_BUSY ||
        !WaitNamedPipeW(args.pipe_name.c_str(), NMPWAIT_WAIT_FOREVER)) {
      return INVALID_HANDLE_VALUE;
    }
  }
}

[[nodiscard]] HRESULT activate_process_loopback(
    HANDLE activation_event, DWORD exclude_tree_pid,
    ComPtr<IAudioClient>* audio_client) {
  AUDIOCLIENT_ACTIVATION_PARAMS parameters{};
  parameters.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
  parameters.ProcessLoopbackParams.TargetProcessId = exclude_tree_pid;
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

/**
 * The process loopback this helper captures. A hold-only helper captures
 * nothing and keeps the format it was made with, which its replies carry and
 * nothing reads.
 */
struct Loopback {
  ComPtr<IAudioClient> client;
  ComPtr<IAudioCaptureClient> capture;
  std::uint32_t rate = 48'000;
  std::uint16_t channels = 2;
};

/** Activates, formats and starts it. `step` names what failed. */
[[nodiscard]] HRESULT start_loopback(HANDLE activation_event,
                                     HANDLE sample_event,
                                     DWORD exclude_tree_pid, Loopback* loopback,
                                     const char** step) {
  *step = "process-loopback activation failed";
  HRESULT result = activate_process_loopback(activation_event, exclude_tree_pid,
                                             &loopback->client);
  if (FAILED(result)) {
    return result;
  }
  WAVEFORMATEX* mix_format = nullptr;
  result = loopback->client->GetMixFormat(&mix_format);
  if (FAILED(result)) {
    result = default_render_mix_format(&mix_format);
  }
  if (FAILED(result) || !is_float_mix_format(mix_format)) {
    CoTaskMemFree(mix_format);
    *step = "the process mix is not Float32 PCM";
    return FAILED(result) ? result : E_FAIL;
  }
  loopback->rate = mix_format->nSamplesPerSec;
  loopback->channels = mix_format->nChannels;
  result = loopback->client->Initialize(
      AUDCLNT_SHAREMODE_SHARED,
      AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK, 0, 0,
      mix_format, nullptr);
  CoTaskMemFree(mix_format);
  if (FAILED(result)) {
    *step = "capture format initialization failed";
    return result;
  }
  result = loopback->client->SetEventHandle(sample_event);
  if (FAILED(result)) {
    *step = "capture event registration failed";
    return result;
  }
  result = loopback->client->GetService(
      IID_PPV_ARGS(loopback->capture.ReleaseAndGetAddressOf()));
  if (FAILED(result)) {
    *step = "capture client creation failed";
    return result;
  }
  *step = "capture start failed";
  return loopback->client->Start();
}

[[nodiscard]] int fail(const char* message, HRESULT result) {
  std::fprintf(stderr, "FluidEQ-LAN-Capture: %s (0x%08lx)\n", message,
               static_cast<unsigned long>(result));
  return 1;
}

}  // namespace

int main(int argc, char** argv) {
  CaptureArgs args;
  if (!parse_capture_args(argc, argv, &args)) {
    std::fprintf(stderr,
                 "FluidEQ-LAN-Capture: expected --parent-pid <positive pid> "
                 "and either --pipe-overlapped or --pipe <name> --token <hex> "
                 "[--exclude-tree-pid <pid> | --hold-only]\n");
    return 2;
  }
  const bool piped = !args.pipe_name.empty();
  // Opened before anything slow, so the app hears from this helper at once
  // and a helper it never hears from is one that failed to start.
  const UniqueHandle commands(
      piped ? open_pipe_connection(args, "commands", false) : nullptr);
  const UniqueHandle frames(
      piped ? open_pipe_connection(args, "frames", true) : nullptr);
  if (piped && (!commands.valid() || !frames.valid())) {
    return fail("could not reach the app's pipe",
                HRESULT_FROM_WIN32(GetLastError()));
  }

  const UniqueHandle parent(
      OpenProcess(SYNCHRONIZE, FALSE, args.parent_pid));
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

  Loopback loopback;
  if (!args.hold_only) {
    const char* step = "";
    const HRESULT result = start_loopback(
        activation_event.get(), sample_event.get(),
        args.exclude_tree_pid != 0 ? args.exclude_tree_pid
                                   : GetCurrentProcessId(),
        &loopback, &step);
    if (FAILED(result)) {
      CoUninitialize();
      return fail(step, result);
    }
  }
  ComPtr<IAudioClient>& audio_client = loopback.client;
  ComPtr<IAudioCaptureClient>& capture_client = loopback.capture;
  const std::uint32_t sample_rate = loopback.rate;
  const std::uint16_t channels = loopback.channels;
  HRESULT result = S_OK;
  const auto stop_capture = [&] {
    if (audio_client) {
      audio_client->Stop();
    }
  };

  const HANDLE output = piped ? frames.get() : GetStdHandle(STD_OUTPUT_HANDLE);
  auto writer = std::make_unique<CaptureWriter>(output, parent.get(), sample_rate, channels);
  if (!writer->valid()) {
    stop_capture();
    CoUninitialize();
    return fail("capture pipe is unavailable",
                HRESULT_FROM_WIN32(GetLastError()));
  }

  DWORD mmcss_task = 0;
  const HANDLE mmcss =
      AvSetMmThreadCharacteristicsW(L"Pro Audio", &mmcss_task);
  reply_writer = writer.get();
  bool running = true;
  // The mirrors of the second output are rendered here, so the loopback above
  // never hears them however this helper was started. The capture for the
  // network leaves out the playback helper's whole tree instead, which holds
  // both the sound received from other computers and this helper's mirrors.
  auto mirrors = std::make_unique<MirrorControl>(
      piped ? commands.get() : GetStdHandle(STD_INPUT_HANDLE), sample_rate,
      channels, mirror_reply);
  if (!mirrors->valid()) {
    stop_capture();
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

    // A hold-only helper's sample event has no stream behind it.
    while (running && capture_client) {
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
  stop_capture();
  if (mmcss != nullptr) {
    AvRevertMmThreadCharacteristics(mmcss);
  }
  CoUninitialize();
  return running ? 0 : 1;
}
