/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What this process costs, measured by the only side that can see it.
 *
 * Electron's `getAppMetrics` covers Electron's own children, and this is not
 * one of them: the host is a separate executable spawned by main. So the app's
 * process list carried a row for the engine with a dash where its memory and
 * CPU should be, and the one question somebody opens that list to ask — what
 * is holding the memory — had no answer for the process most likely to be
 * holding it.
 *
 * Reading another process's counters from Node needs a platform call the main
 * process deliberately does not make; spawning PowerShell once a second to ask
 * Windows is the alternative and it is worse than the problem. The process
 * that already has the numbers, for free and without a handle, is this one.
 */
#ifndef FLUIDEQ_HOST_PROCESS_STATS_H
#define FLUIDEQ_HOST_PROCESS_STATS_H

#include <cstdint>

struct FeqProcessStats {
  /**
   * The same measure Electron reports for its own rows
   * (`metric.memory.workingSetSize`), so the column adds up instead of mixing
   * a working set with a private commit.
   */
  uint64_t working_set_bytes;
  /**
   * CPU time since the process started, kernel and user, in seconds.
   *
   * A running total rather than a percentage. A percentage is a difference
   * between two samples, which made the host sample on a half-second clock
   * whether or not it did anything, so that an idle host would still send
   * the reading that said it was idle. A total that has not moved says so
   * without being sent again, and the process list already fits a rate
   * through totals (`processReadings.ts`), as it does for the meter's.
   */
  double cpu_seconds;
};

/**
 * Sample this process. False when the platform has no implementation.
 *
 * Keeps no state. The host calls it on its telemetry thread only, because
 * that thread writes the frame it goes into.
 */
bool feq_sample_process_stats(FeqProcessStats* out);

#endif /* FLUIDEQ_HOST_PROCESS_STATS_H */
