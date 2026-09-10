/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Lexing primitives shared between the grammar (`tokenize`, `parse_filter`,
 * `parse_graphic`, defined in config_grammar.cpp) and the resolver
 * (`device_matches`, `resolve_chain`, defined in config.cpp). Not part of
 * the public interface: nothing outside this library includes it, which is
 * why it lives beside the sources rather than under `include/`.
 */
#ifndef FLUIDEQ_ENGINE_CONFIG_INTERNAL_H
#define FLUIDEQ_ENGINE_CONFIG_INTERNAL_H

#include <string_view>
#include <vector>

namespace fluideq_engine::detail {

// ASCII-only fold. `std::tolower` reads the global C locale, and every
// keyword this grammar compares ("PK", "Fc", "dB", a device GUID) is ASCII —
// a locale that folds a byte outside 'A'-'Z' differently would make the
// resolver disagree with itself between two otherwise-identical machines.
char ascii_lower(char c);
bool iequals(std::string_view a, std::string_view b);

// Splits on runs of space/tab. Never on '\r': callers have already trimmed
// that away as part of the line-ending handling in `tokenize`.
std::vector<std::string_view> split_ws(std::string_view s);

// `std::from_chars` only. `strtod` reads the locale too, and turns "1.41"
// into 1 on a machine set to a comma-decimal locale.
bool parse_double(std::string_view token, double& out);

}  // namespace fluideq_engine::detail

#endif  // FLUIDEQ_ENGINE_CONFIG_INTERNAL_H
