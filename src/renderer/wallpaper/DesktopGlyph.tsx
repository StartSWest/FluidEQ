/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A monitor on its stand: the desktop background, wherever it is offered.
 * Stroked, sized by whoever draws it.
 */
const DesktopGlyph = () => (
  <svg viewBox="0 0 16 16" aria-hidden>
    <rect x="1.5" y="2.5" width="13" height="9" rx="1.2" />
    <path d="M5.5 14h5M8 11.5V14" />
  </svg>
);

export default DesktopGlyph;
