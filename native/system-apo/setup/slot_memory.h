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
 * One file per endpoint under `<engine root>\slots`, holding the slot's
 * name. Written only when a slot was asked for by name; an attach that
 * chose for itself records nothing, so the memory only ever holds what was
 * learned, never a default.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_SLOT_MEMORY_H
#define FLUIDEQ_ENGINE_SETUP_SLOT_MEMORY_H

#include <optional>
#include <string>
#include <string_view>

#include "fx_list.h"

namespace fluideq_engine::setup {

/** `<engine root>\slots\<guid>.txt`, or empty when the root is unknown. */
std::wstring slot_memory_path(const std::wstring& guid);

/** The slot this output was last attached to by name, if any. */
std::optional<Slot> remembered_slot(const std::wstring& guid);

/**
 * Records `slot` for this output. A failure to write is not a failure to
 * attach: the effect is on the output either way.
 */
void remember_slot(const std::wstring& guid, Slot slot);

/** The slot's name as the memory file and the status document spell it. */
const wchar_t* slot_name(Slot slot);

/** The slot a name (`efx`, `mfx`, `sfx`, `gfx`, `lfx`) stands for, if any. */
std::optional<Slot> slot_from_name(std::wstring_view name);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_SLOT_MEMORY_H
