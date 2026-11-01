/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * FluidEQ-Listen: what the speakers play, for the app's live displays.
 *
 * The graph, the meters, the visualizers, the desk lights and the desktop
 * backgrounds all move to the sound on its way to the output, after the EQ.
 * The window used to hear it through Chromium's screen sharing, which is the
 * only way a page is handed Windows' loopback: it brought a video feed nobody
 * wanted and a capture process of its own, 66 MB of it, for as long as
 * anything was listening. This is the same WASAPI loopback of the same
 * default output, taken by a program the size of the sound.
 *
 * Frames go out on stdout in the capture helper's wire (`capture_writer.h`,
 * read by `captureFrames.ts`): one ready frame with the rate and channel count,
 * then audio. stdout must be overlapped (Node's `stdio: 'overlapped'`).
 *
 * Ends with 0 when stdin closes or the parent goes, which is the app saying it
 * is done; with 3 when Windows moves the default output or invalidates the one
 * being heard, which the app answers by starting it again on the new one; with
 * 1 on any failure, which it does not.
 */

#include <Windows.h>
#include <audioclient.h>
#include <avrt.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>
#include <wrl/implements.h>

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <memory>
#include "capture_writer.h"
#include "../../common/float_mix_format.h"

namespace {

using Microsoft::WRL::ClassicCom;
using Microsoft::WRL::ComPtr;
using Microsoft::WRL::Make;
using Microsoft::WRL::RuntimeClass;
using Microsoft::WRL::RuntimeClassFlags;

constexpr int kStopped = 0;
constexpr int kFailed = 1;
constexpr int kBadArguments = 2;
constexpr int kOutputChanged = 3;

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

/**
 * stdin reaching its end is the app letting go. Read on a thread of its own
 * because the read blocks; the thread is never joined — the process ends
 * under it, which is the only way a blocked console read is let go of.
 */
DWORD WINAPI watch_stdin(void* stop_event) {
  const HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  char byte = 0;
  DWORD read = 0;
  while (ReadFile(input, &byte, 1, &read, nullptr) != FALSE && read != 0) {
  }
  SetEvent(static_cast<HANDLE>(stop_event));
  return 0;
}

[[nodiscard]] bool parse_parent_pid(int argc, char** argv, DWORD* parent_pid) {
  if (argc != 3 || std::strcmp(argv[1], "--parent-pid") != 0) {
    return false;
  }
  char* end = nullptr;
  const unsigned long value = std::strtoul(argv[2], &end, 10);
  if (end == argv[2] || *end != '\0' || value == 0 || value > 0xffffffffUL) {
    return false;
  }
  *parent_pid = static_cast<DWORD>(value);
  return true;
}

struct Loopback {
  ComPtr<IAudioClient> client;
  ComPtr<IAudioCaptureClient> capture;
  std::uint32_t rate = 0;
  std::uint16_t channels = 0;
};

/** The default output's loopback, started. `step` names what failed. */
[[nodiscard]] HRESULT start_loopback(IMMDeviceEnumerator* enumerator,
                                     HANDLE sample_event, Loopback* loopback,
                                     const char** step) {
  *step = "no default output";
  ComPtr<IMMDevice> endpoint;
  HRESULT result =
      enumerator->GetDefaultAudioEndpoint(eRender, eConsole, &endpoint);
  if (FAILED(result)) {
    return result;
  }
  *step = "the output could not be opened";
  result = endpoint->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr,
                              &loopback->client);
  if (FAILED(result)) {
    return result;
  }
  WAVEFORMATEX* mix_format = nullptr;
  result = loopback->client->GetMixFormat(&mix_format);
  if (FAILED(result) ||
      !feq::is_float_mix_format(mix_format, kCaptureMaxChannels)) {
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

[[nodiscard]] int fail(const char* message, HRESULT result) {
  std::fprintf(stderr, "FluidEQ-Listen: %s (0x%08lx)\n", message,
               static_cast<unsigned long>(result));
  return kFailed;
}

/**
 * Everything the loopback has ready, passed on. Returns the exit code to end
 * with, or -1 to carry on.
 */
[[nodiscard]] int drain(IAudioCaptureClient* capture, CaptureWriter* writer) {
  for (;;) {
    UINT32 frames = 0;
    HRESULT result = capture->GetNextPacketSize(&frames);
    if (result == AUDCLNT_E_DEVICE_INVALIDATED) {
      return kOutputChanged;
    }
    if (FAILED(result)) {
      return fail("the loopback could not be read", result);
    }
    if (frames == 0) {
      return -1;
    }
    BYTE* data = nullptr;
    DWORD flags = 0;
    result = capture->GetBuffer(&data, &frames, &flags, nullptr, nullptr);
    if (result == AUDCLNT_E_DEVICE_INVALIDATED) {
      return kOutputChanged;
    }
    if (FAILED(result)) {
      return fail("the loopback's buffer could not be read", result);
    }
    writer->push(reinterpret_cast<const float*>(data), frames,
                 (flags & AUDCLNT_BUFFERFLAGS_SILENT) != 0,
                 (flags & AUDCLNT_BUFFERFLAGS_DATA_DISCONTINUITY) != 0);
    result = capture->ReleaseBuffer(frames);
    if (FAILED(result)) {
      return fail("the loopback's buffer could not be released", result);
    }
  }
}

/** The loopback, its writer and the waits between them, until one ends it. */
[[nodiscard]] int listen(HANDLE parent, IMMDeviceEnumerator* enumerator) {
  const UniqueHandle sample_event(CreateEventW(nullptr, FALSE, FALSE, nullptr));
  const UniqueHandle moved_event(CreateEventW(nullptr, FALSE, FALSE, nullptr));
  const UniqueHandle stop_event(CreateEventW(nullptr, TRUE, FALSE, nullptr));
  if (!sample_event.valid() || !moved_event.valid() || !stop_event.valid()) {
    return fail("events could not be made", HRESULT_FROM_WIN32(GetLastError()));
  }
  const auto watch = Make<DefaultOutputWatch>();
  if (!watch || FAILED(watch->RuntimeClassInitialize(moved_event.get()))) {
    return fail("the output watch could not be made", E_OUTOFMEMORY);
  }
  HRESULT result = enumerator->RegisterEndpointNotificationCallback(watch.Get());
  if (FAILED(result)) {
    return fail("the output watch could not be registered", result);
  }

  Loopback loopback;
  const char* step = "";
  result = start_loopback(enumerator, sample_event.get(), &loopback, &step);
  int code = FAILED(result) ? fail(step, result) : -1;

  std::unique_ptr<CaptureWriter> writer;
  if (code < 0) {
    writer = std::make_unique<CaptureWriter>(GetStdHandle(STD_OUTPUT_HANDLE),
                                             parent, loopback.rate,
                                             loopback.channels);
    if (!writer->valid()) {
      code = fail("stdout could not be written", HRESULT_FROM_WIN32(GetLastError()));
    }
  }
  if (code < 0) {
    const HANDLE reader =
        CreateThread(nullptr, 0, watch_stdin, stop_event.get(), 0, nullptr);
    if (reader == nullptr) {
      code = fail("stdin could not be watched", HRESULT_FROM_WIN32(GetLastError()));
    } else {
      CloseHandle(reader);
    }
  }

  DWORD task_index = 0;
  const HANDLE task =
      code < 0 ? AvSetMmThreadCharacteristicsW(L"Pro Audio", &task_index)
               : nullptr;
  while (code < 0) {
    const HANDLE waits[]{sample_event.get(), parent, stop_event.get(),
                         writer->event(), moved_event.get()};
    const DWORD woke =
        WaitForMultipleObjects(5, waits, FALSE, INFINITE);
    if (woke == WAIT_OBJECT_0) {
      code = drain(loopback.capture.Get(), writer.get());
    } else if (woke == WAIT_OBJECT_0 + 1 || woke == WAIT_OBJECT_0 + 2) {
      code = kStopped;
    } else if (woke == WAIT_OBJECT_0 + 3) {
      code = writer->failed() ? fail("stdout broke", E_FAIL) : kStopped;
    } else if (woke == WAIT_OBJECT_0 + 4) {
      std::fprintf(stderr, "FluidEQ-Listen: the default output moved\n");
      code = kOutputChanged;
    } else {
      code = fail("waiting failed", HRESULT_FROM_WIN32(GetLastError()));
    }
  }
  if (task != nullptr) {
    AvRevertMmThreadCharacteristics(task);
  }
  if (writer) {
    writer->stop();
  }
  if (loopback.client) {
    loopback.client->Stop();
  }
  enumerator->UnregisterEndpointNotificationCallback(watch.Get());
  return code;
}

}  // namespace

int main(int argc, char** argv) {
  DWORD parent_pid = 0;
  if (!parse_parent_pid(argc, argv, &parent_pid)) {
    std::fprintf(stderr, "FluidEQ-Listen: expected --parent-pid <pid>\n");
    return kBadArguments;
  }
  const UniqueHandle parent(OpenProcess(SYNCHRONIZE, FALSE, parent_pid));
  if (!parent.valid()) {
    return fail("the parent could not be watched",
                HRESULT_FROM_WIN32(GetLastError()));
  }
  const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  if (FAILED(com)) {
    return fail("COM could not start", com);
  }
  int code = kFailed;
  {
    ComPtr<IMMDeviceEnumerator> enumerator;
    const HRESULT result =
        CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                         IID_PPV_ARGS(&enumerator));
    code = FAILED(result) ? fail("the outputs could not be listed", result)
                          : listen(parent.get(), enumerator.Get());
  }
  CoUninitialize();
  return code;
}
