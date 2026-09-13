/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Trying a failed engine command again, and what waits between the tries.
 *
 * Most of what goes wrong while switching engines is Windows being in the
 * middle of something: the audio service still stopping from a restart, the
 * endpoint builder not up yet at login, a device just plugged in. The same
 * command a moment later works. So a failed command is tried up to three
 * times, inside the one elevated run — retrying from the app would put the
 * Windows permission prompt on screen again for every try.
 *
 * What waits between tries is Windows, never a clock: `settle` returns once
 * the audio services have finished starting or stopping, which the service
 * control manager says itself. A machine where nothing is in transition is
 * tried again at once; a slow machine is waited for exactly as long as it
 * takes. This file holds only the policy, with no Windows API in it, so it is
 * tested on fakes.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_RETRY_H
#define FLUIDEQ_ENGINE_SETUP_RETRY_H

#include <functional>
#include <string>

#include "commands.h"

namespace fluideq_engine::setup {

/** How many times an engine command runs before its failure is reported. */
inline constexpr int kCommandTries = 3;

/**
 * Runs `attempt` on a fresh result until one succeeds or `tries` have failed,
 * and returns the last one.
 *
 * Before every try after the first, `settle` waits for Windows. A settle that
 * fails ends the tries: the next one would meet the same machine, and the
 * reason it could not wait belongs in the report. A failure that exhausted
 * every try says how many it took, so the log cannot mistake it for a first
 * attempt that nobody retried.
 */
CommandResult run_with_retries(
    int tries, const std::function<void(CommandResult&)>& attempt,
    const std::function<bool(std::wstring&)>& settle);

/** Whether a service in `state` (a `SERVICE_*` state) is still changing. */
bool is_service_settling(unsigned long state) noexcept;

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_RETRY_H
