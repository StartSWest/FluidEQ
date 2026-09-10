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

import type {
  ILibraryQueue,
  TLibraryRepeat,
} from '../../../common/library/queue';

/**
 * What was playing, and how far in, kept across restarts.
 *
 * Storage and validation only — no React, no Electron — so the shape can be
 * tested without either. The provider decides when to write and what to do
 * with what comes back; this decides what is safe to believe.
 */
const STORAGE_KEY = 'fluideq.library.playback';

/**
 * The fader used to live here, under `fluideq.library.volume`.
 *
 * It is `renderer/audio/appVolume` now, because it was never the library's:
 * karaoke kept a second one and the Media tab invented a third, so the same
 * app played at three different levels depending on the open tab. The old key
 * is still read once, there, so nobody's remembered level was lost to the
 * move.
 */

const CONTINUATION_KEY = 'fluideq.library.keepPlaying';

/**
 * Whether the player keeps going once the queue runs out.
 *
 * ON when nothing has been stored. Music that stops dead at the end of a
 * record is the surprising behaviour, not the other way round, and anybody
 * who wants a player that stops has the toggle in the Up Next panel — where
 * they can see what it did. Only an explicit `'off'` turns it off, so a
 * truncated or corrupt entry reads as the default rather than as silence.
 */
export const readStoredContinuation = (): boolean => {
  try {
    return window.localStorage.getItem(CONTINUATION_KEY) !== 'off';
  } catch {
    return true;
  }
};

export const writeStoredContinuation = (value: boolean): void => {
  try {
    window.localStorage.setItem(CONTINUATION_KEY, value ? 'on' : 'off');
  } catch {
    // Same as the volume above: it simply will not be there next time.
  }
};

/** Positions nearer the start than this are not worth restoring: coming back
 * to a track two seconds in is indistinguishable from coming back to its
 * beginning, and the beginning is the less surprising of the two. */
const MIN_RESTORE_MS = 5_000;
/** Nor nearer the end than this — restoring somebody to the last few seconds
 * of a song hands them a track that immediately ends. */
const END_MARGIN_MS = 5_000;

const REPEATS: readonly TLibraryRepeat[] = ['off', 'all', 'one'];

export interface IPlaybackMemory {
  trackIds: readonly string[];
  order: readonly number[];
  position: number;
  repeat: TLibraryRepeat;
  isShuffled: boolean;
  positionMs: number;
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));

/**
 * Read what was stored, defensively.
 *
 * localStorage is user-editable and outlives the version that wrote it, so
 * this treats every field as untrusted: anything malformed becomes "nothing
 * was playing" rather than a queue with holes in it that the player would
 * then have to survive. The `order` array is checked against `trackIds` for
 * length AND range, because an out-of-range index is the one corruption that
 * would look valid and then index past the end of the queue.
 */
export const readPlaybackMemory = (): IPlaybackMemory | undefined => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return undefined;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }
    const value = parsed as Record<string, unknown>;
    const { trackIds, order } = value;
    if (!isStringArray(trackIds) || trackIds.length === 0) {
      return undefined;
    }
    if (
      !isNumberArray(order) ||
      order.length !== trackIds.length ||
      order.some(
        (index) =>
          !Number.isInteger(index) || index < 0 || index >= order.length,
      )
    ) {
      return undefined;
    }
    if (
      typeof value.position !== 'number' ||
      !Number.isInteger(value.position) ||
      value.position < 0 ||
      value.position >= order.length
    ) {
      return undefined;
    }
    const repeat = REPEATS.find((entry) => entry === value.repeat) ?? 'off';
    const positionMs =
      typeof value.positionMs === 'number' && Number.isFinite(value.positionMs)
        ? Math.max(0, value.positionMs)
        : 0;
    return {
      trackIds,
      order,
      position: value.position,
      repeat,
      isShuffled: value.isShuffled === true,
      positionMs,
    };
  } catch {
    return undefined;
  }
};

export const writePlaybackMemory = (
  queue: ILibraryQueue | undefined,
  positionMs: number,
): void => {
  try {
    if (!queue || queue.trackIds.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const memory: IPlaybackMemory = {
      trackIds: [...queue.trackIds],
      order: [...queue.order],
      position: queue.position,
      repeat: queue.repeat,
      isShuffled: queue.isShuffled,
      positionMs,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Not worth failing playback over; it just will not be there next time.
  }
};

/**
 * The position worth resuming at, or nothing.
 *
 * `durationMs` is what the track's own tag says, which is why this tolerates
 * not knowing it: a pending track has no duration yet, and refusing to
 * restore in that case would mean the one launch after a scan forgets where
 * the reader was.
 */
/**
 * How far into each video the reader got, one entry per video.
 *
 * Its own store, and per track rather than per session, because a film is not
 * a song: the session blob remembers ONE playhead — whatever was last playing
 * — so coming back to a video watched two days ago started it from nought
 * however far in you were. A queue of videos would only ever remember the
 * last of them.
 *
 * Only videos. Audio has the session restore and needs nothing else: a
 * three-minute song resumed from 1:40 a week later is a stranger thing than
 * one that starts again.
 */
const VIDEO_POSITIONS_KEY = 'fluideq.library.videoPositions';

/**
 * How many videos are remembered.
 *
 * An entry is about forty bytes and a library can hold thousands, so the map
 * is bounded rather than left to grow for the life of the install. Oldest
 * written go first — `writeVideoPosition` rewrites an entry every time it is
 * touched, so "oldest written" is "least recently watched".
 */
const MAX_VIDEO_POSITIONS = 300;

const readVideoPositions = (): Record<string, number> => {
  try {
    const raw = window.localStorage.getItem(VIDEO_POSITIONS_KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' &&
        Number.isFinite(entry[1]) &&
        entry[1] > 0,
    );
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
};

/** Where this video was left, or undefined. Untrusted like everything else
 * that comes back out of storage; the caller still has to decide whether the
 * number is worth restoring — see `restorablePositionMs`. */
export const readVideoPosition = (trackId: string): number | undefined =>
  readVideoPositions()[trackId];

/**
 * Remember where this video is, or forget it.
 *
 * A position at the very start is a removal rather than an entry: somebody
 * who watched ten seconds and left has not started the film, and an entry
 * saying so would outlive the interest that produced it.
 */
export const writeVideoPosition = (
  trackId: string,
  positionMs: number,
): void => {
  try {
    const positions = readVideoPositions();
    if (positionMs < MIN_RESTORE_MS) {
      delete positions[trackId];
    } else {
      // Deleted before it is set, so a rewritten entry moves to the end of the
      // insertion order and the trim below takes the least recently watched.
      delete positions[trackId];
      positions[trackId] = Math.round(positionMs);
    }
    const keys = Object.keys(positions);
    keys
      .slice(0, Math.max(0, keys.length - MAX_VIDEO_POSITIONS))
      .forEach((key) => delete positions[key]);
    window.localStorage.setItem(VIDEO_POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    // Same as every other store here: it simply will not be there next time.
  }
};

export const restorablePositionMs = (
  storedMs: number,
  durationMs: number | undefined,
): number | undefined => {
  if (storedMs < MIN_RESTORE_MS) {
    return undefined;
  }
  if (durationMs !== undefined && durationMs > 0) {
    if (storedMs > durationMs - END_MARGIN_MS) {
      return undefined;
    }
  }
  return storedMs;
};
