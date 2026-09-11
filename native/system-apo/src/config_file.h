/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Reading one configuration file off disk from inside audiodg.exe — the
 * `FileProvider` the watcher hands `resolve_chain`. Its own file because the
 * watcher's is about threads and handovers, and this is about a share mode
 * and a size cap.
 */
#ifndef FLUIDEQ_ENGINE_CONFIG_FILE_H
#define FLUIDEQ_ENGINE_CONFIG_FILE_H

#include <optional>
#include <string>

namespace fluideq_engine {

/**
 * The whole file, or nothing.
 *
 * `FILE_SHARE_WRITE | FILE_SHARE_DELETE` because the app rewrites these files
 * while this runs, and a share mode that excluded the writer would make the
 * effect the reason the app's own save failed. Nothing over 4 MiB: a
 * configuration file that large is not one FluidEQ wrote, and reading it would
 * mean allocating it inside audiodg.exe, a process with a working set nobody
 * expects an effect to move.
 */
std::optional<std::string> read_config_file(const std::wstring& path);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_CONFIG_FILE_H
