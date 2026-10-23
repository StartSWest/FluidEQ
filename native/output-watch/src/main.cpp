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
 * the default render endpoint changing for any role; a property written
 * that the output list reads — the names, the "Audio enhancements" switch,
 * the shared-mode format, and the effect lists both engines are registered
 * through; and a Bluetooth device's battery level, which the list carries
 * beside the outputs it belongs to. That one is not an endpoint property: it
 * lives on the Bluetooth device's own node, so it is watched through a
 * device query Windows updates when the level moves (`DevCreateObjectQuery`,
 * as Windows' own Bluetooth page is) — nothing polls, and a percent moves
 * every few minutes at most. Every other property (a jack's details) is
 * ignored: each line costs the app a PowerShell run, and those change
 * nothing the list says. Added, removed and state changes are not
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

#include <devquery.h>
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

// DEVPKEY_Bluetooth_Battery: the percentage a Bluetooth device reports to
// Windows. Not in the SDK's headers; the same key `windows-audio-devices.ps1`
// reads the level with.
constexpr DEVPROPKEY kBluetoothBattery = {
    {0x104ea319, 0x6ee2, 0x4701, {0xbd, 0x47, 0x8d, 0xdb, 0xf4, 0x25, 0xbb, 0xe5}},
    2};

/**
 * Whether the battery query has listed what was already there. Its first
 * answers are every device that has a level now, which the app's first read
 * already holds; only what comes after is news.
 */
std::atomic<bool> batteries_listed{false};

/** Told on a thread of the query's own, so it only wakes the loop. */
void WINAPI on_battery(HDEVQUERY, PVOID,
                       const DEV_QUERY_RESULT_ACTION_DATA* action) {
  if (action == nullptr) {
    return;
  }
  if (action->Action == DevQueryResultStateChange) {
    // Aborted leaves the batteries unwatched and everything else working:
    // a level is something the panel shows, never something it needs.
    if (action->Data.State == DevQueryStateEnumCompleted) {
      batteries_listed.store(true);
    }
    return;
  }
  if (batteries_listed.load()) {
    SetEvent(state.changed);
  }
}

/**
 * The device query's two calls, from `cfgmgr32.dll` itself.
 *
 * Windows has exported them there since 10, but the SDK's `cfgmgr32.lib` does
 * not carry them; `OneCore.lib`, which does, would also move this program's
 * other imports onto API sets, for two functions. Missing, the batteries go
 * unwatched and nothing else changes.
 */
struct DeviceQuery {
  decltype(&DevCreateObjectQuery) create = nullptr;
  decltype(&DevCloseObjectQuery) close = nullptr;
};

DeviceQuery device_query() {
  const HMODULE module =
      LoadLibraryExW(L"cfgmgr32.dll", nullptr, LOAD_LIBRARY_SEARCH_SYSTEM32);
  if (module == nullptr) {
    return {};
  }
  DeviceQuery api;
  api.create = reinterpret_cast<decltype(&DevCreateObjectQuery)>(
      GetProcAddress(module, "DevCreateObjectQuery"));
  api.close = reinterpret_cast<decltype(&DevCloseObjectQuery)>(
      GetProcAddress(module, "DevCloseObjectQuery"));
  if (api.create == nullptr || api.close == nullptr) {
    return {};
  }
  return api;
}

/**
 * Every present device that has a battery level, kept up to date by Windows:
 * a level moving is an update, a headset connecting or going is an add or a
 * removal. Nothing when the query cannot be made, which costs the live level
 * and nothing else — the list still reads it whenever it is read.
 */
HDEVQUERY watch_batteries(const DeviceQuery& api) {
  if (api.create == nullptr) {
    return nullptr;
  }
  DEVPROPCOMPKEY battery{};
  battery.Key = kBluetoothBattery;
  battery.Store = DEVPROP_STORE_SYSTEM;
  // EXISTS, which reads no value. NOT_EQUALS against an empty value does not
  // mean the same: measured, it matched all 422 of a machine's devices where
  // one has a battery.
  DEVPROP_FILTER_EXPRESSION has_battery{};
  has_battery.Operator = DEVPROP_OPERATOR_EXISTS;
  has_battery.Property.CompKey = battery;
  has_battery.Property.Type = DEVPROP_TYPE_EMPTY;
  HDEVQUERY query = nullptr;
  if (FAILED(api.create(DevObjectTypeDevice, DevQueryFlagUpdateResults, 1,
                        &battery, 1, &has_battery, on_battery, nullptr,
                        &query))) {
    return nullptr;
  }
  return query;
}

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
 *
 * False when the watch had to be given up — the service manager reported a
 * failure, or refused to be asked again. From then on a restart of the audio
 * services would leave the endpoint callback registered with a service that
 * is gone, and this helper running but deaf, which the app cannot see: it
 * starts a new helper only when one has ended. So the loop ends the run on
 * it, and the next wake-up starts a helper that watches afresh.
 */
bool arm(ServiceWatch& watch) {
  if (watch.service != nullptr && watch.has_failed) {
    // Asked again it would answer with the same failure, at once, for ever.
    CloseServiceHandle(watch.service);
    watch.service = nullptr;
    return false;
  }
  if (watch.service == nullptr || watch.is_armed) {
    return true;
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
    return true;
  }
  // Refused — a client too slow to be told, or a service being deleted.
  CloseServiceHandle(watch.service);
  watch.service = nullptr;
  return false;
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
    // A watch refused at the start is only a restart that will go unseen:
    // the endpoint callback works without it, and ending here would only
    // bring the same refusal back with the next helper.
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
  // Not renewed with the audio services: it is the device manager's, which
  // they do not take down.
  const DeviceQuery query_api = device_query();
  const HDEVQUERY batteries = watch_batteries(query_api);
  const SC_HANDLE manager = OpenSCManagerW(nullptr, nullptr, SC_MANAGER_CONNECT);
  if (manager != nullptr) {
    watch_services(manager);
  }
  const HANDLE reader = CreateThread(nullptr, 0, read_input, nullptr, 0, nullptr);
  if (reader == nullptr) {
    if (batteries != nullptr) {
      query_api.close(batteries);
    }
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
      bool is_lost = false;
      for (ServiceWatch& watch : services) {
        is_renewed = is_renewed || watch.came_back;
        watch.came_back = false;
        is_lost = !arm(watch) || is_lost;
      }
      if (is_lost) {
        // See `arm`: deaf from the next restart on, so end, and be started
        // again.
        code = 1;
        break;
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
  // Closed first: once it returns no callback runs, and none may wake a loop
  // that has ended.
  if (batteries != nullptr) {
    query_api.close(batteries);
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
