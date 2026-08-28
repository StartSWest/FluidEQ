/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Die with the parent, whatever happened to it.
 *
 * The supervisor asks this process to leave and then kills it if it will not,
 * and stdin closing is a second net beneath that: the read loop sees EOF and
 * falls out. Neither one covers the case that actually strands a process.
 *
 * If Electron is force-killed — a crash, `taskkill /F`, a hot reload that
 * replaces the main process — no shutdown command is sent and no `kill` is
 * called. Stdin does close, but this process may be inside `fwrite` on a
 * stdout pipe with nobody left to drain it, and that call blocks forever. The
 * result is a host holding an audio endpoint and a few hundred megabytes,
 * owned by nothing, until somebody finds it in Task Manager.
 *
 * So the parent is watched directly rather than inferred from a pipe. On
 * Windows that is a blocking wait on the parent's own handle: no polling, no
 * interval, and the wait returns the moment the process object is signalled
 * for any reason at all.
 */
#ifndef FLUIDEQ_HOST_PARENT_WATCH_H
#define FLUIDEQ_HOST_PARENT_WATCH_H

#include <cstdint>

/**
 * Start watching, and exit this process when the parent goes.
 *
 * `parent_pid` of zero disables the watch, which is what a test harness or a
 * hand-run host wants — there is no parent to outlive.
 *
 * `on_exit` runs before the process ends and is where the audio endpoint is
 * released. It runs on the watch thread, so it must not touch anything the
 * audio thread owns; closing the backend is exactly that and nothing more.
 */
void feq_watch_parent(uint32_t parent_pid, void (*on_exit)());

#endif /* FLUIDEQ_HOST_PARENT_WATCH_H */
