/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The only part of FluidEQ that writes the registry.
 *
 * Three separate things live here because all three are machine-wide state
 * this product creates and has to be able to take back out again: the COM
 * registration that makes the class id resolvable, the audio stack's own
 * record of the effect, and the per-output effect lists.
 *
 * Everything opens with `KEY_WOW64_64KEY`. The helper is a 64-bit binary and
 * would reach the 64-bit view anyway; naming it is the point, because a
 * future 32-bit build that silently landed in `Wow6432Node` would register an
 * effect the audio engine cannot see and report success.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_REGISTRY_H
#define FLUIDEQ_ENGINE_SETUP_REGISTRY_H

#include <string>
#include <string_view>

#include "fx_list.h"

namespace fluideq_engine::setup {

/** `{B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}` — the effect's class id. */
extern const wchar_t kEngineClsid[];

/** What the class id is called wherever Windows shows it to a person. */
extern const wchar_t kEngineFriendlyName[];

/**
 * Whether `guid` is exactly `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}`.
 *
 * Not a nicety: this string is concatenated into a registry path, so anything
 * looser lets a caller name a key somewhere else entirely — and this program
 * runs elevated.
 */
bool is_valid_endpoint_guid(std::wstring_view guid);

/** Whether the audio stack knows about a render endpoint with this guid. */
bool endpoint_key_exists(const std::wstring& guid);

/** Reads one endpoint's `FxProperties`. An absent key reads as empty. */
bool read_fx_values(const std::wstring& guid, FxValues& out,
                    std::wstring& error);

/**
 * Writes back only what `after` changed, and only the composite and mode
 * lists.
 *
 * Pids 1, 2, 5, 6 and 7 are never written, whatever the plan says. They are
 * the vendor's own registration in the two older shapes, and this program has
 * no business editing them — the guarantee lives here rather than in the
 * planner so that no future rule can quietly break it.
 */
bool write_fx_values(const std::wstring& guid, const FxValues& before,
                     const FxValues& after, std::wstring& error);

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

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_REGISTRY_H
