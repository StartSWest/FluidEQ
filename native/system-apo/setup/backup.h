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
#include <vector>

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

/**
 * The same, for the state an output was in before Equalizer APO was switched
 * off on it — `<engine root>\apo-off\<guid>.json`.
 *
 * A second store rather than a second use of the one above, because the two
 * answer different questions and are taken back at different times: the
 * backup above says how to leave the machine when FluidEQ is uninstalled and
 * must survive every attach and detach in between, while this one says how to
 * put Equalizer APO back and is consumed the moment somebody switches to it.
 * Sharing one file would mean an uninstall restoring a state with APO already
 * removed from it — this program turning off somebody else's equalizer
 * permanently, on its way out.
 */
bool apo_off_saved(const std::wstring& guid);
bool save_apo_off_once(const std::wstring& guid, const FxValues& values,
                       std::wstring& error);
std::optional<FxValues> load_apo_off(const std::wstring& guid);
void remove_apo_off(const std::wstring& guid);
/** Every endpoint currently recorded as having Equalizer APO switched off. */
std::vector<std::wstring> apo_off_endpoints();

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_BACKUP_H
