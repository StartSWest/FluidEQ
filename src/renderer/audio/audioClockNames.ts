/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the audio clock's worklet and the window both have to agree on. Plain
 * values only: the worklet imports this file, and has none of the window's
 * globals.
 *
 * The clock was the desk lights' until the lamps moved onto the capture's own
 * blocks and the lighting clock was taken out; the output spectrum and Smart
 * EQ still keep time by it behind a minimised window, so it is the audio
 * clock now, at the same thirty ticks a second of audio it always ran at.
 */

export const AUDIO_CLOCK_PROCESSOR = 'fluideq-audio-clock';

/** Ticks per second of audio. */
export const AUDIO_CLOCK_TICKS_PER_SECOND = 30;
