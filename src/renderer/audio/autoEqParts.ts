/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISongSoundParts } from 'common/songSoundEvents';

/**
 * Auto EQ's two switches for saved sounds — Song sounds and Album sounds —
 * remembered on this machine, and the one-time note for whoever had the
 * Output panel's "Remember each song's sound" on before Auto EQ took its
 * place. Smart correction's switch is the continuous measurement's own
 * (`continuousEq.ts`).
 *
 * Off until the listener turns them on, and off again after Reset all
 * settings (`settingsReset.ts` removes these keys), which keeps the songs and
 * albums themselves: they are the listener's, like playlists.
 */
export const AUTO_EQ_PARTS_KEY = 'fluideq.autoEq.parts';

/** The Output panel's old switch, read once to carry its choice over. */
export const OLD_SONG_SOUND_KEY = 'fluideq.songSound';

/** The note about the old switch, once dismissed or followed. */
export const AUTO_EQ_MOVED_NOTE_KEY = 'fluideq.autoEq.movedNoteSeen';

const OFF: ISongSoundParts = { songs: false, albums: false };

const readItem = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage can be unavailable; this window then keeps its choices alone.
    return null;
  }
};

const writeItem = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Keep the choice for this window when storage is unavailable.
  }
};

const toParts = (text: string | null): ISongSoundParts | undefined => {
  if (text === null) {
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }
    const { songs, albums } = value as Record<string, unknown>;
    return { songs: songs === true, albums: albums === true };
  } catch {
    return undefined;
  }
};

/**
 * The switches as kept, or as the old switch left them: "Remember each song's
 * sound" on is Song sounds and Album sounds on, which plays every song it
 * kept exactly as before and lets the Library's albums play from the first.
 */
export const readAutoEqParts = (): ISongSoundParts => {
  const kept = toParts(readItem(AUTO_EQ_PARTS_KEY));
  if (kept) {
    return kept;
  }
  return readItem(OLD_SONG_SOUND_KEY) === 'true'
    ? { songs: true, albums: true }
    : OFF;
};

export const writeAutoEqParts = (parts: ISongSoundParts): void =>
  writeItem(AUTO_EQ_PARTS_KEY, JSON.stringify(parts));

/** Whether to show the note: the old switch was on, and it was never seen. */
export const isAutoEqMovedNoteDue = (): boolean =>
  readItem(OLD_SONG_SOUND_KEY) === 'true' &&
  readItem(AUTO_EQ_MOVED_NOTE_KEY) !== 'true';

export const markAutoEqMovedNoteSeen = (): void =>
  writeItem(AUTO_EQ_MOVED_NOTE_KEY, 'true');
