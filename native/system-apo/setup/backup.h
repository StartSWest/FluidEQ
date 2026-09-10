/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What an output's effect registration looked like before FluidEQ touched it.
 *
 * One file per endpoint, written once and never again. "Once" is the whole
 * point: a backup rewritten on the second attach would record a state that
 * already includes our own effect, and detaching from it would leave the
 * endpoint exactly as it was with FluidEQ installed — which is to say, never
 * restore it at all.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_BACKUP_H
#define FLUIDEQ_ENGINE_SETUP_BACKUP_H

#include <optional>
#include <string>

#include "fx_list.h"

namespace fluideq_engine::setup {

/** `<engine root>\backup\<guid>.json`, or empty when the root is unknown. */
std::wstring backup_path(const std::wstring& guid);

bool backup_exists(const std::wstring& guid);

/** Writes `values` only if this endpoint has no backup yet. */
bool save_backup_once(const std::wstring& guid, const FxValues& values,
                      std::wstring& error);

/** The saved values, or nothing when there is no readable backup. */
std::optional<FxValues> load_backup(const std::wstring& guid);

/** Forgets an endpoint, once it has been put back the way it was found. */
void remove_backup(const std::wstring& guid);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_BACKUP_H
