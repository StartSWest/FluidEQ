/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Printing from a program that has no console of its own.
 *
 * The helper is built for the windows subsystem, so Windows never gives it a
 * console window. That is the point: the NSIS installer runs it through
 * StdUtils' `ExecShellWaitEx` — the only way to get its exit code back — and
 * that call hard-codes `SW_SHOWNORMAL`, so a console subsystem helper flashed
 * a black window on screen during every install and every uninstall, with
 * nothing the .nsh could pass to suppress it.
 *
 * Losing the console must not lose the output: the app reads one line of JSON
 * off this program's stdout, and a person running it in a shell expects to
 * see the same line.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_CONSOLE_H
#define FLUIDEQ_ENGINE_SETUP_CONSOLE_H

namespace fluideq_engine::setup {

/**
 * Points `stdout` and `stderr` at whatever the caller left for them.
 *
 * Called once, before anything is printed. Safe to call whatever launched the
 * process: with no caller to borrow from it does nothing, and the writes are
 * discarded exactly as they were before.
 */
void borrow_caller_console();

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_CONSOLE_H
