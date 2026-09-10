/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Making the effect resolvable: the COM class registration, the audio stack's
 * own record of it, and the switch that lets an unsigned one load at all.
 *
 * Separate from `registry.h` because these are machine-wide facts about
 * FluidEQ, written once by `install` and removed once by `uninstall`, while
 * the other file edits registrations that belong to other people's drivers and
 * has to put them back exactly. Different blast radius, different file.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_COM_REGISTRATION_H
#define FLUIDEQ_ENGINE_SETUP_COM_REGISTRATION_H

#include <string>

#include "com_paths.h"

namespace fluideq_engine::setup {

/** What the class id is called wherever Windows shows it to a person. */
extern const wchar_t kEngineFriendlyName[];

/** COM registration plus the audio stack's `AudioProcessingObjects` record. */
bool register_engine(const std::wstring& dll_path, std::wstring& error);

/** Removes both, leaving `DisableProtectedAudioDG` exactly as found. */
bool unregister_engine(std::wstring& error);

/**
 * `DisableProtectedAudioDG` = 1.
 *
 * audiodg.exe refuses to load an effect that is not signed by Microsoft
 * unless this is set. It is never cleared on uninstall: another effect on the
 * machine may need it, and a machine that had it set before FluidEQ arrived
 * would silently lose its own equaliser.
 */
bool enable_unsigned_effects(std::wstring& error);

/** The DLL path the COM registration names, or empty when not registered. */
std::wstring registered_dll_path();

/**
 * Whether the `AudioProcessingObjects` record exists.
 *
 * Part of what "installed" means, not a detail of it: a class registration
 * with a DLL on disk and no record is an effect audiodg.exe will never
 * create, and a status that called that installed left the app with nothing
 * to offer — the engine was "on", attached everywhere, and silent.
 */
bool apo_record_present();

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_COM_REGISTRATION_H
