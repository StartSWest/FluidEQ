/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the engine may go on a microphone, which is not where it may go on
 * an output.
 *
 * A capture endpoint carries the same `FxProperties` values as a render one,
 * but Windows reads fewer of them. The pre-8.1 model had one capture effect
 * per stream, registered in the LFX value (pid 1); the GFX value (pid 2) is a
 * post-mix effect and a microphone has no mix, so an engine put there is
 * never created. And EFX is the slot to start from: on capture it runs
 * before every mode's tee, RAW streams included, which is what lets a
 * communications app's stream through the same engine as everybody else's
 * (Microsoft's "Audio processing object architecture").
 */
#ifndef FLUIDEQ_ENGINE_SETUP_CAPTURE_SLOTS_H
#define FLUIDEQ_ENGINE_SETUP_CAPTURE_SLOTS_H

#include "fx_list.h"

namespace fluideq_engine::setup {

/** Whether Windows ever creates an effect registered in `slot` on a mic. */
bool slot_exists_on_capture(Slot slot);

/**
 * Where an attach with no slot named goes on a microphone first found as
 * `original`: LFX where the driver registered only the pre-8.1 values and
 * that value is free or holds Windows' own effect, the newest takeable
 * single where it registered only pids 5 to 7, MFX on a hands-free endpoint
 * Windows combined with an output (`combined`), EFX otherwise.
 *
 * `default_slot_for`'s rules with the one rung a microphone does not have
 * taken out, rather than a flag on that function: the two answer for
 * different kinds of endpoint and grow apart from here.
 */
Slot default_capture_slot_for(const FxValues& original, bool combined);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_CAPTURE_SLOTS_H
