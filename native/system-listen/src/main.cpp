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
#include <iterator>
#include <memory>
#include "capture_writer.h"
#include "../../common/loopback_capture.h"

namespace {

using feq::listen::DefaultOutputWatch;
using feq::listen::fill_silence;
using feq::listen::Loopback;
using feq::listen::Silence;
using feq::listen::start_loopback;
using feq::listen::start_silence;
using feq::listen::UniqueHandle;
using Microsoft::WRL::ComPtr;
using Microsoft::WRL::Make;

constexpr int kStopped = 0;
constexpr int kFailed = 1;
constexpr int kBadArguments = 2;
constexpr int kOutputChanged = 3;

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
  const UniqueHandle silence_event(
      CreateEventW(nullptr, FALSE, FALSE, nullptr));
  if (!sample_event.valid() || !moved_event.valid() || !stop_event.valid() ||
      !silence_event.valid()) {
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

  ComPtr<IMMDevice> endpoint;
  result = enumerator->GetDefaultAudioEndpoint(eRender, eConsole, &endpoint);
  Loopback loopback;
  Silence silence;
  const char* step = "no default output";
  if (SUCCEEDED(result)) {
    result = start_loopback(endpoint.Get(), sample_event.get(),
                            kCaptureMaxChannels, &loopback, &step);
  }
  int code = FAILED(result) ? fail(step, result) : -1;
  if (code < 0) {
    // Without it the listening still works; only a quiet room is heard as
    // the last thing played. Said once, and the helper carries on.
    const HRESULT quiet =
        start_silence(endpoint.Get(), silence_event.get(), &silence);
    if (FAILED(quiet)) {
      std::fprintf(stderr,
                   "FluidEQ-Listen: no silent stream, so a quiet output holds "
                   "its last block (0x%08lx)\n",
                   static_cast<unsigned long>(quiet));
      silence.client.Reset();
    }
  }

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
    const HANDLE waits[]{sample_event.get(), parent,          stop_event.get(),
                         writer->event(),    moved_event.get(), silence_event.get()};
    const DWORD woke = WaitForMultipleObjects(
        static_cast<DWORD>(std::size(waits)), waits, FALSE, INFINITE);
    if (woke == WAIT_OBJECT_0) {
      code = drain(loopback.capture.Get(), writer.get());
    } else if (woke == WAIT_OBJECT_0 + 1 || woke == WAIT_OBJECT_0 + 2) {
      code = kStopped;
    } else if (woke == WAIT_OBJECT_0 + 3) {
      code = writer->failed() ? fail("stdout broke", E_FAIL) : kStopped;
    } else if (woke == WAIT_OBJECT_0 + 4) {
      std::fprintf(stderr, "FluidEQ-Listen: the default output moved\n");
      code = kOutputChanged;
    } else if (woke == WAIT_OBJECT_0 + 5) {
      const HRESULT quiet = fill_silence(&silence);
      if (quiet == AUDCLNT_E_DEVICE_INVALIDATED) {
        code = kOutputChanged;
      } else if (FAILED(quiet)) {
        code = fail("the silent stream could not be fed", quiet);
      }
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
  if (silence.client) {
    silence.client->Stop();
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
