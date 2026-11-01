/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The channels the window hands the core its lists on (`coreCopies.ts`).
 * Names alone, in a file of their own, so the preload that sends them pulls
 * in none of the chain's code.
 */
export const CORE_COPY_CHANNEL = {
  games: 'core-copy-games',
  dspPresets: 'core-copy-dsp-presets',
  rackHold: 'core-copy-rack-hold',
} as const;
