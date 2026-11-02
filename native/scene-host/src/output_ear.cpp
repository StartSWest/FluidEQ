/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "output_ear.h"

#include <audioclient.h>
#include <avrt.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>

#include <cstdio>
#include <iterator>
#include <vector>

#include "../../common/loopback_capture.h"
#include "../../dsp-host/src/platform/windows/device_watch.h"

namespace feq::scene {
namespace {

using feq::listen::fill_silence;
using feq::listen::Loopback;
using feq::listen::Silence;
using feq::listen::start_loopback;
using feq::listen::start_silence;
using feq::listen::UniqueHandle;
using Microsoft::WRL::ComPtr;

/** Up to 7.1: the scenes hear the front pair of anything wider. */
constexpr std::uint16_t kMaxChannels = 8;

void say(const char* what) { std::fprintf(stderr, "FluidEQ-Scenes: %s\n", what); }

int fail(const char* message, HRESULT result) {
  std::fprintf(stderr, "FluidEQ-Scenes: %s (0x%08lx)\n", message,
               static_cast<unsigned long>(result));
  return kEarFailed;
}

void on_outputs_changed(void* reopen) { SetEvent(static_cast<HANDLE>(reopen)); }

}  // namespace

int hear_default_output(HANDLE stop, HANDLE parent,
                        const std::array<double, 3>& accent, EarHooks hooks) {
  const UniqueHandle sample_event(CreateEventW(nullptr, FALSE, FALSE, nullptr));
  const UniqueHandle silence_event(CreateEventW(nullptr, FALSE, FALSE, nullptr));
  const UniqueHandle reopen_event(CreateEventW(nullptr, FALSE, FALSE, nullptr));
  if (!sample_event.valid() || !silence_event.valid() || !reopen_event.valid()) {
    return fail("events could not be made", HRESULT_FROM_WIN32(GetLastError()));
  }
  ComPtr<IMMDeviceEnumerator> enumerator;
  HRESULT result = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr,
                                    CLSCTX_ALL, IID_PPV_ARGS(&enumerator));
  if (FAILED(result)) {
    return fail("the outputs could not be listed", result);
  }
  DeviceWatch watch(on_outputs_changed, reopen_event.get());
  LampEar ear(accent);
  Loopback loopback;
  Silence silence;
  std::vector<float> zeros;
  const auto close = [&] {
    if (loopback.client) {
      loopback.client->Stop();
    }
    if (silence.client) {
      silence.client->Stop();
    }
    loopback = {};
    silence = {};
  };
  const auto open = [&] {
    close();
    watch.await_endpoint();
    ComPtr<IMMDevice> endpoint;
    if (FAILED(enumerator->GetDefaultAudioEndpoint(eRender, eConsole,
                                                   &endpoint))) {
      say("no default output yet; waiting for one");
      return;
    }
    const char* step = "";
    const HRESULT heard_result = start_loopback(
        endpoint.Get(), sample_event.get(), kMaxChannels, &loopback, &step);
    if (FAILED(heard_result)) {
      std::fprintf(stderr, "FluidEQ-Scenes: %s (0x%08lx)\n", step,
                   static_cast<unsigned long>(heard_result));
      loopback = {};
    }
    // Keeps a quiet output sending silence, and is the scenes' clock when the
    // output cannot be heard at all (`lampIdleClock.ts`).
    const HRESULT quiet =
        start_silence(endpoint.Get(), silence_event.get(), &silence);
    if (FAILED(quiet)) {
      silence = {};
    }
    if (loopback.client) {
      ear.listen_at(loopback.rate);
      watch.endpoint_open();
    } else if (silence.client) {
      ear.listen_at(silence.rate);
      watch.endpoint_open();
    }
  };
  open();

  const auto drain = [&]() -> bool {
    for (;;) {
      UINT32 frames = 0;
      HRESULT got = loopback.capture->GetNextPacketSize(&frames);
      if (FAILED(got)) {
        return false;
      }
      if (frames == 0) {
        return true;
      }
      BYTE* data = nullptr;
      DWORD flags = 0;
      got = loopback.capture->GetBuffer(&data, &frames, &flags, nullptr,
                                        nullptr);
      if (FAILED(got)) {
        return false;
      }
      hooks.tune(ear);
      const std::size_t samples =
          static_cast<std::size_t>(frames) * loopback.channels;
      const float* samples_at = reinterpret_cast<const float*>(data);
      if ((flags & AUDCLNT_BUFFERFLAGS_SILENT) != 0) {
        // A silent packet's buffer holds nothing to read: silence is zeros.
        zeros.assign(samples, 0.0F);
        samples_at = zeros.data();
      }
      ear.push(samples_at, frames, loopback.channels, hooks.heard);
      if (FAILED(loopback.capture->ReleaseBuffer(frames))) {
        return false;
      }
    }
  };

  DWORD task_index = 0;
  const HANDLE task = AvSetMmThreadCharacteristicsW(L"Audio", &task_index);
  int code = -1;
  while (code < 0) {
    const HANDLE waits[]{sample_event.get(), silence_event.get(),
                         reopen_event.get(), stop, parent};
    const DWORD woke = WaitForMultipleObjects(
        static_cast<DWORD>(std::size(waits)), waits, FALSE, INFINITE);
    if (woke == WAIT_OBJECT_0) {
      if (loopback.capture && !drain()) {
        say("the output went; opening the default again");
        open();
      }
    } else if (woke == WAIT_OBJECT_0 + 1) {
      UINT32 written = 0;
      if (!silence.client || FAILED(fill_silence(&silence, &written))) {
        open();
      } else if (!loopback.client && written > 0) {
        // Nothing to hear: the scenes rest on the output's own clock.
        hooks.tune(ear);
        zeros.assign(static_cast<std::size_t>(written) * 2, 0.0F);
        ear.push(zeros.data(), written, 2, hooks.heard);
      }
    } else if (woke == WAIT_OBJECT_0 + 2) {
      open();
    } else if (woke == WAIT_OBJECT_0 + 3 || woke == WAIT_OBJECT_0 + 4) {
      code = kEarStopped;
    } else {
      code = fail("waiting failed", HRESULT_FROM_WIN32(GetLastError()));
    }
  }
  if (task != nullptr) {
    AvRevertMmThreadCharacteristics(task);
  }
  close();
  watch.endpoint_closed();
  return code;
}

}  // namespace feq::scene
