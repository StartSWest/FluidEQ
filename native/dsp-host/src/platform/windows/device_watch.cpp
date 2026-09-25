/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "device_watch.h"

#include <mmdeviceapi.h>
#include <wrl/client.h>

using Microsoft::WRL::ComPtr;

namespace {

/** Every state but RUNNING: asked for while it runs, it answers a stop. */
constexpr DWORD kNotRunning =
    SERVICE_NOTIFY_STOPPED | SERVICE_NOTIFY_START_PENDING |
    SERVICE_NOTIFY_STOP_PENDING | SERVICE_NOTIFY_CONTINUE_PENDING |
    SERVICE_NOTIFY_PAUSE_PENDING | SERVICE_NOTIFY_PAUSED;

}  // namespace

/**
 * Windows' endpoint notifications, handed to the watch.
 *
 * Called on COM's threads. Only flags are touched and one doorbell rung
 * through `Changed` — the reopen itself happens on the host's telemetry
 * thread, never inside a notification about the device it tears down.
 * A property change is deliberately not a reason: a Bluetooth headset
 * reports its battery through one, and every report would be an attempt.
 */
class OutputNotifications final : public IMMNotificationClient {
 public:
  explicit OutputNotifications(DeviceWatch& watch) : watch_(watch) {}

  // Not reference counted in any meaningful way: the watch owns this object
  // and unregisters it before either goes.
  ULONG STDMETHODCALLTYPE AddRef() override { return 1; }
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
    // Render only, and only the role the backend opens with. A capture device
    // changing, or the communications default moving, is not this stream's
    // business and reopening for it would interrupt playback for something
    // the listener did not do.
    if (flow == eRender && role == eConsole) {
      watch_.default_changed();
    }
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE OnDeviceStateChanged(LPCWSTR, DWORD) override {
    watch_.outputs_changed();
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnDeviceAdded(LPCWSTR) override {
    watch_.outputs_changed();
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnDeviceRemoved(LPCWSTR) override {
    watch_.outputs_changed();
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnPropertyValueChanged(LPCWSTR,
                                                   const PROPERTYKEY) override {
    return S_OK;
  }

 private:
  DeviceWatch& watch_;
};

DeviceWatch::DeviceWatch(Changed changed, void* owner)
    : changed_(changed),
      owner_(owner),
      client_(std::make_unique<OutputNotifications>(*this)) {
  stop_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (stop_ != nullptr) {
    thread_ = std::thread([this] { run(); });
  }
  // With no event there is no way to stop the thread, so there is no thread:
  // the backend still opens and plays, it only stops following outputs —
  // which is what every version before the notification had.
}

DeviceWatch::~DeviceWatch() {
  if (stop_ != nullptr) {
    SetEvent(stop_);
  }
  if (thread_.joinable()) {
    thread_.join();
  }
  if (stop_ != nullptr) {
    CloseHandle(stop_);
  }
}

void CALLBACK DeviceWatch::on_service_change(PVOID parameter) {
  auto* notify = static_cast<SERVICE_NOTIFYW*>(parameter);
  auto* watch = static_cast<DeviceWatch*>(notify->pContext);
  watch->service_fired_ = true;
  // Only the created/deleted notifications fill this in; freed either way.
  if (notify->pszServiceNames != nullptr) {
    LocalFree(notify->pszServiceNames);
    notify->pszServiceNames = nullptr;
  }
}

void DeviceWatch::run() {
  const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  const bool owns_com = SUCCEEDED(com);

  ComPtr<IMMDeviceEnumerator> enumerator;
  /**
   * Registered here, once, and again whenever Windows audio comes back: that
   * restart takes the endpoint builder with it, and a registration made with
   * the one that stopped is not one to rely on for the one that started.
   * A registration that fails leaves the watch deaf to devices until the
   * next restart, and still hearing the service.
   */
  const auto listen = [&] {
    if (enumerator) {
      enumerator->UnregisterEndpointNotificationCallback(client_.get());
      enumerator.Reset();
    }
    if (FAILED(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr,
                                CLSCTX_ALL, IID_PPV_ARGS(&enumerator)))) {
      enumerator.Reset();
      return;
    }
    if (FAILED(enumerator->RegisterEndpointNotificationCallback(
            client_.get()))) {
      enumerator.Reset();
    }
  };
  listen();

  SC_HANDLE manager = OpenSCManagerW(nullptr, nullptr, SC_MANAGER_CONNECT);
  SC_HANDLE audio = manager != nullptr
                        ? OpenServiceW(manager, L"Audiosrv", SERVICE_QUERY_STATUS)
                        : nullptr;
  // What the last notification said. Assumed running to begin with: asked
  // for "not running", a service that is already stopped answers at once.
  bool running = true;
  bool outstanding = false;

  for (;;) {
    if (audio != nullptr && !outstanding) {
      // Always the opposite of the state last seen, so every answer is a
      // change and none is the state it was already in.
      service_fired_ = false;
      notify_ = SERVICE_NOTIFYW{};
      notify_.dwVersion = SERVICE_NOTIFY_STATUS_CHANGE;
      notify_.pfnNotifyCallback = &DeviceWatch::on_service_change;
      notify_.pContext = this;
      outstanding = NotifyServiceStatusChangeW(
                        audio, running ? kNotRunning : SERVICE_NOTIFY_RUNNING,
                        &notify_) == ERROR_SUCCESS;
      if (!outstanding) {
        CloseServiceHandle(audio);
        audio = nullptr;
      }
    }
    // Alertable, because that is the only place the service control manager
    // can deliver its answer. Woken by it, or by the destructor; by nothing
    // that counts time.
    if (WaitForSingleObjectEx(stop_, INFINITE, TRUE) == WAIT_OBJECT_0) {
      break;
    }
    if (!service_fired_) {
      continue;
    }
    outstanding = false;
    if (notify_.dwNotificationStatus != ERROR_SUCCESS) {
      // The service went away as a service (deleted, or the manager lost
      // it). Devices are still heard; the service no longer is.
      CloseServiceHandle(audio);
      audio = nullptr;
      continue;
    }
    const bool now_running =
        notify_.ServiceStatus.dwCurrentState == SERVICE_RUNNING;
    if (now_running && !running) {
      listen();
      outputs_changed();
    }
    running = now_running;
  }

  // Closing the handle is what cancels a registration still outstanding; no
  // answer is written into `notify_` after it.
  if (audio != nullptr) {
    CloseServiceHandle(audio);
  }
  if (manager != nullptr) {
    CloseServiceHandle(manager);
  }
  if (enumerator) {
    enumerator->UnregisterEndpointNotificationCallback(client_.get());
    enumerator.Reset();
  }
  if (owns_com) {
    CoUninitialize();
  }
}
