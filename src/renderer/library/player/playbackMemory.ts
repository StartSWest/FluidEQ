/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the window still remembers of the Library: where each video was left.
 *
 * The session itself — the queue, the playhead, whether to keep playing once
 * the list runs out — is the app's core's now (`common/library/
 * playbackMemory.ts`). The window kept it in its own storage until then, and
 * `takeLegacyPlayback` hands that copy over once.
 */
import { MIN_RESTORE_MS } from '../../../common/library/playbackMemory';

/** The session as the window used to keep it, read once for the core. */
const LEGACY_PLAYBACK_KEY = 'fluideq.library.playback';
const LEGACY_CONTINUATION_KEY = 'fluideq.library.keepPlaying';

export interface ILegacyPlayback {
  /** The stored session, parsed and nothing more; the core validates it. */
  memory?: unknown;
  /** `'off'` turned continuation off; anything else left it on. */
  keepPlaying?: string;
}

/**
 * The window's old copy of the session, taken out of its storage so it is
 * handed over exactly once. Nothing when there is none, or when storage
 * cannot be read — the core then keeps its own, which is the same answer.
 */
export const takeLegacyPlayback = (): ILegacyPlayback | undefined => {
  try {
    const raw = window.localStorage.getItem(LEGACY_PLAYBACK_KEY);
    const keepPlaying = window.localStorage.getItem(LEGACY_CONTINUATION_KEY);
    window.localStorage.removeItem(LEGACY_PLAYBACK_KEY);
    window.localStorage.removeItem(LEGACY_CONTINUATION_KEY);
    if (raw === null && keepPlaying === null) {
      return undefined;
    }
    let memory: unknown;
    try {
      memory = raw === null ? undefined : JSON.parse(raw);
    } catch {
      // A corrupt entry is no session, which is what the core reads it as.
      memory = undefined;
    }
    return {
      ...(memory === undefined ? {} : { memory }),
      ...(keepPlaying === null ? {} : { keepPlaying }),
    };
  } catch {
    return undefined;
  }
};

/**
 * How far into each video the reader got, one entry per video.
 *
 * Its own store, and per track rather than per session, because a film is not
 * a song: the session remembers ONE playhead — whatever was last playing — so
 * coming back to a video watched two days ago started it from nought however
 * far in you were. A queue of videos would only ever remember the last of
 * them.
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
