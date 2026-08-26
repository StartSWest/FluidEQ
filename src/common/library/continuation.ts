/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { artistKey } from './grouping';
import { UNKNOWN_GENRE_ID, trackGenreIds } from './genres';
import { ILibraryTrack } from './types';

/**
 * WHAT PLAYS WHEN THE RECORD ENDS.
 *
 * A queue is whatever shelf the reader was standing on, and shelves end.
 * `advanceQueue` clamps at the last track and `handleEnded` stops there,
 * which is the honest answer for a player with nothing queued — and dead
 * silence three minutes after somebody put an album on.
 *
 * This is what it reaches for instead: more of the same genre, drawn from
 * the whole library. Nothing here schedules anything or watches a clock —
 * it is a pure pick, called when the run ahead of the playhead gets short.
 */

/** How many entries the run ahead may fall to before more are drawn. Low
 * enough that the queue is still mostly the reader's own list, high enough
 * that the next track is chosen well before the current one ends. */
export const CONTINUATION_LOW_WATER = 3;

/** How many to draw at a time. A batch rather than one at a time so the Up
 * Next panel shows a run worth reading, and small enough that changing shelf
 * a minute later has not committed the next hour. */
export const CONTINUATION_BATCH = 10;

/** Fisher-Yates over a copy — the same shuffle `queue.ts` uses, kept here so
 * this module has no reason to import the queue. */
const shuffled = <T>(values: readonly T[], random: () => number): T[] => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = result[i];
    result[i] = result[j];
    result[j] = swap;
  }
  return result;
};

/**
 * More like `seed`, at random, excluding anything in `exclude`.
 *
 * SAME GENRE, AND ONLY A REAL ONE. An untagged file belongs to the unknown
 * bucket, and "everything else nobody tagged" is not a resemblance — on most
 * libraries it is half the collection and the continuation would be a
 * library-wide shuffle wearing a genre's name. So an untagged seed falls
 * back to the same artist, which is a real answer, and to nothing when there
 * is not even that. Stopping is better than pretending.
 *
 * Video is left out on purpose: continuation happens after a record ends,
 * usually with the window on something else, and a film starting itself
 * there is not what "keep the music going" means. So is anything this build
 * cannot decode — `isPlayable === false` would queue a track that can only
 * report that it will not play.
 *
 * `random` is a parameter so a test can pin the draw; nothing in the app
 * passes it.
 */
export const pickContinuation = (
  tracks: readonly ILibraryTrack[],
  seed: ILibraryTrack,
  exclude: ReadonlySet<string>,
  count: number = CONTINUATION_BATCH,
  random: () => number = Math.random,
): string[] => {
  if (count <= 0) {
    return [];
  }
  const isCandidate = (track: ILibraryTrack): boolean =>
    track.id !== seed.id &&
    track.kind === 'audio' &&
    track.isPlayable !== false &&
    !exclude.has(track.id);

  const wanted = new Set(
    trackGenreIds(seed).filter((id) => id !== UNKNOWN_GENRE_ID),
  );
  const pool =
    wanted.size > 0
      ? tracks.filter(
          (track) =>
            isCandidate(track) &&
            trackGenreIds(track).some((id) => wanted.has(id)),
        )
      : (() => {
          const artist = artistKey(seed);
          return artist.length === 0
            ? []
            : tracks.filter(
                (track) => isCandidate(track) && artistKey(track) === artist,
              );
        })();

  return shuffled(pool, random)
    .slice(0, count)
    .map((track) => track.id);
};
