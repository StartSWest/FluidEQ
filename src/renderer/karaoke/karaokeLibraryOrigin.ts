/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which Library song a karaoke came from, so the Maker can hand its timing
 * back to that song's lyrics.
 *
 * Kept by the karaoke song's id (`karaokeSongIdForFile`: name, size and the
 * file's own time), which a song sent from the Library keeps from one send
 * to the next, and in this window's storage, so the link outlives a restart
 * the way the karaoke playlist and the Maker's draft do. Only the Library's
 * id is kept: main finds the file from it, and a path never travels.
 *
 * A convenience, not the record of anything: storage that is missing or
 * refuses a write costs the "Save to song" button after a restart, never
 * the karaoke or its draft.
 */

export interface IKaraokeLibraryOrigin {
  /** The song's id in the Library, the only name main takes for it. */
  trackId: string;
  /**
   * The song's own tags carry timed words. The Library reads those before
   * any lyrics file beside the song, so timing saved beside it is not what
   * its Lyrics tab shows, and the Maker says so when it saves.
   */
  timedInTags: boolean;
}

const STORAGE_KEY = 'fluideq.karaoke.libraryOrigins.v1';

/** Songs remembered: more than a karaoke session holds, never a library. */
const KEPT = 64;

type TOrigins = [songId: string, origin: IKaraokeLibraryOrigin][];

const isOrigin = (value: unknown): value is IKaraokeLibraryOrigin => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { trackId, timedInTags } = value as Record<string, unknown>;
  return (
    typeof trackId === 'string' &&
    trackId.length > 0 &&
    trackId.length <= 512 &&
    typeof timedInTags === 'boolean'
  );
};

const read = (): TOrigins => {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? '[]',
    );
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((entry: unknown): TOrigins => {
      if (!Array.isArray(entry) || entry.length !== 2) {
        return [];
      }
      const [songId, origin] = entry as unknown[];
      return typeof songId === 'string' && isOrigin(origin)
        ? [
            [
              songId,
              { trackId: origin.trackId, timedInTags: origin.timedInTags },
            ],
          ]
        : [];
    });
  } catch {
    return [];
  }
};

/** The Library song this karaoke came from, if it came from one. */
export const libraryOriginOf = (
  songId: string,
): IKaraokeLibraryOrigin | undefined =>
  read().find(([id]) => id === songId)?.[1];

/** Remembers the link, newest last, the oldest let go past `KEPT`. */
export const rememberLibraryOrigin = (
  songId: string,
  origin: IKaraokeLibraryOrigin,
): void => {
  const kept = read().filter(([id]) => id !== songId);
  kept.push([songId, origin]);
  const next = kept.slice(-KEPT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Without storage the link lasts as long as the window does: the
    // workspace holds the one it was just given.
  }
};
