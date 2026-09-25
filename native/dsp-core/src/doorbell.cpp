/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/doorbell.h"

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#endif

/**
 * Windows rings through a kernel event; everything else through the atomic.
 *
 * `std::atomic::notify_one` is the portable spelling, and on Linux and macOS
 * it is a futex or `__ulock` wake that the kernel does alone. MSVC's is
 * `WakeByAddressSingle`, which finds its sleeper in a table ntdll keeps in
 * user mode and that the sleeping thread writes too while it goes to sleep.
 * The rings here come from the device thread, between two periods, and the
 * rule on that thread is that it never shares anything a lower-priority
 * thread can be holding when it is preempted. `SetEvent` hands the whole job
 * to the kernel dispatcher — the same path WASAPI uses to wake the device
 * thread itself — so the one wake it makes cannot wait on anybody.
 *
 * An auto-reset event also keeps a ring made before the waiter got there:
 * the wait finds it signalled and returns, and `rung()` settles the rest.
 * Should the event not exist — CreateEventW failing is a machine out of
 * handles — the atomic carries it alone, which is correct and merely not the
 * preferred path.
 */
FeqDoorbell::FeqDoorbell() noexcept {
#ifdef _WIN32
  event_ = ::CreateEventW(nullptr, FALSE, FALSE, nullptr);
#endif
}

FeqDoorbell::~FeqDoorbell() {
#ifdef _WIN32
  if (event_ != nullptr) {
    ::CloseHandle(static_cast<HANDLE>(event_));
  }
#endif
}

void FeqDoorbell::ring() noexcept {
  rings_.fetch_add(1, std::memory_order_acq_rel);
#ifdef _WIN32
  if (event_ != nullptr) {
    ::SetEvent(static_cast<HANDLE>(event_));
    return;
  }
#endif
  rings_.notify_one();
}

void FeqDoorbell::wait(uint32_t seen) noexcept {
#ifdef _WIN32
  if (event_ != nullptr) {
    while (rings_.load(std::memory_order_acquire) == seen) {
      ::WaitForSingleObject(static_cast<HANDLE>(event_), INFINITE);
    }
    return;
  }
#endif
  // Returns only once the value differs; a spurious wake is re-checked inside.
  rings_.wait(seen, std::memory_order_acquire);
}
