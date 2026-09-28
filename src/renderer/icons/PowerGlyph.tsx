/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '../styles/SideBar.scss';

/**
 * The power symbol on FluidEQ's own switch: the side bar's power button and
 * the player's equalizer deck draw the same one, so the two switches for the
 * same thing read as one control wherever the window is. Stroked; the
 * button's stylesheet colours it for on, off and an engine not reaching the
 * output (`.side-bar__power-glyph` in `SideBar.scss`), and is loaded here,
 * because the player can be drawn where the side bar is not.
 */
const PowerGlyph = () => (
  <svg className="side-bar__power-glyph" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v9" />
    <path d="M6.6 6.6a7.6 7.6 0 1 0 10.8 0" />
  </svg>
);

export default PowerGlyph;
