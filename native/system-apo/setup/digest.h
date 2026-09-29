/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the DLLs beside this program must be, byte for byte.
 *
 * `install` copies them into Program Files and registers the effect for
 * audiodg.exe, elevated. The folder they come from is the app's own, which a
 * per-user install leaves writable by anything the user runs, so a DLL there
 * is checked against the digest this program was built with before a byte of
 * it is copied. The digests are taken from the build's own output
 * (`shipped_dlls.cmake`, run after the engine is linked and the runtime DLLs
 * copied beside it), so a helper and the DLLs it shipped with always agree,
 * and nothing else does.
 *
 * The engine DLL is not signed at packaging time, which is what keeps this
 * possible: a signature added after the build would change its bytes. Sign it
 * someday and the digest has to be taken after the signing, or every install
 * refuses — loudly, which is the right way for that to fail.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_DIGEST_H
#define FLUIDEQ_ENGINE_SETUP_DIGEST_H

#include <string>
#include <vector>

namespace fluideq_engine::setup {

/** SHA-256 of `bytes`, lowercase hex; empty when Windows cannot compute it. */
std::string sha256_hex(const std::vector<unsigned char>& bytes);

/**
 * The digest this program was built with for the DLL called `name`, compared
 * without regard to case as Windows names are, or nullptr for any DLL it did
 * not ship with.
 */
const char* shipped_digest(const std::wstring& name);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_DIGEST_H
