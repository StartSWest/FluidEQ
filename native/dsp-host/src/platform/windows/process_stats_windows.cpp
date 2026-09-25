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
   * The total, not a rate. The rate used to be worked out here against the
   * previous call, which needed a precise wall clock, a first call primed and
   * thrown away (seeded from the creation time it reported 82.75% for a host
   * that had spent its first 30 ms opening COM), and a sample on a half-second
   * clock to keep it current. The process list fits the rate itself, over its
   * own span, from totals — as it does for every process the meter reads.
   * Windows charges the time in scheduler ticks; averaging that out is the
   * fit's job (`processReadings.ts`).
   */
  out->cpu_seconds =
      static_cast<double>(as_100ns(kernel) + as_100ns(user)) / 1e7;
  return true;
}
