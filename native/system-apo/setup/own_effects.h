/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A microphone's own effects: the processing its maker registers on it —
 * THX on a Razer Kraken's mic, Realtek's on a laptop's array — taken off so
 * only the FluidEQ Engine processes the voice, and put back exactly (Ivan,
 * 2026-11-24: "kill any processing that mics may bring and only use fluid
 * engine ... this needs to work for all").
 *
 * The same edit as Equalizer APO's switch-off (`plan_suspend_apo`), for
 * every effect but ours: the composite lists are the only values edited,
 * the single values are mirrored forward first so the lists Windows then
 * reads carry exactly what ran, and the vendor's single and pre-8.1 values
 * are never rewritten — Windows ignores them wherever a list exists, and
 * `write_fx_values` refuses any change to them. What the endpoint was is
 * recorded once, before anything is written, under `<engine root>\
 * mic-own-off`; putting it back writes that record again and keeps the
 * FluidEQ Engine wherever it is (`plan_restore_own`).
 */
#ifndef FLUIDEQ_ENGINE_SETUP_OWN_EFFECTS_H
#define FLUIDEQ_ENGINE_SETUP_OWN_EFFECTS_H

#include <string>
#include <string_view>
#include <vector>

#include "fx_list.h"

namespace fluideq_engine::setup {

/**
 * The values `before` should become with every effect but `keep` out of the
 * lists Windows reads. Unchanged (and `changed` false) where nothing but
 * `keep` runs: then nothing is written and nothing is recorded.
 */
FxPlan plan_suspend_others(const FxValues& before, std::wstring_view keep);

/**
 * The values `current` should become with the recorded `saved` back. Where
 * the FluidEQ Engine sits exactly where the switch-off left it, the record
 * is written back as it was, word for word. Where it has moved since (the
 * slot ladder), the record goes back with ours kept where it went
 * (`plan_restore_apo`), which re-registers it as an attach would.
 */
FxPlan plan_restore_own(const FxValues& current, const FxValues& saved,
                        std::wstring_view keep);

/**
 * The effects Windows runs on an endpoint, by its rules: in each slot the
 * composite list when there is one, otherwise the single value; the pre-8.1
 * pair only on an endpoint with neither. What the card lists, and why a
 * vendor's single value under a list is not listed — it no longer runs.
 */
std::vector<std::wstring> effects_run(const FxValues& values);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_OWN_EFFECTS_H
