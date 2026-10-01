/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What one output's effect registration holds, as a report can show it.
 *
 * "Attached" was the only thing the app ever learned about an output's
 * effect slots, and it is one bit about a structure with nine places in it:
 * three lists Windows reads (SFX, MFX, EFX), three old single values and
 * two older ones it reads only when the lists are absent, and a processing
 * mode list beside each of the three. A sound card's own effects can occupy
 * any of them, Equalizer APO's troubleshooting options write to the old
 * ones, and which one this engine sits in — and beside whom, and whether
 * the list Windows reads is even the one it was put in — is the whole
 * question on a machine where it is attached and never heard. So the status
 * now says it all, per output, with every class id named after whoever
 * registered it, and counts the slots that hold nothing at all.
 *
 * Pure: the values come from `read_fx_values` and the names from whatever
 * the caller can look up, so this can be tested against fixtures.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_SLOT_REPORT_H
#define FLUIDEQ_ENGINE_SETUP_SLOT_REPORT_H

#include <functional>
#include <string>
#include <string_view>
#include <vector>

#include "fx_list.h"

namespace fluideq_engine::setup {

/** A registered name for a class id, or empty when nothing is known. */
using NameLookup = std::function<std::wstring(const std::wstring& clsid)>;

/**
 * Two JSON members, without the surrounding braces, to be appended to an
 * endpoint's status object:
 *
 *   "effects":[{"slot":"efx","from":"list","clsid":"{…}","name":"…"},…],
 *   "emptySlots":N
 *
 * `slot` is sfx, mfx or efx for the three modern generations, lfx or gfx for
 * the legacy pair; `from` is list, single or legacy. Entries come in the
 * order Windows would run them within a list. `emptySlots` counts, of the
 * three modern slots, those with no entry in either the list or the single
 * value — a sound card that filled all three is a machine where this engine
 * had to be added beside somebody, and one where none is free is worth
 * seeing at a glance.
 */
std::wstring describe_slots(const FxValues& values, const NameLookup& name);

/**
 * The rungs of the slot ladder this output would refuse now, in ladder
 * order: a single or legacy value that somebody else's effect holds —
 * neither ours nor Windows' own default — exactly as `plan_move` refuses it.
 *
 * The app steps past these rather than asking for them. Asked for, a held
 * rung cost a Windows prompt for nothing and ended the ladder: a 2.0.0
 * report's output had a vendor's effect in its SFX value, the walk stopped
 * there, and GFX — what played on the same user's RME — was never offered.
 */
std::vector<Slot> held_slots(const FxValues& values, const FxValues& backup,
                             std::wstring_view clsid);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_SLOT_REPORT_H
