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

/**
 * SYSTEM and Administrators full, Users READ only, all of it inherited.
 *
 * For `backup\` and nothing else. Those files are the record of what each
 * endpoint's effect lists held before the engine was attached, and a detach
 * or an uninstall restores from them. Under the tree's ordinary "Users
 * modify" an unelevated user could delete one — at which point the detach has
 * no reference to restore and, by `detach_one`'s own rule, takes only our own
 * entry out and treats every other key as one that was always there. On a
 * machine where attaching had to mirror a vendor's single-effect keys into
 * composite lists, those mirrored entries then stay behind for good.
 *
 * Read rather than none: the app never opens these, but a user looking at why
 * their audio changed should be able to see what was recorded about their own
 * machine. Writing them is the engine's business, and the engine is elevated
 * when it does it.
 *
 * `engine.log` is unaffected — it sits in the root, not in `backup\`, and the
 * effect inside audiodg.exe (LOCAL SERVICE) writes it under the root's own
 * permissions: LOCAL SERVICE is a member of BUILTIN\Users, so it is the
 * root's Users ACE — Modify — that lets it write there, not the SYSTEM entry.
 */
bool apply_backup_acl(const std::wstring& directory, std::wstring& error);

/**
 * Whether the account the effect runs as can write in `directory`.
 *
 * The one permission everything depends on and nothing reports. Inside
 * audiodg.exe the effect is LOCAL SERVICE, and it writes its status and its
 * log into this tree before any audio passes; without that right it loads,
 * finds nothing it may read or write, and passes every output through in
 * silence — which from outside is indistinguishable from an effect Windows
 * never created at all. A tree left behind by an older install, or one whose
 * inherited permissions somebody tightened, is exactly that machine.
 *
 * Asked of the directory's own access list rather than by trying a write:
 * this program does not run as LOCAL SERVICE and cannot try. LOCAL SERVICE is
 * a member of BUILTIN\Users, so either trustee answering yes is the answer.
 */
bool service_can_write(const std::wstring& directory);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_ACL_H
