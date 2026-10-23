/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One configuration file's bytes, the way the resolver asks for them.
 *
 * The macOS twin of the Windows effect's `config_file.cpp`: the same 4 MB
 * ceiling, the same "whatever arrived is what there is" on a file truncated
 * under the read. The path arrives wide and joined with `\`, as the resolver
 * builds it, and is turned into a POSIX path here.
 */
#ifndef FLUIDEQ_MAC_ENGINE_CONFIG_FILE_H
#define FLUIDEQ_MAC_ENGINE_CONFIG_FILE_H

#include <optional>
#include <string>

namespace fluideq_mac {

std::optional<std::string> read_config_file(const std::wstring& path);

}  // namespace fluideq_mac

#endif  // FLUIDEQ_MAC_ENGINE_CONFIG_FILE_H
