/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether the gate is open, from what the gate itself reports (engine 1.32):
 * its gain, which moves between 0 dB and minus its range at the attack and
 * release the dials set. Read as a share of the range rather than "0 dB or
 * not", so a gate half way through its release reads as still mostly open,
 * and a range of 3 dB (an expander) as a gate at all.
 */

/** Past half way open, a gate reads as open in every word and lamp. */
export const GATE_OPEN_AT = 0.5;

/** 1 fully open, 0 closed to its range. */
export const gateOpenness = (gainDb: number, rangeDb: number): number =>
  rangeDb > 0 ? Math.min(1, Math.max(0, 1 + gainDb / rangeDb)) : 1;
