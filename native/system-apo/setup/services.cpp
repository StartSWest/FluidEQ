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
#include "service_restart.h"

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
};

void CALLBACK on_status_change(PVOID parameter) {
  auto* notify = static_cast<SERVICE_NOTIFY_2W*>(parameter);
  auto* waiter = static_cast<Waiter*>(notify->pContext);
  waiter->signalled = true;
  waiter->status = notify->dwNotificationStatus;
  // Only the created/deleted notifications ever fill this in, and the caller
  // owns it either way.
  if (notify->pszServiceNames != nullptr) {
    LocalFree(notify->pszServiceNames);
    notify->pszServiceNames = nullptr;
  }
}

bool query_state(SC_HANDLE service, const std::wstring& name, DWORD& state,
                 std::wstring& error) {
  SERVICE_STATUS_PROCESS current = {};
  DWORD needed = 0;
  if (QueryServiceStatusEx(service, SC_STATUS_PROCESS_INFO,
                           reinterpret_cast<LPBYTE>(&current), sizeof(current),
                           &needed) == 0) {
    error = L"could not read the state of " + name + L": " +
            describe_error(GetLastError());
    return false;
  }
  state = current.dwCurrentState;
  return true;
}

/**
 * Sleeps until the service enters one of the states in `mask`.
 *
 * Queued at once if it is in one of them already. The notification arrives
 * as an asynchronous procedure call, which only runs while this thread is in
 * an alertable wait: `SleepEx(INFINITE, TRUE)` IS that wait. It is woken by
 * the service control manager, not by a duration, and it is the only form of
 * waiting in this program.
 */
bool wait_for_change(SC_HANDLE service, const std::wstring& name, DWORD mask,
                     std::wstring& error) {
  Waiter waiter = {};
  waiter.notify.dwVersion = SERVICE_NOTIFY_STATUS_CHANGE;
  waiter.notify.pfnNotifyCallback = on_status_change;
  waiter.notify.pContext = &waiter;
  const DWORD registered =
      NotifyServiceStatusChangeW(service, mask, &waiter.notify);
  if (registered != ERROR_SUCCESS) {
    error = L"could not watch " + name + L": " + describe_error(registered);
    return false;
  }
  while (!waiter.signalled) {
    SleepEx(INFINITE, TRUE);
  }
  if (waiter.status != ERROR_SUCCESS) {
    error = L"stopped watching " + name + L": " + describe_error(waiter.status);
    return false;
  }
  return true;
}

/**
 * Returns once the service has stopped, or fails if it gave up stopping.
 *
 * Waiting for STOPPED alone never returns for a service that took the stop
 * and then went back to running, and the restart card sat on "Restarting
 * audio" for ever. RUNNING before any STOP_PENDING is only a service slow to
 * say so — the stop control returns once its handler has, which is not always
 * after the handler reported — so that is waited out, not failed. Each pass
 * re-reads the state rather than trusting the notification's copy of it.
 */
bool wait_stopped(SC_HANDLE service, const std::wstring& name,
                  std::wstring& error) {
  bool stopping = false;
  for (;;) {
    DWORD state = 0;
    if (!query_state(service, name, state, error)) {
      return false;
    }
    if (state == SERVICE_STOPPED) {
      return true;
    }
    if (state == SERVICE_STOP_PENDING) {
      stopping = true;
    } else if (state == SERVICE_RUNNING && stopping) {
      error = name + L" began to stop and then kept running";
      return false;
    }
    const DWORD mask = stopping
                           ? (SERVICE_NOTIFY_STOPPED | SERVICE_NOTIFY_RUNNING)
                           : (SERVICE_NOTIFY_STOPPED |
                              SERVICE_NOTIFY_STOP_PENDING);
    if (!wait_for_change(service, name, mask, error)) {
      return false;
    }
  }
}

/**
 * Returns once the service runs, or fails if it stopped instead.
 *
 * `StartService` sets START_PENDING before it returns, so a service found
 * STOPPED after a successful start is one that started and gave up — a vendor
 * service failing its own start-up. Waiting for RUNNING alone never returns
 * for it.
 */
bool wait_running(SC_HANDLE service, const std::wstring& name,
                  std::wstring& error) {
  for (;;) {
    DWORD state = 0;
    if (!query_state(service, name, state, error)) {
      return false;
    }
    if (state == SERVICE_RUNNING) {
      return true;
    }
    if (state == SERVICE_STOPPED) {
      error = name + L" started and then stopped again";
      return false;
    }
    if (!wait_for_change(service, name,
                         SERVICE_NOTIFY_RUNNING | SERVICE_NOTIFY_STOPPED,
                         error)) {
      return false;
    }
  }
}

/**
 * The service control manager, one freshly opened service handle per call.
 *
 * Fresh because a notification registration is per handle, and a handle that
 * has already been told about a state is not told again until the service
 * leaves and re-enters it.
 */
class ScmControl final : public ServiceControl {
 public:
  explicit ScmControl(SC_HANDLE manager) : manager_(manager) {}

  bool running_dependents(const std::wstring& service,
                          std::vector<std::wstring>& names,
                          std::wstring& error) override {
    ServiceHandle handle;
    if (!open(service, handle, error)) {
      return false;
    }
    DWORD needed = 0;
    DWORD count = 0;
    if (EnumDependentServicesW(handle.get(), SERVICE_ACTIVE, nullptr, 0,
                               &needed, &count) != 0) {
      return true;  // Nothing running depends on it.
    }
    if (GetLastError() != ERROR_MORE_DATA) {
      error = L"could not list what depends on " + service + L": " +
              describe_error(GetLastError());
      return false;
    }
    std::vector<BYTE> buffer(needed);
    auto* entries = reinterpret_cast<LPENUM_SERVICE_STATUSW>(buffer.data());
    if (EnumDependentServicesW(handle.get(), SERVICE_ACTIVE, entries, needed,
                               &needed, &count) == 0) {
      error = L"could not list what depends on " + service + L": " +
              describe_error(GetLastError());
      return false;
    }
    // The manager returns them in the order they have to stop: a service
    // that depends on another dependent comes before it.
    for (DWORD i = 0; i < count; ++i) {
      names.emplace_back(entries[i].lpServiceName);
    }
    return true;
  }

  bool stop(const std::wstring& service, std::wstring& error) override {
    ServiceHandle handle;
    if (!open(service, handle, error)) {
      return false;
    }
    SERVICE_STATUS status = {};
    if (ControlService(handle.get(), SERVICE_CONTROL_STOP, &status) == 0) {
      const DWORD failed = GetLastError();
      if (failed != ERROR_SERVICE_NOT_ACTIVE) {
        error = L"could not stop " + service + L": " + describe_error(failed);
        return false;
      }
    }
    return wait_stopped(handle.get(), service, error);
  }

  bool start(const std::wstring& service, std::wstring& error) override {
    ServiceHandle handle;
    if (!open(service, handle, error)) {
      return false;
    }
    if (StartServiceW(handle.get(), 0, nullptr) == 0) {
      const DWORD failed = GetLastError();
      if (failed != ERROR_SERVICE_ALREADY_RUNNING) {
        error = L"could not start " + service + L": " + describe_error(failed);
        return false;
      }
    }
    return wait_running(handle.get(), service, error);
  }

 private:
  bool open(const std::wstring& service, ServiceHandle& handle,
            std::wstring& error) {
    // ENUMERATE_DEPENDENTS as well as start/stop/query: listing what depends
    // on a service is its own access right, and without it the walk that
    // exists to get past error 1051 failed one step earlier with "access is
    // denied" (5) — on an elevated handle, which made it look like the
    // elevation had not happened.
    handle = ServiceHandle(OpenServiceW(
        manager_, service.c_str(),
        SERVICE_QUERY_STATUS | SERVICE_START | SERVICE_STOP |
            SERVICE_ENUMERATE_DEPENDENTS));
    if (!handle.valid()) {
      error = L"could not open the " + service + L" service: " +
              describe_error(GetLastError());
      return false;
    }
    return true;
  }

  SC_HANDLE manager_;
};

}  // namespace

bool restart_audio(std::wstring& error) {
  const ServiceHandle manager(
      OpenSCManagerW(nullptr, nullptr, SC_MANAGER_CONNECT));
  if (!manager.valid()) {
    error = L"could not reach the service control manager: " +
            describe_error(GetLastError());
    return false;
  }
  // Windows refuses to stop a service while a dependent is running (error
  // 1051). On the first machine that dependent was Realtek's
  // `RtkAudioUniversalService`, so the engine was attached to every output
  // and never loaded, because the one step that makes Windows read the new
  // effect list failed at its first call. `restart_services` walks them the
  // way `net stop /y` does, and puts back whatever it stopped.
  ScmControl control(manager.get());
  return restart_services(control, kAudioService, kBuilderService, error);
}

}  // namespace fluideq_engine::setup
