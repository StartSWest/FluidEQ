/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How often an edit to several bands at once — a group drag, a tone dial —
 * is written to the engine while it is being made, in ms.
 *
 * Each write ends in a config rewrite and a preset save, none of which a
 * drag needs sixty times a second. The trailing call always fires, so the
 * value that lands is the one the control ended on.
 */
const GROUP_EDIT_INTERVAL = 100;

export default GROUP_EDIT_INTERVAL;
