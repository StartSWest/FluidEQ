/* FluidEQ — GPL-3.0-or-later */
// Device-free process-loopback stand-in. It exercises the shipped capture
// queue, overlapped pipe writer and main-side frame reader at real cadence.
#include "capture_writer.h"
#include <avrt.h>
#include <algorithm>
#include <array>
#include <charconv>
#include <cstdio>
#include <string_view>
#include <thread>

int main(int argc, char** argv) {
  DWORD pid = 0;
  if (argc != 2) return 2;
  const std::string_view value(argv[1]);
  const auto parsed = std::from_chars(value.data(), value.data() + value.size(), pid);
  if (parsed.ec != std::errc() || pid == 0) return 2;
  const HANDLE parent = OpenProcess(SYNCHRONIZE, FALSE, pid);
  const HANDLE stopped = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  const HANDLE started = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  const HANDLE tick = CreateWaitableTimerExW(nullptr, nullptr, CREATE_WAITABLE_TIMER_HIGH_RESOLUTION, TIMER_ALL_ACCESS);
  if (!parent || !stopped || !started || !tick) return 2;
  std::thread commands([&] {
    char ignored = 0; DWORD read = 0;
    ReadFile(GetStdHandle(STD_INPUT_HANDLE), &ignored, 1, &read, nullptr);
    if (read == 1 && ignored == 'g') {
      SetEvent(started);
      ReadFile(GetStdHandle(STD_INPUT_HANDLE), &ignored, 1, &read, nullptr);
    }
    SetEvent(stopped);
  });
  FILETIME created{}, ended{}, kernel{}, user{};
  DWORD task = 0;
  const HANDLE capture_priority = AvSetMmThreadCharacteristicsW(L"Pro Audio", &task);
  {
    CaptureWriter writer(GetStdHandle(STD_OUTPUT_HANDLE), parent, 48000, 2);
    if (!writer.valid()) return 2;
    const HANDLE opening[]{parent, stopped, started};
    const bool run = WaitForMultipleObjects(3, opening, FALSE, INFINITE) == WAIT_OBJECT_0 + 2;
    std::array<float, 480> pcm{}; pcm.fill(0.25F);
    const HANDLE waits[]{parent, stopped, tick};
    LARGE_INTEGER frequency{}, start{}, now{};
    QueryPerformanceFrequency(&frequency); QueryPerformanceCounter(&start);
    LARGE_INTEGER due{}; due.QuadPart = -50'000;
    if (run && !SetWaitableTimer(tick, &due, 5, nullptr, nullptr, FALSE)) return 2;
    unsigned sequence = 0;
    while (run && sequence < 2000 && WaitForMultipleObjects(3, waits, FALSE, INFINITE) == WAIT_OBJECT_0 + 2) {
      QueryPerformanceCounter(&now);
      const auto due_packets = static_cast<unsigned>(std::min<LONGLONG>(2000, (now.QuadPart - start.QuadPart) * 200 / frequency.QuadPart));
      while (sequence < due_packets) { writer.push(pcm.data(), 240, false, false); ++sequence; }
    }
    CancelWaitableTimer(tick);
    // Frames beyond the measured 1600 are a bounded drain tail. The client
    // closes stdin on seeing the end; even a lost final frame cannot hang it.
    writer.stop();
  }
  if (capture_priority) AvRevertMmThreadCharacteristics(capture_priority);
  if (GetProcessTimes(GetCurrentProcess(), &created, &ended, &kernel, &user)) {
    const auto ticks = [](FILETIME time) { return (static_cast<unsigned long long>(time.dwHighDateTime) << 32) | time.dwLowDateTime; };
    std::fprintf(stderr, "{\"nativeCpuMs\":%.3f,\"nativeCaptureScheduling\":%s}\n", static_cast<double>(ticks(kernel) + ticks(user)) / 10000, capture_priority ? "true" : "false");
  }
  CancelSynchronousIo(commands.native_handle());
  commands.join();
  CloseHandle(parent); CloseHandle(stopped); CloseHandle(started); CloseHandle(tick);
  return 0;
}
