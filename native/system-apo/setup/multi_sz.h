/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Turning the raw bytes of a registry string value into text, and back.
 *
 * Split out of the registry access and kept free of `windows.h` for one
 * reason: `REG_MULTI_SZ` is a promise the registry does not keep. Nothing
 * stops a driver's installer writing a value whose last entry has no NUL after
 * it, or whose byte count is odd, and `RegQueryValueExW` hands those back
 * exactly as stored. A decoder that trusts the terminator reads off the end of
 * the buffer and turns whatever is next in the heap into an entry — which this
 * program then writes back into the endpoint's effect chain and into the
 * backup that is supposed to undo it.
 *
 * So every scan here is bounded by the byte count that came with the data, and
 * the awkward shapes have names: a missing final terminator ends the last
 * entry, an odd byte count drops the stray byte, and an empty value is an
 * empty list.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_MULTI_SZ_H
#define FLUIDEQ_ENGINE_SETUP_MULTI_SZ_H

#include <cstddef>
#include <string>
#include <vector>

namespace fluideq_engine::setup {

/**
 * `REG_MULTI_SZ` data as its entries, with no entry reaching past `size`.
 *
 * An empty entry ends the list, which is what the double terminator is. Bytes
 * after that are ignored: a value padded out by whoever wrote it is not a list
 * of one entry and a gap.
 */
std::vector<std::wstring> decode_multi_sz(const unsigned char* bytes,
                                          std::size_t size);

/** `REG_SZ` data as one string, terminator dropped, bounded by `size`. */
std::wstring decode_sz(const unsigned char* bytes, std::size_t size);

/** The characters `REG_MULTI_SZ` data is made of: every entry, then a NUL. */
std::vector<wchar_t> encode_multi_sz(const std::vector<std::wstring>& entries);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_MULTI_SZ_H
