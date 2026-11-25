/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the Mic tab's stage rail remembers its dragged width
 * (`useRailWidth`) and whether it is pinned open or folded to its glyphs
 * (`useRailPinned`): the studio rail the DSP page and the Gaming Lab stand
 * on, with keys of its own.
 */
export const MIC_RAIL_WIDTH_KEY = 'fluideq.mic.railWidth';

/**
 * The rail's width until it is dragged. Each row carries a meter, a delay and
 * a switch beside the stage's name, 163px of the row at the shared default
 * width (measured in the harness, 2026-11-23), which left "Noise cancelling"
 * 52px of its 101: wide enough here for the English names on one line, as
 * mockup A drew them. A longer name wraps to a second line rather than being
 * cut (`MicRack.scss`). 8px more since the gap that parts the chosen row's
 * highlight from its switch (`DspRailRow`, 2026-11-25): without them "Noise
 * cancelling" went onto two lines again.
 */
export const MIC_RAIL_INITIAL_WIDTH = 296;

export const MIC_RAIL_PINNED_KEY = 'fluideq.mic.railPinned';
