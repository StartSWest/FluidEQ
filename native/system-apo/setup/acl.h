/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Who may read and write the engine directory.
 *
 * Three parties have to agree on this tree and none of them is always the one
 * that created it. The effect runs inside audiodg.exe, which is LOCAL SERVICE,
 * reads the configuration and writes its status and its log in the root; the
 * app runs as whoever is signed in, is not elevated, and writes the
 * configuration; this program runs elevated and writes everything else.
 * `%ProgramData%`'s own default gives an ordinary user read access and lets
 * them create files but not modify anybody else's, which breaks the second
 * time a different user changes their EQ.
 *
 * Ordinary users write in `config\` and nowhere else. Everything this program
 * writes elevated sits outside it, where a user can neither change it nor
 * swap it — or a folder on its way — for a link that would carry an
 * administrator's write somewhere of their choosing. The root used to be
 * Users-modify throughout, which is exactly that.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_ACL_H
#define FLUIDEQ_ENGINE_SETUP_ACL_H

#include <string>

namespace fluideq_engine::setup {

/**
 * Makes Administrators the owner of `path`.
 *
 * Whoever owns a folder may rewrite its permissions whatever they say, and
 * the app — not elevated — creates this tree when it asks for its config
 * folder before an engine was ever installed. Permissions set on a folder a
 * user owns are a suggestion.
 */
bool take_ownership(const std::wstring& path, std::wstring& error);

/**
 * The root: SYSTEM and Administrators full, LOCAL SERVICE modify, Users read,
 * all of it inherited.
 *
 * The list replaces whatever was inherited rather than adding to it, so that
 * the permissions on this tree are the ones written here and not the ones
 * `%ProgramData%` happened to pass down. LOCAL SERVICE by name: the effect's
 * status files and `engine.log` are written here, and it used to be able to
 * only because LOCAL SERVICE is a member of Users, and Users could write.
 */
bool apply_engine_acl(const std::wstring& directory, std::wstring& error);

/** `config\`: as the root, but Users modify — the app writes here. */
bool apply_config_acl(const std::wstring& directory, std::wstring& error);

/**
 * SYSTEM and Administrators full, Users READ only, all of it inherited.
 *
 * For `backup\`, `apo-off\`, `slots\` and the root's own parent. The backups
 * are the record of what each endpoint's effect lists held before the engine
 * was attached, and a detach or an uninstall restores from them; an
 * unelevated user who could delete one left the detach no reference to
 * restore, and by `detach_one`'s own rule it then took only our own entry out
 * and treated every other key as one that was always there. `apo-off\` is the
 * only record of somebody else's equaliser, and a deleted one left Equalizer
 * APO switched off by an uninstall that reported success.
 *
 * Read rather than none: the app reads `apo-off\`, and a user looking at why
 * their audio changed should be able to see what was recorded about their own
 * machine.
 */
bool apply_read_only_acl(const std::wstring& directory, std::wstring& error);

/**
 * `setup.log`: Users may read it and add a line to it, and nothing else — the
 * unelevated half of this program writes one when a prompt is declined.
 */
bool apply_log_acl(const std::wstring& file, std::wstring& error);

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
