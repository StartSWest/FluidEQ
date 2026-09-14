/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#include "analysis_link.h"
#include <process.h>
#include <psapi.h>
#include <algorithm>
#include <cstring>
#include "log.h"

namespace fluideq_engine {
namespace {
struct PipeGuard {
  HANDLE handle;
  ~PipeGuard() { CloseHandle(handle); }
};
}
AnalysisLink::AnalysisLink(const std::wstring& endpoint, uint32_t rate,
                           uint32_t channels)
    : endpoint_(to_utf8(endpoint)), rate_(rate) {
  meters_ = feq_meters_create((std::min)(channels, 2u));
  if (meters_ == nullptr) return;
  feq_meters_set_sample_rate(meters_, rate);
  stop_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  retry_ = CreateEventW(nullptr, FALSE, TRUE, nullptr);
  ready_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (stop_ == nullptr || retry_ == nullptr || ready_ == nullptr) return;
  unsigned id = 0;
  thread_ = reinterpret_cast<HANDLE>(
      _beginthreadex(nullptr, 0, &AnalysisLink::entry, this, 0, &id));
  if (thread_ != nullptr) SetThreadPriority(thread_, THREAD_PRIORITY_BELOW_NORMAL);
}

AnalysisLink::~AnalysisLink() {
  if (thread_ != nullptr) {
    SetEvent(stop_);
    WaitForSingleObject(thread_, INFINITE);
    CloseHandle(thread_);
  }
  for (HANDLE event : {stop_, retry_, ready_}) {
    if (event != nullptr) CloseHandle(event);
  }
  feq_meters_destroy(meters_);
}

void AnalysisLink::retry() noexcept {
  if (retry_ != nullptr) SetEvent(retry_);
}

bool AnalysisLink::transfer(HANDLE pipe, void* data, DWORD size, bool writing) {
  auto* bytes = static_cast<unsigned char*>(data);
  DWORD offset = 0;
  while (offset < size) {
    OVERLAPPED operation{};
    operation.hEvent = ready_;
    ResetEvent(ready_);
    const BOOL queued = writing
        ? WriteFile(pipe, bytes + offset, size - offset, nullptr, &operation)
        : ReadFile(pipe, bytes + offset, size - offset, nullptr, &operation);
    if (queued == 0 && GetLastError() != ERROR_IO_PENDING) return false;
    HANDLE events[] = {stop_, ready_};
    if (WaitForMultipleObjects(2, events, FALSE, INFINITE) != WAIT_OBJECT_0 + 1) {
      CancelIoEx(pipe, &operation);
      DWORD ignored = 0;
      GetOverlappedResult(pipe, &operation, &ignored, TRUE);
      return false;
    }
    DWORD count = 0;
    if (GetOverlappedResult(pipe, &operation, &count, FALSE) == 0 || count == 0)
      return false;
    offset += count;
  }
  return true;
}

unsigned __stdcall AnalysisLink::entry(void* self) {
  auto* link = static_cast<AnalysisLink*>(self);
  try {
    link->run();
  } catch (...) {
    // Display failure never changes the audible graph or owner liveness.
    feq_meters_set_enabled(link->meters_, 0);
  }
  return 0;
}

void AnalysisLink::run() {
  HANDLE events[] = {stop_, retry_};
  while (WaitForMultipleObjects(2, events, FALSE, INFINITE) == WAIT_OBJECT_0 + 1) {
    const HANDLE pipe = CreateFileW(L"\\\\.\\pipe\\FluidEQ-Engine-Analysis",
        GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING,
        FILE_FLAG_OVERLAPPED, nullptr);
    if (pipe == INVALID_HANDLE_VALUE) continue;
    const PipeGuard guard{pipe};
    // Fixed handshake: ASCII endpoint GUID, zero padded, then sample rate.
    unsigned char hello[44]{};
    std::memcpy(hello, endpoint_.data(), (std::min)(endpoint_.size(), size_t{39}));
    std::memcpy(hello + 40, &rate_, sizeof(rate_));
    // What this engine can answer, a bit each: 1 the preamp request (2), 2
    // the process-stats request (3). The app asks nothing a bit did not offer.
    hello[39] = 1 | 2;
    bool connected = transfer(pipe, hello, sizeof(hello), true);
    while (connected) {
      unsigned char command = 0;
      if (!transfer(pipe, &command, 1, false)) break;
      if (command == 2) {
        const uint32_t magic = 0x50414546;
        const float gain = output_gain.load(std::memory_order_relaxed);
        const uint32_t flags = (output_enabled.load(std::memory_order_relaxed) ? 1u : 0u) |
            (output_active.load(std::memory_order_relaxed) ? 2u : 0u);
        unsigned char packet[12]{};
        std::memcpy(packet, &magic, 4);
        std::memcpy(packet + 4, &gain, 4);
        std::memcpy(packet + 8, &flags, 4);
        uint32_t size = sizeof(packet);
        connected = transfer(pipe, &size, 4, true) && transfer(pipe, packet, size, true);
        continue;
      }
      if (command == 3) {
        // What this process costs, for the app's Processes list. The engine
        // lives inside audiodg.exe, which FluidEQ cannot open to measure, so
        // it measures from in here — the whole audio service's working set
        // and CPU time, since that is the only process there is to report.
        // Answered on demand, like the frames: nothing here samples on a clock.
        const uint32_t magic = 0x53514546;  // "FEQS"
        PROCESS_MEMORY_COUNTERS counters{};
        counters.cb = sizeof(counters);
        const uint64_t working =
            K32GetProcessMemoryInfo(GetCurrentProcess(), &counters, sizeof(counters)) != 0
                ? static_cast<uint64_t>(counters.WorkingSetSize)
                : 0;
        FILETIME created{}, exited{}, kernel{}, user{};
        const auto hundred_ns = [](const FILETIME& time) {
          return (static_cast<uint64_t>(time.dwHighDateTime) << 32) | time.dwLowDateTime;
        };
        const uint64_t cpu =
            GetProcessTimes(GetCurrentProcess(), &created, &exited, &kernel, &user) != 0
                ? hundred_ns(kernel) + hundred_ns(user)
                : 0;
        const uint32_t pid = GetCurrentProcessId();
        unsigned char packet[24]{};
        std::memcpy(packet, &magic, 4);
        std::memcpy(packet + 4, &pid, 4);
        std::memcpy(packet + 8, &working, 8);
        std::memcpy(packet + 16, &cpu, 8);
        uint32_t size = sizeof(packet);
        connected = transfer(pipe, &size, 4, true) && transfer(pipe, packet, size, true);
        continue;
      }
      feq_meters_set_enabled(meters_, command == 1 ? 1 : 0);
      if (command != 1) continue;
      const bool active = active_.load(std::memory_order_acquire);
      auto packet = active ? snapshot() : std::vector<unsigned char>{};
      // UINT32_MAX means the callback explicitly reported no valid audio;
      // zero only means a complete FFT window has not arrived yet.
      uint32_t size = active ? static_cast<uint32_t>(packet.size()) : UINT32_MAX;
      connected = transfer(pipe, &size, sizeof(size), true);
      if (connected && !packet.empty())
        connected = transfer(pipe, packet.data(), size, true);
    }
    feq_meters_set_enabled(meters_, 0);
  }
}
}  // namespace fluideq_engine
