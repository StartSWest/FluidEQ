/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which slot an output's driver has been found to need, remembered.
 *
 * The engine goes in as an endpoint effect unless something says otherwise,
 * and for most drivers that is the end of it. On some it is not: Windows
 * builds the output's effect chain without ever creating the endpoint
 * effect, and only a mode effect is heard. The app finds that out the slow
 * way — sound heard past an attached engine that wrote nothing — and asks
 * for the engine to be moved. Without this file the next attach to the same
 * output (the app enabling it again, a re-install with `--attach-all`)
 * would put it straight back where it was never loaded, and the whole
 * discovery would run again on the next play.
 *
 * One file per endpoint under `<engine root>\slots`, holding one slot name
 * per line, oldest first. Written only when a slot was asked for by name; an
 * attach that chose for itself records nothing, so the memory only ever
 * holds what was learned, never a default. The last line is where the engine
 * is; the lines above it are what has already been tried and found silent,
 * which is what stops the ladder offering a rung twice — and what lets a
 * rung added to the middle of the ladder later reach an endpoint that had
 * already walked to the bottom of it.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_SLOT_MEMORY_H
#define FLUIDEQ_ENGINE_SETUP_SLOT_MEMORY_H

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "fx_list.h"

namespace fluideq_engine::setup {

/** `<engine root>\slots\<guid>.txt`, or empty when the root is unknown. */
std::wstring slot_memory_path(const std::wstring& guid);

/** The slot this output was last attached to by name, if any. */
std::optional<Slot> remembered_slot(const std::wstring& guid);

/**
 * Every slot this output has been attached to by name, oldest first, with
 * the one it is in now last.
 *
 * The ladder needs the whole list, not only where the engine is: it walks
 * newest to oldest, so a rung added to the middle later is one an endpoint
 * that already reached the bottom would never be offered again. With the
 * history it can be asked for the first rung nobody has tried — which is
 * how a Bluetooth headset parked in the oldest value of all gets to try the
 * generation that did not exist when it walked down.
 *
 * A file written by an older helper holds one name and no newline; it reads
 * as a history of one.
 */
std::vector<Slot> remembered_slots(const std::wstring& guid);

/**
 * Adds `slot` to this output's history, unless it is already the one it is
 * in. A failure to write is not a failure to attach: the effect is on the
 * output either way.
 */
void remember_slot(const std::wstring& guid, Slot slot);

/** The slot's name as the memory file and the status document spell it. */
const wchar_t* slot_name(Slot slot);

/** The slot a name (`efx`, `efx-single`, `gfx`, …) stands for, if any. */
std::optional<Slot> slot_from_name(std::wstring_view name);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_SLOT_MEMORY_H
