/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "../../process_stats.h"

#include <windows.h>

#include <psapi.h>

namespace {

uint64_t as_100ns(const FILETIME& value) {
  ULARGE_INTEGER wide;
  wide.LowPart = value.dwLowDateTime;
  wide.HighPart = value.dwHighDateTime;
  return wide.QuadPart;
}

/*
 * The previous sample. Owned by the single thread documented in the header.
 *
 * Both counters are cumulative — kernel and user time since the process
 * started, and the wall clock — so a percentage is only ever a difference
 * between two readings. Keeping them here rather than in the caller is what
 * lets the caller ask for "the CPU" without also having to own a clock.
 */
uint64_t g_previous_cpu_100ns = 0;
uint64_t g_previous_wall_100ns = 0;

}  // namespace

bool feq_sample_process_stats(FeqProcessStats* out) {
  if (out == nullptr) {
    return false;
  }

  PROCESS_MEMORY_COUNTERS memory{};
  memory.cb = sizeof(memory);
  if (GetProcessMemoryInfo(GetCurrentProcess(), &memory, sizeof(memory)) == 0) {
    return false;
  }
  out->working_set_bytes = static_cast<uint64_t>(memory.WorkingSetSize);

  FILETIME created{};
  FILETIME exited{};
  FILETIME kernel{};
  FILETIME user{};
  if (GetProcessTimes(GetCurrentProcess(), &created, &exited, &kernel, &user) ==
      0) {
    return false;
  }

  /*
   * The precise clock, because the default one is granular.
   *
   * `GetSystemTimeAsFileTime` ticks with the scheduler — 15.6ms on a machine
   * nobody has raised the timer resolution on — and the interval this is
   * divided by is half a second. A quantisation of one tick is three percent
   * of the answer, which is the difference between an engine reading 1.0% and
   * one reading 1.03% on alternate frames for no reason a reader could name.
   */
  FILETIME now{};
  GetSystemTimePreciseAsFileTime(&now);

  const uint64_t cpu = as_100ns(kernel) + as_100ns(user);
  const uint64_t wall = as_100ns(now);

  /*
   * The first sample has no CPU figure, and must not invent one.
   *
   * Seeding the previous reading from the process creation time was tried and
   * measured: it reports the average since start, which for a host that has
   * spent 25ms of its first 30ms opening COM and enumerating endpoints is
   * 82.75% — a true statement about starting up and a false one about what the
   * engine is doing now, arriving in the exact column somebody is watching to
   * see whether the engine is working hard. The caller primes this once and
   * throws the answer away, so the first frame anybody sees is a real interval.
   *
   * The memory figure IS valid on the first call and is returned regardless:
   * it is an instantaneous reading, not a difference.
   */
  const uint64_t previous_wall = g_previous_wall_100ns;
  const uint64_t previous_cpu = g_previous_cpu_100ns;

  double percent = 0.0;
  // No earlier reading, a clock that went backwards, or two samples inside one
  // tick. None is a fault worth reporting; all make a division meaningless.
  if (previous_wall != 0 && wall > previous_wall && cpu >= previous_cpu) {
    const double elapsed = static_cast<double>(wall - previous_wall);
    percent = 100.0 * static_cast<double>(cpu - previous_cpu) / elapsed;
  }

  g_previous_cpu_100ns = cpu;
  g_previous_wall_100ns = wall;
  out->cpu_percent = percent;
  return true;
}
