/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Ticks per second of audio: how often the window's audio clock reads the
 * live capture (`renderer/audio/audioClockNames.ts`), and so the period every
 * rate written per frame of the live spectrum is scaled from — in the window
 * and in the core, which reads the same frames for the desktop backgrounds.
 *
 * A plain value in a file of its own, because the clock's worklet imports it
 * too and has none of the window's globals.
 */
export const AUDIO_CLOCK_TICKS_PER_SECOND = 30;
