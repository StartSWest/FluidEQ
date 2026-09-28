/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The twelve pitch classes from C, sharps only.
 *
 * Wherever this app names a note, a row, a bar or a key carries one name:
 * offering `A♯`/`B♭` would need two labels for one line. The karaoke pitch
 * lane, its chords, the Maker's canvas and the graph's notes view each kept a
 * copy of this list.
 */
export const NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const;

/**
 * The name of a pitch class, for any whole number: the modulo is taken twice
 * because `%` keeps the sign, so a negative class would index off the list.
 */
export const pitchClassName = (pitchClass: number): string =>
  NOTE_NAMES[((Math.round(pitchClass) % 12) + 12) % 12];
