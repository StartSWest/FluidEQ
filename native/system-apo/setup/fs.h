/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the helper puts things, and the file operations it needs to get them
 * there.
 *
 * The paths here are deliberately NOT the effect DLL's `paths.h`. That header
 * lets the environment variable `FLUIDEQ_ENGINE_ROOT` replace the whole root
 * so a test can point the effect at a temporary directory — harmless in a DLL
 * that only ever reads, and a privilege escalation in a program that runs
 * elevated and applies an ACL granting Users write access to whatever
 * directory it was handed. The helper asks the shell and nothing else.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_FS_H
#define FLUIDEQ_ENGINE_SETUP_FS_H

#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace fluideq_engine::setup {

/** `%ProgramData%\FluidEQ\engine`, or empty when the shell cannot answer. */
std::wstring engine_root();

/** `<engine root>\config` — what the effect reads. */
std::wstring config_dir();

/** `<engine root>\backup` — one file per endpoint ever attached. */
std::wstring backup_dir();

/** `<engine root>\last-setup.json` — the result of the last elevated run. */
std::wstring result_path();

/** `%ProgramFiles%\FluidEQ Engine` — where the effect DLL is installed. */
std::wstring install_dir();

/** `<install dir>\FluidEQ-Engine.dll`. */
std::wstring installed_dll_path();

/** The directory this executable is running from. */
std::wstring module_dir();

bool path_exists(const std::wstring& path);

/** Creates `path` and every missing directory above it. */
bool ensure_directory(const std::wstring& path);

/** UTF-8, no byte order mark: the TypeScript side reads these with `utf8`. */
bool write_utf8(const std::wstring& path, std::wstring_view text);

std::optional<std::wstring> read_utf8(const std::wstring& path);

/** Every file in `directory` matching `pattern`, names only, in any order. */
std::vector<std::wstring> files_matching(const std::wstring& directory,
                                         const std::wstring& pattern);

/**
 * Copies `from` over `to`, even when `to` is loaded into a running process.
 *
 * audiodg.exe holds the effect DLL mapped for as long as any output has it
 * attached, so a plain copy over an existing installation fails with a
 * sharing violation — which is what reinstalling on top of a working
 * installation does. A mapped file cannot be written but can still be
 * renamed, so the old one is moved aside and left for the next reboot.
 */
bool replace_file(const std::wstring& from, const std::wstring& to,
                  std::wstring& error);

/** Deletes `directory` and everything under it. Does not follow junctions. */
bool delete_directory_tree(const std::wstring& directory);

/** The system's message for a Win32 error code, on one line. */
std::wstring describe_error(unsigned long code);

/** `text` as UTF-8 bytes. */
std::string utf8_from_wide(std::wstring_view text);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_FS_H
