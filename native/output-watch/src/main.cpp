/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/*
 * The outputs: when anything about the machine's audio outputs may have
 * moved, told by Windows itself.
 *
 * FluidEQ follows the output Windows plays through — a headset plugged in
 * moves the EQ onto that headset's profile — and it used to find out by
 * reading the whole output list every three seconds while its window was on
 * screen: a PowerShell run each time, twenty a minute, and none at all while
 * the window was hidden or in the tray, which is exactly when a headset gets
 * plugged in without anybody looking at FluidEQ. Windows announces every one
 * of those changes (`IMMNotificationClient`); Electron cannot hear it, because
 * it is a COM interface with callbacks. This process hears it and says so.
 *
 * It holds no state of its own and describes nothing: the app has one reader
 * of the output list (`windows-audio-devices.ps1`), and a second description
 * here would be two answers to the same question to keep in step. It exits
 * when its input closes, which is also what happens when FluidEQ ends however
 * it ends.
 *
 * The protocol is one word a line:
 *
 *   out: outputs   something about the outputs may have moved; read them
 *                  again. Sent once at the start, after the callback is
 *                  registered, so nothing that changes between the app's
 *                  first read and the first callback is lost; then after
 *                  every change. Changes that arrive before the line is
 *                  written collapse into it: the callbacks only set an event
 *                  and the loop writes one line per wake, so a headset
 *                  plugged in — an endpoint added, its state, the default
 *                  for three roles, a dozen properties — is a line or two,
 *                  not twenty.
 *   in:  nothing. The app never writes; a byte on the input is a bug to
 *        surface rather than guess at, and it ends the helper as an unknown
 *        command ends the volume helper.
 *
 * What counts as a change: an endpoint added, removed or changing state;
 * the default render endpoint changing for any role; and a property written
 * that the output list reads — the names, the "Audio enhancements" switch,
 * the shared-mode format, and the effect lists both engines are registered
 * through. Every other property (a Bluetooth headset's battery, a jack's
 * details) is ignored: each line costs the app a PowerShell run, and those
 * change nothing the list says. Added, removed and state changes are not
 * filtered to render endpoints: the only cheap test is the endpoint id's
 * layout, which Windows documents as opaque, so a microphone costs one
 * harmless read instead.
 *
 * Windows' audio services restarting — which the engine's own setup does on
 * every attach, and the Restart button does on purpose — is the one thing
 * this cannot trust the callback to survive, and it is when the effect lists
 * have just changed. So the two services are watched as well, through the
 * service manager's own notification (`NotifyServiceStatusChangeW`, an APC
 * delivered to the loop's alertable wait): each time one of them is running
 * again the callback is registered afresh and the line is sent.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <mmdeviceapi.h>
#include <winsvc.h>

#include <atomic>
#include <cstdio>

namespace {

struct State {
  HANDLE input_closed = nullptr;
  /** Something about the outputs may have moved. */
  HANDLE changed = nullptr;
  std::atomic<bool> bad_input{false};
};

State state;

void say_outputs() {
  std::fputs("outputs\n", stdout);
  std::fflush(stdout);
}

// PKEY_Device_*: the endpoint's name (FriendlyName ,14) and the description a
// rename in Sound settings writes (DeviceDesc ,2), from which Windows builds it.
constexpr GUID kDeviceNames = {
    0xa45c254e, 0xdf1c, 0x4efd, {0x80, 0x20, 0x67, 0xd1, 0x46, 0xa8, 0x50, 0xe0}};
// PKEY_DeviceInterface_FriendlyName: the adapter's half of that name.
constexpr GUID kInterfaceName = {
    0x026e516e, 0xb814, 0x414b, {0x83, 0xcd, 0x85, 0x6d, 0x6f, 0xef, 0x48, 0x22}};
// PKEY_AudioEndpoint_*: Disable_SysFx (,5) is the "Audio enhancements" switch.
constexpr GUID kEndpoint = {
    0x1da5d803, 0xd492, 0x4edd, {0x8c, 0x23, 0xe0, 0xc0, 0xff, 0xee, 0x7f, 0x0e}};
// PKEY_AudioEngine_DeviceFormat: the shared-mode rate and channel count.
constexpr GUID kDeviceFormat = {
    0xf19f064d, 0x082c, 0x4e27, {0xbc, 0x73, 0x68, 0x82, 0xa1, 0xbb, 0x8e, 0x4c}};
// PKEY_FX_*: the effect lists and single values either engine is attached in.
constexpr GUID kEffects = {
    0xd04e05a6, 0x594b, 0x4fb6, {0xa8, 0x0d, 0x01, 0xaf, 0x5e, 0xed, 0x7d, 0x1d}};

bool concerns_the_list(const PROPERTYKEY& key) {
  return IsEqualGUID(key.fmtid, kDeviceNames) ||
         IsEqualGUID(key.fmtid, kInterfaceName) ||
         IsEqualGUID(key.fmtid, kEndpoint) ||
         IsEqualGUID(key.fmtid, kDeviceFormat) ||
         IsEqualGUID(key.fmtid, kEffects);
}

/**
 * Told on Windows' own threads. It only wakes the main loop, which does the
 * writing: Windows asks that these never block, and two threads writing the
 * pipe at once would interleave their lines.
 */
class OutputsCallback final : public IMMNotificationClient {
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
  // Any role: the list marks the console default, and a change of one role
  // alone is still a change somebody made in Sound settings.
  HRESULT STDMETHODCALLTYPE OnDefaultDeviceChanged(EDataFlow flow, ERole,
                                                   LPCWSTR) override {
    if (flow == eRender) {
      SetEvent(state.changed);
    }
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnDeviceAdded(LPCWSTR) override {
    SetEvent(state.changed);
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnDeviceRemoved(LPCWSTR) override {
    SetEvent(state.changed);
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnDeviceStateChanged(LPCWSTR, DWORD) override {
    SetEvent(state.changed);
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnPropertyValueChanged(
      LPCWSTR, const PROPERTYKEY key) override {
    if (concerns_the_list(key)) {
      SetEvent(state.changed);
    }
    return S_OK;
  }
};

// Lives for the whole run, so its reference count is for show: COM holds it
// only between the Register and Unregister calls below.
OutputsCallback outputs_callback;

/** A fresh enumerator with the callback registered on it, or nothing. */
IMMDeviceEnumerator* listen() {
  IMMDeviceEnumerator* devices = nullptr;
  if (FAILED(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr,
                              CLSCTX_ALL, __uuidof(IMMDeviceEnumerator),
                              reinterpret_cast<void**>(&devices))) ||
      devices == nullptr) {
    return nullptr;
  }
  if (FAILED(devices->RegisterEndpointNotificationCallback(&outputs_callback))) {
    devices->Release();
    return nullptr;
  }
  return devices;
}

void stop_listening(IMMDeviceEnumerator* devices) {
  if (devices != nullptr) {
    devices->UnregisterEndpointNotificationCallback(&outputs_callback);
    devices->Release();
  }
}

/**
 * One of Windows' audio services, and whether it has come back.
 *
 * Touched only on the main thread: the service manager's callback is an APC,
 * run inside the loop's own alertable wait.
 */
struct ServiceWatch {
  SC_HANDLE service = nullptr;
  SERVICE_NOTIFYW notify{};
  bool is_running = false;
  bool is_armed = false;
  bool came_back = false;
  /** The service manager said it can no longer tell this watch anything. */
  bool has_failed = false;
};

ServiceWatch services[2];
constexpr const wchar_t* kServiceNames[2] = {L"AudioEndpointBuilder",
                                             L"Audiosrv"};

VOID CALLBACK on_service_changed(PVOID parameter) {
  auto* notify = static_cast<SERVICE_NOTIFYW*>(parameter);
  auto* watch = static_cast<ServiceWatch*>(notify->pContext);
  watch->is_armed = false;
  if (notify->dwNotificationStatus != ERROR_SUCCESS) {
    watch->has_failed = true;
    return;
  }
  const bool is_running =
      notify->ServiceStatus.dwCurrentState == SERVICE_RUNNING;
  if (is_running && !watch->is_running) {
    watch->came_back = true;
  }
  watch->is_running = is_running;
}

/**
 * Asks to be told when the service leaves the state it is in. Only the other
 * states: the service manager answers at once for a state the service is
 * already in, so asking a running service to say when it runs would answer
 * on every wait, for ever.
 */
void arm(ServiceWatch& watch) {
  if (watch.service != nullptr && watch.has_failed) {
    // Asked again it would answer with the same failure, at once, for ever.
    CloseServiceHandle(watch.service);
    watch.service = nullptr;
  }
  if (watch.service == nullptr || watch.is_armed) {
    return;
  }
  watch.notify = SERVICE_NOTIFYW{};
  watch.notify.dwVersion = SERVICE_NOTIFY_STATUS_CHANGE;
  watch.notify.pfnNotifyCallback = on_service_changed;
  watch.notify.pContext = &watch;
  const DWORD states =
      watch.is_running
          ? SERVICE_NOTIFY_STOPPED | SERVICE_NOTIFY_STOP_PENDING |
                SERVICE_NOTIFY_START_PENDING | SERVICE_NOTIFY_PAUSED |
                SERVICE_NOTIFY_PAUSE_PENDING | SERVICE_NOTIFY_CONTINUE_PENDING
          : SERVICE_NOTIFY_RUNNING;
  if (NotifyServiceStatusChangeW(watch.service, states, &watch.notify) ==
      ERROR_SUCCESS) {
    watch.is_armed = true;
    return;
  }
  // Refused — a client too slow to be told, or a service being deleted. The
  // endpoint callback keeps working without it; only a later restart of the
  // audio services goes unseen, and the app's window still re-reads the list
  // whenever it is come back to.
  CloseServiceHandle(watch.service);
  watch.service = nullptr;
}

void watch_services(SC_HANDLE manager) {
  for (int at = 0; at < 2; ++at) {
    ServiceWatch& watch = services[at];
    watch.service =
        OpenServiceW(manager, kServiceNames[at], SERVICE_QUERY_STATUS);
    if (watch.service == nullptr) {
      continue;
    }
    SERVICE_STATUS status{};
    if (!QueryServiceStatus(watch.service, &status)) {
      CloseServiceHandle(watch.service);
      watch.service = nullptr;
      continue;
    }
    watch.is_running = status.dwCurrentState == SERVICE_RUNNING;
    arm(watch);
  }
}

void stop_watching_services() {
  for (ServiceWatch& watch : services) {
    if (watch.service != nullptr) {
      CloseServiceHandle(watch.service);
      watch.service = nullptr;
    }
  }
}

DWORD WINAPI read_input(void*) {
  char buffer[64]{};
  DWORD count = 0;
  // One read: it ends with the app closing its end, or with a byte the app
  // has no reason to send.
  if (ReadFile(GetStdHandle(STD_INPUT_HANDLE), buffer, sizeof(buffer), &count,
               nullptr) &&
      count != 0) {
    state.bad_input.store(true);
  }
  SetEvent(state.input_closed);
  return 0;
}

int run() {
  if (FAILED(CoInitializeEx(nullptr, COINIT_MULTITHREADED))) {
    return 1;
  }
  state.input_closed = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  state.changed = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  if (state.input_closed == nullptr || state.changed == nullptr) {
    return 1;
  }
  IMMDeviceEnumerator* devices = listen();
  if (devices == nullptr) {
    return 1;
  }
  const SC_HANDLE manager = OpenSCManagerW(nullptr, nullptr, SC_MANAGER_CONNECT);
  if (manager != nullptr) {
    watch_services(manager);
  }
  const HANDLE reader = CreateThread(nullptr, 0, read_input, nullptr, 0, nullptr);
  if (reader == nullptr) {
    stop_watching_services();
    stop_listening(devices);
    return 1;
  }
  CloseHandle(reader);

  say_outputs();
  int code = 0;
  for (;;) {
    HANDLE handles[]{state.input_closed, state.changed};
    const DWORD result =
        WaitForMultipleObjectsEx(2, handles, FALSE, INFINITE, TRUE);
    if (result == WAIT_IO_COMPLETION) {
      bool is_renewed = false;
      for (ServiceWatch& watch : services) {
        is_renewed = is_renewed || watch.came_back;
        watch.came_back = false;
        arm(watch);
      }
      if (is_renewed) {
        stop_listening(devices);
        devices = listen();
        if (devices == nullptr) {
          // Deaf from here on, so say so by ending: the app hears the exit
          // and starts another on its next wake-up.
          code = 1;
          break;
        }
        say_outputs();
      }
      continue;
    }
    if (result == WAIT_FAILED) {
      code = 1;
      break;
    }
    if (result == WAIT_OBJECT_0) {
      code = state.bad_input.load() ? 2 : 0;
      break;
    }
    if (result == WAIT_OBJECT_0 + 1) {
      say_outputs();
    }
  }
  stop_watching_services();
  if (manager != nullptr) {
    CloseServiceHandle(manager);
  }
  stop_listening(devices);
  CoUninitialize();
  return code;
}

}  // namespace

int main() { return run(); }
