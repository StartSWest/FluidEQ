/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The tail's one length, and the version the name carries.
 *
 * The tail used to run on under the playing song wherever the bar had room;
 * the song left the header on 2026-11-26 (Ivan: "don't put the song name in
 * the title"), and the tail is the short flourish everywhere, laid over the
 * gap before the first tab so it costs the meter nothing.
 */

/** The tail's length from the Q, inside the gap before the first tab, px. */
export const TAIL_FLOURISH_PX = 22;

/**
 * The version as the header shows it: always two numbers, major and minor
 * (Ivan, 2026-11-26: "show the version 2.6 always 2 numbers"). Empty when
 * there is no version, as in a test import that bypasses the bundler.
 */
export const shortVersion = (version: string): string => {
  const [major, minor] = version.split('.');
  if (!major || !/^\d+$/.test(major)) {
    return '';
  }
  return `v${major}.${minor && /^\d+$/.test(minor) ? minor : '0'}`;
};
