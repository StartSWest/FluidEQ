/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where Windows looks for the effect — the two registry paths, and nothing
 * that reads or writes them.
 *
 * Pure strings, split out of `com_registration.cpp` so the one fact that
 * decides whether the effect loads at all can be asserted without a registry.
 * The audio stack finds an effect in two places and needs both: the COM class
 * under `SOFTWARE\Classes\CLSID`, which says which DLL to load, and its
 * record under `SOFTWARE\Classes\AudioEngine\AudioProcessingObjects`, which
 * says how the engine may connect it. The first build wrote that record under
 * `...\CurrentVersion\Audio\AudioProcessingObjects` instead — a key nothing
 * reads — and audiodg.exe silently skipped the effect on every output it was
 * attached to. No error, no log line, no sound change.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_COM_PATHS_H
#define FLUIDEQ_ENGINE_SETUP_COM_PATHS_H

#include <string>

namespace fluideq_engine::setup {

/** `{B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}` — the effect's class id. */
extern const wchar_t kEngineClsid[];

/**
 * `SOFTWARE\Classes\CLSID\{clsid}`, relative to `HKEY_LOCAL_MACHINE`.
 *
 * `HKEY_CLASSES_ROOT` is a merged view of this key and the per-user one. A
 * machine-wide registration has to be written to the machine-wide half by
 * name: writing through the merged view lands wherever it happens to resolve.
 */
std::wstring clsid_registration_path();

/**
 * `SOFTWARE\Classes\AudioEngine\AudioProcessingObjects\{clsid}`, relative to
 * `HKEY_LOCAL_MACHINE` — the record audiodg.exe reads before it will create
 * the effect. Every vendor effect on a machine sits here, and so does
 * Equalizer APO's.
 */
std::wstring apo_registration_path();

/**
 * `SOFTWARE\Microsoft\Windows\CurrentVersion\Audio\AudioProcessingObjects\{clsid}`
 * — where builds before 2026-09-10 put the record. Installs remove it so a
 * machine that ran one of those builds is left with exactly the two keys
 * above.
 */
std::wstring misplaced_apo_record_path();

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_COM_PATHS_H
