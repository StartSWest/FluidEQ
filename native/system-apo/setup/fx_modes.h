/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The processing modes beside an effect value — the half of a registration
 * that decides whether Windows streams through the effect at all.
 *
 * An effect value with its slot's `{d3993a3f-…},5/6/7` beside it is
 * registered for streaming, in the modes that value lists; without one it is
 * registered for discovery only, which Windows lists and never puts in the
 * audio graph (Microsoft's own INF guidance, "Implementing Audio Processing
 * Objects"). Every list attach has always written it. The single values were
 * not given it before 2.0.1, and a Sound BlasterX G6 had the engine in its
 * EFX value, attached on every reading and never once created.
 *
 * Kept free of the Windows API, like the planner it serves (`fx_list.h`),
 * so the rules are exercised on fixtures.
 */

#ifndef FLUIDEQ_ENGINE_SETUP_FX_MODES_H
#define FLUIDEQ_ENGINE_SETUP_FX_MODES_H

#include <string>
#include <string_view>
#include <vector>

#include "fx_list.h"

namespace fluideq_engine::setup {

/** `{9E90EA20-B493-4FD1-A1A8-7E1361A956CF}` — the RAW processing mode. */
extern const wchar_t kRawProcessingMode[];

/**
 * What to write beside an effect value in slot `at` (`kSfx`, `kMfx` or
 * `kEfx`) whose slot has no modes value — and only then: a value that is
 * there is the vendor's account of where its own effects run, shared by the
 * single and the list of that slot, and never rewritten.
 *
 * The endpoint effect gets DEFAULT alone: it runs after every mode has been
 * mixed, and Windows takes that one mode there and no other. A stream or
 * mode effect gets DEFAULT and then every other mode this endpoint's own
 * driver already streams an effect in — its other slot's value, in the order
 * found — because on a driver with modes of its own, Windows sends a stream
 * tagged as media or a film through that mode and never through DEFAULT, and
 * an engine listed for DEFAULT alone would leave those streams untouched
 * while reporting itself running. Only modes the driver already declares are
 * copied, so no mode the endpoint did not have is made up. RAW never: a
 * stream that asks for it has asked for no processing at all.
 */
std::vector<std::wstring> modes_for_empty_slot(const FxValues& values, int at);

/**
 * Whether `clsid` sits in a list or one of pids 5 to 7 whose slot has no
 * processing modes value, so that Windows never streams through it there —
 * and an attach into the same slot, or `plan_mode_in_place`, would write the
 * one it lacks. False where it is not attached, and in the pre-8.1 pair,
 * which has no modes at all.
 */
bool mode_missing(const FxValues& values, std::wstring_view clsid);

/**
 * The processing modes value `clsid`'s slot lacks, written beside it, and
 * nothing else on the endpoint changed: which slot it is in, the vendor's
 * entries, the other slots' modes. Unchanged wherever `mode_missing` is
 * false. What an install gives every output an older helper left without
 * it, so that the engine update reaches them all at once, whichever of them
 * is being listened to.
 */
FxPlan plan_mode_in_place(const FxValues& before, std::wstring_view clsid);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_FX_MODES_H
