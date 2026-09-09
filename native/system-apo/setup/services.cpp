/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "services.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <winsvc.h>

#include <string>

#include "fs.h"

namespace fluideq_engine::setup {

namespace {

const wchar_t kAudioService[] = L"Audiosrv";
const wchar_t kBuilderService[] = L"AudioEndpointBuilder";

/** An owning `SC_HANDLE`. */
class ServiceHandle {
 public:
  ServiceHandle() = default;
  explicit ServiceHandle(SC_HANDLE handle) : handle_(handle) {}
  ~ServiceHandle() {
    if (handle_ != nullptr) {
      CloseServiceHandle(handle_);
    }
  }
  ServiceHandle(const ServiceHandle&) = delete;
  ServiceHandle& operator=(const ServiceHandle&) = delete;
  ServiceHandle(ServiceHandle&& other) noexcept : handle_(other.handle_) {
    other.handle_ = nullptr;
  }
  ServiceHandle& operator=(ServiceHandle&& other) noexcept {
    if (this != &other) {
      if (handle_ != nullptr) {
        CloseServiceHandle(handle_);
      }
      handle_ = other.handle_;
      other.handle_ = nullptr;
    }
    return *this;
  }

  SC_HANDLE get() const noexcept { return handle_; }
  bool valid() const noexcept { return handle_ != nullptr; }

 private:
  SC_HANDLE handle_ = nullptr;
};

/**
 * What the service control manager's callback hands back.
 *
 * It lives on the waiting thread's stack, which is safe only because the wait
 * below never returns while a registration is still outstanding: the callback
 * would then write into a frame that no longer exists.
 */
struct Waiter {
  SERVICE_NOTIFY_2W notify;
  bool signalled;
  DWORD status;
  DWORD state;
};

void CALLBACK on_status_change(PVOID parameter) {
  auto* notify = static_cast<SERVICE_NOTIFY_2W*>(parameter);
  auto* waiter = static_cast<Waiter*>(notify->pContext);
  waiter->signalled = true;
  waiter->status = notify->dwNotificationStatus;
  waiter->state = notify->ServiceStatus.dwCurrentState;
  // Only the created/deleted notifications ever fill this in, and the caller
  // owns it either way.
  if (notify->pszServiceNames != nullptr) {
    LocalFree(notify->pszServiceNames);
    notify->pszServiceNames = nullptr;
  }
}

bool wait_for_state(SC_HANDLE service, const wchar_t* name, DWORD mask,
                    DWORD target, std::wstring& error) {
  while (true) {
    SERVICE_STATUS_PROCESS current = {};
    DWORD needed = 0;
    if (QueryServiceStatusEx(service, SC_STATUS_PROCESS_INFO,
                             reinterpret_cast<LPBYTE>(&current),
                             sizeof(current), &needed) == 0) {
      error = std::wstring(L"could not read the state of ") + name + L": " +
              describe_error(GetLastError());
      return false;
    }
    if (current.dwCurrentState == target) {
      return true;
    }

    Waiter waiter = {};
    waiter.notify.dwVersion = SERVICE_NOTIFY_STATUS_CHANGE;
    waiter.notify.pfnNotifyCallback = on_status_change;
    waiter.notify.pContext = &waiter;
    const DWORD registered =
        NotifyServiceStatusChangeW(service, mask, &waiter.notify);
    if (registered != ERROR_SUCCESS) {
      error = std::wstring(L"could not watch ") + name + L": " +
              describe_error(registered);
      return false;
    }
    // The notification arrives as an asynchronous procedure call, which only
    // runs while this thread is in an alertable wait. `SleepEx(INFINITE,
    // TRUE)` IS that wait — it is woken by the service control manager, not
    // by a duration, and it is the only form of waiting in this program.
    while (!waiter.signalled) {
      SleepEx(INFINITE, TRUE);
    }
    if (waiter.status != ERROR_SUCCESS) {
      error = std::wstring(L"stopped watching ") + name + L": " +
              describe_error(waiter.status);
      return false;
    }
    if (waiter.state == target) {
      return true;
    }
    // A state on the way to the one asked for. Register again and keep
    // waiting; the loop's first act is to re-read the state, so nothing that
    // happened in between is missed.
  }
}

bool open_service(SC_HANDLE manager, const wchar_t* name,
                  ServiceHandle& service, std::wstring& error) {
  service = ServiceHandle(OpenServiceW(
      manager, name,
      SERVICE_QUERY_STATUS | SERVICE_START | SERVICE_STOP));
  if (!service.valid()) {
    error = std::wstring(L"could not open the ") + name + L" service: " +
            describe_error(GetLastError());
    return false;
  }
  return true;
}

bool stop_service(SC_HANDLE service, const wchar_t* name,
                  std::wstring& error) {
  SERVICE_STATUS status = {};
  if (ControlService(service, SERVICE_CONTROL_STOP, &status) == 0) {
    const DWORD failed = GetLastError();
    if (failed != ERROR_SERVICE_NOT_ACTIVE) {
      error = std::wstring(L"could not stop ") + name + L": " +
              describe_error(failed);
      return false;
    }
  }
  return wait_for_state(service, name, SERVICE_NOTIFY_STOPPED,
                        SERVICE_STOPPED, error);
}

bool start_service(SC_HANDLE service, const wchar_t* name,
                   std::wstring& error) {
  if (StartServiceW(service, 0, nullptr) == 0) {
    const DWORD failed = GetLastError();
    if (failed != ERROR_SERVICE_ALREADY_RUNNING) {
      error = std::wstring(L"could not start ") + name + L": " +
              describe_error(failed);
      return false;
    }
  }
  return wait_for_state(service, name, SERVICE_NOTIFY_RUNNING,
                        SERVICE_RUNNING, error);
}

}  // namespace

bool restart_audio(std::wstring& error) {
  const ServiceHandle manager(OpenSCManagerW(nullptr, nullptr,
                                             SC_MANAGER_CONNECT));
  if (!manager.valid()) {
    error = L"could not reach the service control manager: " +
            describe_error(GetLastError());
    return false;
  }
  ServiceHandle audio;
  ServiceHandle builder;
  if (!open_service(manager.get(), kAudioService, audio, error) ||
      !open_service(manager.get(), kBuilderService, builder, error)) {
    return false;
  }
  return stop_service(audio.get(), kAudioService, error) &&
         stop_service(builder.get(), kBuilderService, error) &&
         start_service(builder.get(), kBuilderService, error) &&
         start_service(audio.get(), kAudioService, error);
}

}  // namespace fluideq_engine::setup
