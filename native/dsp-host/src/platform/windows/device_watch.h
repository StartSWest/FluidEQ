/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What Windows says about the outputs, for as long as the host lives.
 *
 * Two things make the WASAPI backend reopen its endpoint: the default output
 * moving (speakers to headphones), and an open that failed — no default
 * endpoint while a headset powers up, Windows audio restarting under an
 * engine install, a device that vanished. The first was always a
 * notification. The second was a retry on the telemetry thread's 25 ms tick,
 * forty attempts a second for as long as the outage lasted — each one a COM
 * enumerator, a registration and an activation — and that tick is gone.
 *
 * So the second is a notification too. While a reopen is outstanding
 * (`await_endpoint`), every endpoint arriving, leaving or changing state
 * counts as a reason to try again, and so does the Windows Audio service
 * returning to RUNNING, which the service control manager announces (the
 * same `NotifyServiceStatusChangeW` the engine's setup helper waits on). Once
 * an endpoint is open (`endpoint_open`), only the default moving counts, as
 * before: reopening a healthy stream because a microphone was plugged in
 * would be a glitch nobody asked for. With nothing open and no reopen
 * outstanding (`endpoint_closed`) nothing counts: a START the app sent and
 * was refused stays the app's to repeat, as it always was, and the host
 * never opens a device nobody asked it for.
 *
 * One thread, started with the backend and stopped with it. It holds the COM
 * apartment the registration lives in — the registration used to be made per
 * open and torn down per failure, so during an outage nothing was listening
 * at all — and it sleeps in an alertable wait, which is how the service
 * control manager's notification is delivered. After Windows audio comes
 * back it registers afresh, rather than trust a registration made with the
 * endpoint builder that restarted along with it.
 *
 * What it cannot hear: another program releasing an output it held in
 * exclusive mode. Windows sends nothing for that, so an outage caused by it
 * ends at the next device change rather than the moment the output frees.
 */
#ifndef FLUIDEQ_HOST_DEVICE_WATCH_H
#define FLUIDEQ_HOST_DEVICE_WATCH_H

#include <atomic>
#include <memory>
#include <thread>

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <winsvc.h>

class OutputNotifications;

class DeviceWatch {
 public:
  /** Called on a Windows thread whenever a reopen is wanted. Must not block. */
  using Changed = void (*)(void* owner);

  DeviceWatch(Changed changed, void* owner);
  ~DeviceWatch();

  DeviceWatch(const DeviceWatch&) = delete;
  DeviceWatch& operator=(const DeviceWatch&) = delete;

  /** A reopen is being tried: any change to the outputs is worth another. */
  void await_endpoint() { mode_.store(kAwaiting, std::memory_order_release); }
  /** A stream is open: only the default moving is. */
  void endpoint_open() { mode_.store(kOpen, std::memory_order_release); }
  /** Nothing open and nothing outstanding: nothing is. */
  void endpoint_closed() { mode_.store(kClosed, std::memory_order_release); }

  /** For the notification client, which lives on COM's threads. */
  void default_changed() {
    if (mode_.load(std::memory_order_acquire) != kClosed) {
      changed_(owner_);
    }
  }
  void outputs_changed() {
    if (mode_.load(std::memory_order_acquire) == kAwaiting) {
      changed_(owner_);
    }
  }

 private:
  void run();
  /** The service control manager's APC, on `thread_` inside the wait. */
  static void CALLBACK on_service_change(PVOID parameter);

  static constexpr int kClosed = 0;
  static constexpr int kOpen = 1;
  static constexpr int kAwaiting = 2;

  Changed changed_;
  void* owner_;
  std::atomic<int> mode_{kClosed};
  /** Registered on `thread_`, and outliving every registration of it. */
  std::unique_ptr<OutputNotifications> client_;
  /** Manual-reset; set once, by the destructor. */
  HANDLE stop_ = nullptr;
  /**
   * The registration's buffer, a member rather than on `thread_`'s stack:
   * the service control manager writes it until the handle is closed, and
   * the handle is closed on the way out of `run`.
   */
  SERVICE_NOTIFYW notify_{};
  bool service_fired_ = false;
  std::thread thread_;
};

#endif /* FLUIDEQ_HOST_DEVICE_WATCH_H */
