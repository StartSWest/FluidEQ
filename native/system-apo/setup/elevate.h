/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Getting to administrator without asking for it up front.
 *
 * The manifest says `asInvoker` on purpose: `status` is the command the app
 * runs to find out whether anything is installed, and a manifest that
 * demanded elevation would put a consent prompt in front of opening a
 * settings page. Only the commands that write ask, and they ask by running
 * this same executable again with the same arguments.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_ELEVATE_H
#define FLUIDEQ_ENGINE_SETUP_ELEVATE_H

#include <string>
#include <vector>

namespace fluideq_engine::setup {

/** Whether this process is already running with an elevated token. */
bool is_elevated();

/**
 * Runs this executable again as administrator with `arguments`, and waits.
 *
 * Returns the child's exit code, or 2 when the consent prompt was declined —
 * which is not a failure and must not be reported as one. `error` is set only
 * when the relaunch itself could not happen.
 */
int relaunch_elevated(const std::vector<std::wstring>& arguments,
                      std::wstring& error);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_ELEVATE_H
