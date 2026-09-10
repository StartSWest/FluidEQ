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
#include <vector>

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
  // ENUMERATE_DEPENDENTS as well as start/stop/query: listing what depends
  // on Audiosrv is its own access right, and without it the walk that
  // exists to get past error 1051 fails one step earlier with "access is
  // denied" (5) — on an elevated handle, which is what made it look like the
  // elevation had not happened.
  service = ServiceHandle(OpenServiceW(
      manager, name,
      SERVICE_QUERY_STATUS | SERVICE_START | SERVICE_STOP |
          SERVICE_ENUMERATE_DEPENDENTS));
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

/**
 * Stop every running service that depends on `service`, in the order the
 * service control manager says they must go.
 *
 * Windows refuses to stop a service while a dependent is running: error 1051,
 * `ERROR_DEPENDENT_SERVICES_RUNNING`. On the first machine this ran on the
 * dependent was Realtek's `RtkAudioUniversalService`, so the engine was
 * installed and attached to every output and then never loaded, because the
 * one step that makes Windows read the new effect list failed at its first
 * call. `Restart-Service -Force` and `net stop /y` do exactly this walk;
 * the names stopped are handed back so `restart_audio` can bring them up
 * again afterwards.
 */
bool stop_dependents(SC_HANDLE manager, SC_HANDLE service,
                     const wchar_t* name, std::vector<std::wstring>& stopped,
                     std::wstring& error) {
  DWORD needed = 0;
  DWORD count = 0;
  if (EnumDependentServicesW(service, SERVICE_ACTIVE, nullptr, 0, &needed,
                             &count) != 0) {
    return true;  // Nothing running depends on it.
  }
  if (GetLastError() != ERROR_MORE_DATA) {
    error = std::wstring(L"could not list what depends on ") + name + L": " +
            describe_error(GetLastError());
    return false;
  }
  std::vector<BYTE> buffer(needed);
  auto* entries = reinterpret_cast<LPENUM_SERVICE_STATUSW>(buffer.data());
  if (EnumDependentServicesW(service, SERVICE_ACTIVE, entries, needed,
                             &needed, &count) == 0) {
    error = std::wstring(L"could not list what depends on ") + name + L": " +
            describe_error(GetLastError());
    return false;
  }
  // The manager returns them in the order they have to stop: a service that
  // depends on another dependent comes before it.
  for (DWORD i = 0; i < count; ++i) {
    const std::wstring dependent = entries[i].lpServiceName;
    ServiceHandle handle;
    if (!open_service(manager, dependent.c_str(), handle, error) ||
        !stop_service(handle.get(), dependent.c_str(), error)) {
      return false;
    }
    stopped.push_back(dependent);
  }
  return true;
}

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
  std::vector<std::wstring> dependents;
  if (!stop_dependents(manager.get(), audio.get(), kAudioService, dependents,
                       error) ||
      !stop_service(audio.get(), kAudioService, error) ||
      !stop_service(builder.get(), kBuilderService, error) ||
      !start_service(builder.get(), kBuilderService, error) ||
      !start_service(audio.get(), kAudioService, error)) {
    return false;
  }
  // Back up in reverse: the last one stopped is the deepest dependency.
  // A vendor service that will not come back is reported rather than left
  // silently down — its control panel would be the first thing to notice.
  for (auto it = dependents.rbegin(); it != dependents.rend(); ++it) {
    ServiceHandle handle;
    if (!open_service(manager.get(), it->c_str(), handle, error) ||
        !start_service(handle.get(), it->c_str(), error)) {
      error = L"audio is running again, but a service that depends on it "
              L"did not restart: " +
              error;
      return false;
    }
  }
  return true;
}

}  // namespace fluideq_engine::setup
