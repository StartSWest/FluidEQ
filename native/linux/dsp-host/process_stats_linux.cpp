/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `process_stats.h` for Linux. The resident set is what Electron's own rows
 * report as `workingSetSize` on Linux (it reads the same `/proc` field), so
 * the process list's memory column adds up across the app and this host.
 */

#include <sys/resource.h>
#include <unistd.h>

#include <cstdio>

#include "../../dsp-host/src/process_stats.h"

bool feq_sample_process_stats(FeqProcessStats* out) {
  if (out == nullptr) return false;
  // statm: size resident shared text lib data dt, in pages.
  std::FILE* file = std::fopen("/proc/self/statm", "re");
  if (file == nullptr) return false;
  unsigned long long size = 0;
  unsigned long long resident = 0;
  const int read = std::fscanf(file, "%llu %llu", &size, &resident);
  std::fclose(file);
  if (read != 2) return false;
  const long page = sysconf(_SC_PAGESIZE);
  struct rusage usage {};
  if (page <= 0 || getrusage(RUSAGE_SELF, &usage) != 0) return false;
  out->working_set_bytes = resident * static_cast<unsigned long long>(page);
  out->cpu_seconds =
      static_cast<double>(usage.ru_utime.tv_sec + usage.ru_stime.tv_sec) +
      static_cast<double>(usage.ru_utime.tv_usec + usage.ru_stime.tv_usec) / 1e6;
  return true;
}
