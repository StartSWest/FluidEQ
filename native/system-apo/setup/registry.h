/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The per-output effect lists: reading one endpoint's `FxProperties` and
 * writing back only what changed.
 *
 * These values belong to whoever wrote the audio driver, not to FluidEQ, and
 * every one of them has to come back exactly as found. The registration of
 * FluidEQ's own class id lives in `com_registration.h` instead — that is state
 * this product creates, and mixing the two put both in one file past the size
 * a person can hold in their head.
 *
 * Everything opens with `KEY_WOW64_64KEY`, for the reason `reg_key.h` gives.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_REGISTRY_H
#define FLUIDEQ_ENGINE_SETUP_REGISTRY_H

#include <string>
#include <string_view>

#include "fx_list.h"

namespace fluideq_engine::setup {

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

/**
 * Reads one endpoint's `FxProperties`. An absent key reads as empty.
 *
 * A composite value found as a `REG_SZ` reads as a one-entry list, with
 * `composite_was_sz` remembering that it was not one — see `FxValues`.
 */
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

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_REGISTRY_H
