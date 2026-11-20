/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IBalanceReport } from './autoBalanceCapture';
import type { TSmartEqHeldOutcome } from './smartEqPreview';

/** A song Smart correction is done with, and what it held. */
export interface IHeldSong {
  /** What the hold was solved from, so a change of mode re-solves it. */
  report: IBalanceReport;
  outcome: TSmartEqHeldOutcome;
  gains: Record<string, number> | undefined;
}

/**
 * Songs held this session, newest last. Enough for an evening's playlist
 * twice over; each entry is one report (a few hundred numbers).
 */
const HELD_SONGS_KEPT = 200;

/**
 * Which songs a running mode is done with, by song key, for as long as the
 * window is open.
 *
 * Two plays of one song measure two slightly different stretches of sound
 * through two different frame alignments, and the solve answered them up to
 * a decibel and a half apart (measured on six records, 2026-11-20). Kept
 * here, a song played again is not heard again: its held curve goes back on
 * from the first second, the same curve every time, and nothing is
 * measured. Measure again forgets the song (`forget`).
 *
 * A source that names no song (`undefined`) is held while it plays and
 * forgotten the moment anything else does: two unnamed sources are not one
 * song.
 *
 * In memory only, on purpose: nothing about it is saved or shown, and a new
 * session measures afresh.
 */
export const createHeldSongs = () => {
  const songs = new Map<string | undefined, IHeldSong>();
  return {
    get: (key: string | undefined): IHeldSong | undefined => songs.get(key),
    set: (key: string | undefined, song: IHeldSong) => {
      // Re-inserted, so the order is by last hold and the oldest goes first.
      songs.delete(key);
      songs.set(key, song);
      if (songs.size > HELD_SONGS_KEPT) {
        const oldest = songs.keys().next();
        if (!oldest.done) {
          songs.delete(oldest.value);
        }
      }
    },
    forget: (key: string | undefined) => {
      songs.delete(key);
    },
    /** The song playing has changed from `key`. */
    leave: (key: string | undefined) => {
      if (key === undefined) {
        songs.delete(undefined);
      }
    },
  };
};

export type THeldSongs = ReturnType<typeof createHeldSongs>;
