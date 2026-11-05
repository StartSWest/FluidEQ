/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Asked of the shell by a page that is not the Gaming Lab — the DSP page
 * while a game's sound is on — to open it: the shell owns which tab is open,
 * and the page has no other way to reach it.
 */
export const OPEN_GAMING_LAB_EVENT = 'fluideq-open-gaming-lab';

export const openGamingLab = (): void => {
  window.dispatchEvent(new Event(OPEN_GAMING_LAB_EVENT));
};
