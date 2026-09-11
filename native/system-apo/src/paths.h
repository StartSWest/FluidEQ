/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the effect looks for its configuration, and where it writes its log.
 *
 * Machine-wide rather than per-user, because the code asking is running
 * inside audiodg.exe: that process is LOCAL SERVICE and has no user profile
 * to speak of, so `%APPDATA%` would resolve somewhere the app that writes the
 * configuration never looks. `%ProgramData%` is the one location both
 * processes agree on.
 *
 * Nothing here creates a directory. The effect is a guest in somebody else's
 * process and writes exactly one file it owns; the installer helper makes the
 * tree and sets its permissions.
 */
#ifndef FLUIDEQ_ENGINE_PATHS_H
#define FLUIDEQ_ENGINE_PATHS_H

#include <string>

namespace fluideq_engine {

/**
 * `%ProgramData%\FluidEQ\engine`, or empty when the shell cannot answer.
 *
 * TEST ONLY: the environment variable `FLUIDEQ_ENGINE_ROOT`, when set,
 * replaces the whole path. It exists so the DLL smoke test can point the
 * effect at an empty temporary directory and get the "nothing configured"
 * path deterministically, instead of depending on what the machine running
 * the test happens to have installed. Nothing in the shipping product sets
 * it, and audiodg.exe inherits no environment a user can reach.
 */
std::wstring engine_root();

/** `<engine root>\config` — `config.txt` and everything it includes. */
std::wstring config_dir();

/** `<engine root>\engine.log`. */
std::wstring log_path();

/**
 * `\\.\pipe\FluidEQ-Engine-Owner`: the pipe FluidEQ keeps open for as long
 * as it runs (`src/main/engineOwnerPipe.ts` names the same one). See
 * `owner_link.h` for what the engine does with it.
 *
 * TEST ONLY: `FLUIDEQ_ENGINE_OWNER_PIPE`, when set, replaces the name, so a
 * test can serve its own pipe without depending on whether FluidEQ happens
 * to be running on the machine. Same reasoning as `FLUIDEQ_ENGINE_ROOT`.
 */
std::wstring owner_pipe_name();

/**
 * The deepest existing directory at or above `path`, or empty if none is.
 *
 * The watcher needs somewhere real to wait when the configuration directory
 * has not been created yet: `FindFirstChangeNotificationW` fails outright on
 * a path that does not exist, and retrying it on a timer is how a wait turns
 * into a poll.
 */
std::wstring deepest_existing(const std::wstring& path);

/** `path` without its last component, or empty when it has only one. */
std::wstring parent_of(const std::wstring& path);

/** Whether `path` names an existing directory. False for an empty one. */
bool is_directory(const std::wstring& path);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_PATHS_H
