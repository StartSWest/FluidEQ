/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The engine's paths are `std::wstring` with `\` between components, because
 * the code that resolves them was written for Windows and is shared with it
 * unchanged. Linux opens files by UTF-8 bytes with `/` between components, so
 * every path that leaves the shared code for the file system comes through
 * here.
 *
 * `wchar_t` is 32 bits on Linux and 16 on Windows. The shared resolver's
 * `utf8_to_wide` writes UTF-16 surrogate pairs for anything above U+FFFF on
 * both, so a name with an emoji in it arrives here as two code units that
 * have to be joined back into one code point, not encoded one by one.
 */
#ifndef FLUIDEQ_LINUX_WIDE_PATH_H
#define FLUIDEQ_LINUX_WIDE_PATH_H

#include <string>
#include <string_view>

namespace fluideq_linux {

/** UTF-8 for any wide text: surrogate pairs joined, lone halves as U+FFFD. */
std::string narrow(std::wstring_view text);

/** `narrow`, with every `\` turned into `/` — a path the kernel can open. */
std::string narrow_path(std::wstring_view path);

/**
 * Wide text the shared resolver would have made from the same bytes: UTF-16
 * units held in `wchar_t`, surrogate pairs above U+FFFF. Malformed UTF-8
 * becomes U+FFFD.
 */
std::wstring widen(std::string_view utf8);

}  // namespace fluideq_linux

#endif  // FLUIDEQ_LINUX_WIDE_PATH_H
