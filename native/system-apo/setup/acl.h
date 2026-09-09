/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Who may read and write the engine directory.
 *
 * Two processes have to agree on this tree and neither is the one that
 * created it. The effect runs inside audiodg.exe, which is LOCAL SERVICE and
 * needs to read; the app runs as whoever is signed in and needs to write, and
 * it is not elevated. `%ProgramData%`'s own default gives an ordinary user
 * read access and lets them create files but not modify anybody else's, which
 * breaks the second time a different user changes their EQ.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_ACL_H
#define FLUIDEQ_ENGINE_SETUP_ACL_H

#include <string>

namespace fluideq_engine::setup {

/**
 * SYSTEM and Administrators full, Users modify, all of it inherited.
 *
 * The list replaces whatever was inherited rather than adding to it, so that
 * the permissions on this tree are the ones written here and not the ones
 * `%ProgramData%` happened to pass down.
 */
bool apply_engine_acl(const std::wstring& directory, std::wstring& error);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_ACL_H
