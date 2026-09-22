/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/*
 * The system volume: the level and mute of the output Windows plays through,
 * as the speaker icon in the taskbar shows them.
 *
 * The compact player's volume slider drives this when what is playing is not
 * one of FluidEQ's own players — another program, or nothing yet — and has
 * to follow it when the level is changed anywhere else: the keyboard's volume
 * keys, the taskbar flyout, another app. Windows says so itself
 * (`IAudioEndpointVolume::RegisterControlChangeNotify`), and says when the
 * default output changes (`IMMNotificationClient`), so nothing here polls.
 * Electron cannot reach either: both are COM interfaces with callbacks.
 *
 * It runs only while the player shows the slider, it holds no state of its
 * own, and it exits when its input closes, which is also what happens when
 * FluidEQ ends however it ends.
 *
 * The protocol is one record a line, tab between the fields:
 *
 *   out: volume <tab> level <tab> muted   the level (0..1, as the taskbar's
 *                                         slider reads it) and 0 or 1; sent
 *                                         at once, and after every change
 *   out: none                             no output to control
 *   in:  set <space> level                a level from 0 to 1
 *   in:  mute <space> 0|1
 *
 * A line that is none of those ends the helper: the app is the only writer,
 * and a malformed command from it is a bug to surface, not to guess at.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <endpointvolume.h>
#include <mmdeviceapi.h>

#include <atomic>
#include <cstdio>
#include <cstdlib>
#include <string>

namespace {

struct State {
  HANDLE input_closed = nullptr;
  /** A command arrived; which one, the fields below say. */
  HANDLE asked = nullptr;
  /** The level or mute changed, from here or anywhere else. */
  HANDLE changed = nullptr;
  /** The default output changed, or went away. */
  HANDLE output_changed = nullptr;
  std::atomic<bool> set_wanted{false};
  std::atomic<float> set_level{0.0f};
  std::atomic<int> mute_wanted{-1};
  std::atomic<bool> bad_command{false};
  std::atomic<float> level{0.0f};
  std::atomic<bool> muted{false};
};

State state;

void say(const std::string& line) {
  std::fputs(line.c_str(), stdout);
  std::fputc('\n', stdout);
  std::fflush(stdout);
}

void report_level(float level, bool muted) {
  char line[48]{};
  std::snprintf(line, sizeof(line), "volume\t%.4f\t%d",
                static_cast<double>(level), muted ? 1 : 0);
  say(line);
}

/**
 * Told on Windows' own thread whenever the level or mute changes; it only
 * records what it was told and wakes the main loop, which does the writing,
 * so the two never write to the pipe at once.
 */
class VolumeCallback final : public IAudioEndpointVolumeCallback {
 public:
  ULONG STDMETHODCALLTYPE AddRef() override { return 2; }
  ULONG STDMETHODCALLTYPE Release() override { return 1; }
  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid,
                                           void** object) override {
    if (object == nullptr) {
      return E_POINTER;
    }
    if (riid == __uuidof(IUnknown) ||
        riid == __uuidof(IAudioEndpointVolumeCallback)) {
      *object = static_cast<IAudioEndpointVolumeCallback*>(this);
      return S_OK;
    }
    *object = nullptr;
    return E_NOINTERFACE;
  }
  HRESULT STDMETHODCALLTYPE
  OnNotify(PAUDIO_VOLUME_NOTIFICATION_DATA data) override {
    if (data == nullptr) {
      return E_INVALIDARG;
    }
    state.level.store(data->fMasterVolume);
    state.muted.store(data->bMuted != FALSE);
    SetEvent(state.changed);
    return S_OK;
  }
};

/** Told when the default output changes; the main loop binds the new one. */
class OutputCallback final : public IMMNotificationClient {
 public:
  ULONG STDMETHODCALLTYPE AddRef() override { return 2; }
  ULONG STDMETHODCALLTYPE Release() override { return 1; }
  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid,
                                           void** object) override {
    if (object == nullptr) {
      return E_POINTER;
    }
    if (riid == __uuidof(IUnknown) || riid == __uuidof(IMMNotificationClient)) {
      *object = static_cast<IMMNotificationClient*>(this);
      return S_OK;
    }
    *object = nullptr;
    return E_NOINTERFACE;
  }
  HRESULT STDMETHODCALLTYPE OnDefaultDeviceChanged(EDataFlow flow, ERole role,
                                                   LPCWSTR) override {
    if (flow == eRender && role == eConsole) {
      SetEvent(state.output_changed);
    }
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnDeviceAdded(LPCWSTR) override { return S_OK; }
  HRESULT STDMETHODCALLTYPE OnDeviceRemoved(LPCWSTR) override { return S_OK; }
  HRESULT STDMETHODCALLTYPE OnDeviceStateChanged(LPCWSTR, DWORD) override {
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnPropertyValueChanged(LPCWSTR,
                                                   const PROPERTYKEY) override {
    return S_OK;
  }
};

// Both live for the whole run, so their reference counts are for show: COM
// holds them only between the Register and Unregister calls below.
VolumeCallback volume_callback;
OutputCallback output_callback;

/** "set 0.42" or "mute 1"; anything else is refused. */
bool take_command(const char* command, std::size_t length) {
  const std::string text(command, length);
  if (text.rfind("mute ", 0) == 0 && text.size() == 6 &&
      (text[5] == '0' || text[5] == '1')) {
    state.mute_wanted.store(text[5] == '1' ? 1 : 0);
    return true;
  }
  if (text.rfind("set ", 0) != 0 || text.size() < 5 || text.size() > 12) {
    return false;
  }
  for (std::size_t at = 4; at < text.size(); ++at) {
    const char value = text[at];
    if ((value < '0' || value > '9') && value != '.') {
      return false;
    }
  }
  char* end = nullptr;
  const double level = std::strtod(text.c_str() + 4, &end);
  if (end != text.c_str() + text.size() || !(level >= 0.0 && level <= 1.0)) {
    return false;
  }
  state.set_level.store(static_cast<float>(level));
  state.set_wanted.store(true);
  return true;
}

DWORD WINAPI read_input(void*) {
  char buffer[64]{};
  char command[16]{};
  std::size_t used = 0;
  DWORD count = 0;
  while (ReadFile(GetStdHandle(STD_INPUT_HANDLE), buffer, sizeof(buffer),
                  &count, nullptr) &&
         count != 0) {
    for (DWORD at = 0; at < count; ++at) {
      const char value = buffer[at];
      if (value == '\r') {
        continue;
      }
      if (value == '\n') {
        if (!take_command(command, used)) {
          state.bad_command.store(true);
          SetEvent(state.asked);
          return 0;
        }
        used = 0;
        SetEvent(state.asked);
        continue;
      }
      if (used >= sizeof(command)) {
        state.bad_command.store(true);
        SetEvent(state.asked);
        return 0;
      }
      command[used++] = value;
    }
  }
  SetEvent(state.input_closed);
  return 0;
}

/** The default output's volume control, or nothing when there is none. */
IAudioEndpointVolume* bind_output(IMMDeviceEnumerator* devices) {
  IMMDevice* device = nullptr;
  if (FAILED(devices->GetDefaultAudioEndpoint(eRender, eConsole, &device)) ||
      device == nullptr) {
    return nullptr;
  }
  IAudioEndpointVolume* volume = nullptr;
  const HRESULT activated =
      device->Activate(__uuidof(IAudioEndpointVolume), CLSCTX_ALL, nullptr,
                       reinterpret_cast<void**>(&volume));
  device->Release();
  if (FAILED(activated) || volume == nullptr) {
    return nullptr;
  }
  if (FAILED(volume->RegisterControlChangeNotify(&volume_callback))) {
    volume->Release();
    return nullptr;
  }
  return volume;
}

void release_output(IAudioEndpointVolume* volume) {
  if (volume != nullptr) {
    volume->UnregisterControlChangeNotify(&volume_callback);
    volume->Release();
  }
}

/** Say what the output is at now: the first record, and after a change of output. */
void report_output(IAudioEndpointVolume* volume) {
  float level = 0.0f;
  BOOL muted = FALSE;
  if (volume == nullptr || FAILED(volume->GetMasterVolumeLevelScalar(&level)) ||
      FAILED(volume->GetMute(&muted))) {
    say("none");
    return;
  }
  report_level(level, muted != FALSE);
}

int run() {
  if (FAILED(CoInitializeEx(nullptr, COINIT_MULTITHREADED))) {
    return 1;
  }
  state.input_closed = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  state.asked = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  state.changed = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  state.output_changed = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  if (state.input_closed == nullptr || state.asked == nullptr ||
      state.changed == nullptr || state.output_changed == nullptr) {
    return 1;
  }
  IMMDeviceEnumerator* devices = nullptr;
  if (FAILED(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr,
                              CLSCTX_ALL, __uuidof(IMMDeviceEnumerator),
                              reinterpret_cast<void**>(&devices))) ||
      devices == nullptr) {
    return 1;
  }
  if (FAILED(devices->RegisterEndpointNotificationCallback(&output_callback))) {
    devices->Release();
    return 1;
  }
  const HANDLE reader = CreateThread(nullptr, 0, read_input, nullptr, 0, nullptr);
  if (reader == nullptr) {
    devices->UnregisterEndpointNotificationCallback(&output_callback);
    devices->Release();
    return 1;
  }
  CloseHandle(reader);

  IAudioEndpointVolume* volume = bind_output(devices);
  report_output(volume);
  for (;;) {
    HANDLE handles[]{state.input_closed, state.asked, state.changed,
                     state.output_changed};
    const DWORD result =
        WaitForMultipleObjects(4, handles, FALSE, INFINITE);
    if (result == WAIT_OBJECT_0 || result == WAIT_FAILED) {
      break;
    }
    if (result == WAIT_OBJECT_0 + 1) {
      if (state.bad_command.load()) {
        break;
      }
      // Windows answers each of these through the callback like any other
      // change, and that answer is what the app draws.
      if (volume != nullptr && state.set_wanted.exchange(false)) {
        volume->SetMasterVolumeLevelScalar(state.set_level.load(), nullptr);
      }
      const int mute = state.mute_wanted.exchange(-1);
      if (volume != nullptr && mute >= 0) {
        volume->SetMute(mute == 1 ? TRUE : FALSE, nullptr);
      }
    }
    if (result == WAIT_OBJECT_0 + 2) {
      report_level(state.level.load(), state.muted.load());
    }
    if (result == WAIT_OBJECT_0 + 3) {
      release_output(volume);
      volume = bind_output(devices);
      report_output(volume);
    }
  }
  release_output(volume);
  devices->UnregisterEndpointNotificationCallback(&output_callback);
  devices->Release();
  CoUninitialize();
  return 0;
}

}  // namespace

int main() { return run(); }
