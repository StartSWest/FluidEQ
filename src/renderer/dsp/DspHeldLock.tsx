/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The padlock on a header switch that something else is holding in place.
 *
 * A greyed switch with nothing beside it reads as broken, so the position has
 * to look deliberate; what is holding it is the group's own tooltip. The
 * sentence was tried on the page instead, on a line under the two switches,
 * and it failed twice over: aligned with the row's right edge it read as a
 * caption for the power switch next to it, and its own width grew the switch
 * group from 338px to 497px, which took that width off the preset bar and
 * pushed the rack's four file actions onto a second row at every window size.
 * A glyph inside the group it belongs to costs 12px and neither.
 */
const DspHeldLock = () => (
  // `fill="none"` in the markup, not the stylesheet: `.button` and the header
  // both paint bare paths, and they win over a class here.
  <svg
    className="dsp-switch-held"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path d="M5.6 7.2V5.4a2.4 2.4 0 0 1 4.8 0v1.8" />
    <path d="M4.6 7.2h6.8a1 1 0 0 1 1 1v4.4a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1V8.2a1 1 0 0 1 1-1Z" />
  </svg>
);

export default DspHeldLock;
