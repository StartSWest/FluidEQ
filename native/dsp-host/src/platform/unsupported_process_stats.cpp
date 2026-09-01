/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Self-measurement for a platform that has not got it yet.
 *
 * Same reason as the audio backend beside it: macOS and Linux still configure,
 * compile and run the host, and a missing symbol would stop the tree building
 * on two of the three platforms FluidEQ ships on. `/proc/self/statm` and
 * `mach_task_basic_info` are each a dozen lines when the native engine reaches
 * those platforms; until then this refuses, and the app draws the dash it drew
 * before any of this existed.
 */

#include "../process_stats.h"

bool feq_sample_process_stats(FeqProcessStats* out) {
  (void)out;
  return false;
}
