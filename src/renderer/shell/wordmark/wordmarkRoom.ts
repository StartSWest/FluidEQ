/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * WHERE THE SONG GOES, OR WHETHER IT GOES AT ALL (Ivan, 2026-11-26: the song
 * rides the Q's tail on a wide bar; "we dont show song name under it").
 *
 * The bar is three tracks and every pixel the left end takes beyond its
 * content costs the meter two (`useTitlebarRoom`). So the song never claims
 * room: it and the long tail under it are laid over the space between the
 * name and the first tab, out of the flow, and only when that space is there
 * already. Nothing here changes the width of anything in the flow, which is
 * what keeps the decision from answering its own layout.
 */

/** Narrowest song worth showing: a short title and its artist, px. */
export const SONG_MIN_PX = 150;

/** Widest the song is let run, so a long title does not cross the bar, px. */
export const SONG_MAX_PX = 300;

/** Air kept before the first tab, px. */
const TABS_AIR_PX = 16;

/** Between the version (or the tail's start) and the song, px. */
const SONG_GAP_PX = 10;

/** The short flourish the tail always has, inside the name's own box, px. */
export const TAIL_FLOURISH_PX = 22;

export interface IWordmarkRoomInput {
  /** Where the tail leaves the Q, px from the name's left edge. */
  tailStart: number;
  /** The version's right edge, px from the name's left edge. */
  versionRight: number;
  /** The first tab's left edge, px from the name's left edge. */
  tabsLeft: number;
}

export interface IWordmarkRoom {
  /** The tail's length from the Q, px. */
  tailLength: number;
  /** The song's left edge, px from the name's left edge; absent: no song. */
  songLeft?: number;
  /** The song's width, px. */
  songWidth?: number;
}

/** The tail and the song, from where things stand. */
export const wordmarkRoom = ({
  tailStart,
  versionRight,
  tabsLeft,
}: IWordmarkRoomInput): IWordmarkRoom => {
  const songLeft = Math.max(versionRight, tailStart) + SONG_GAP_PX;
  const room = tabsLeft - TABS_AIR_PX - songLeft;
  if (!Number.isFinite(room) || room < SONG_MIN_PX) {
    return { tailLength: TAIL_FLOURISH_PX };
  }
  const songWidth = Math.min(SONG_MAX_PX, room);
  return { tailLength: songLeft - tailStart + songWidth, songLeft, songWidth };
};

/** Whether a line of text runs past its box: what fades its end out. */
export const isLineClipped = (scrollWidth: number, clientWidth: number) =>
  scrollWidth > clientWidth + 1;

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
