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

/**
 * A song on its way from the Library tab to the Karaoke tab.
 *
 * A queue rather than a call, because the destination may not exist yet. The
 * Karaoke workspace is mounted on first visit and not before — see App's
 * `hasOpenedKaraoke` — so on the first "Send to Karaoke" the file is handed
 * to nobody. It waits here instead, and the workspace drains it the moment it
 * mounts. Without the queue the very first use of the feature would be the
 * one time it silently did nothing.
 *
 * `folderTree.ts`'s store, with the `useSyncExternalStore` subscription that
 * goes with it. Not a context: the two tabs are siblings under App, so a
 * shared context would have to be App's own state, and App would then hold a
 * `File` it has no use for.
 */

import { useSyncExternalStore } from 'react';
import type { IKaraokeLibraryOrigin } from '../karaoke/karaokeLibraryOrigin';

const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * The reference the snapshot is read from.
 *
 * `useSyncExternalStore` compares snapshots by identity and will loop forever
 * on a getter that builds a new array each call, so the empty case is one
 * frozen constant and every change replaces the whole array.
 */
const EMPTY: readonly File[] = [];

let pending: readonly File[] = EMPTY;

/** Files sent, oldest first, or an empty array. */
export const pendingKaraokeFiles = (): readonly File[] => pending;

export const sendFilesToKaraoke = (files: readonly File[]): void => {
  if (files.length === 0) {
    return;
  }
  pending = [...pending, ...files];
  emit();
};

/**
 * Takes what is waiting and empties the queue.
 *
 * Only the Karaoke workspace calls this, and it calls it once per change:
 * anything that reads without taking would see the same files again on the
 * next render and import them twice.
 */
export const drainKaraokeFiles = (): readonly File[] => {
  if (pending.length === 0) {
    return EMPTY;
  }
  const taken = pending;
  pending = EMPTY;
  emit();
  return taken;
};

/**
 * A song sent from the Library's Lyrics tab to be timed in the Maker, with
 * the words it already has.
 *
 * Its own slot beside the files, because it asks for something different:
 * a file sent from the row menu is a song to SING, and lands in the player
 * with the Maker put away; this one is a song to WORK ON, and lands in the
 * Maker. One slot, not a queue: a second press before the tab took the
 * first asked for the second song.
 */
export interface IKaraokeMakerRequest {
  /** The song's audio, as `trackAsKaraokeFile` reads it. */
  audio: File;
  /** Timed words as the `.lrc` the playlist pairs with the audio. */
  lyrics?: File;
  /** Plain words, for the Maker's lyric editor to time. */
  plainText?: string;
  /** Where the song lives in the Library, to save the timing back to. */
  origin: IKaraokeLibraryOrigin;
}

let pendingMaker: IKaraokeMakerRequest | undefined;

export const sendSongToKaraokeMaker = (request: IKaraokeMakerRequest) => {
  pendingMaker = request;
  emit();
};

/** Takes the waiting request; only the Karaoke workspace calls this. */
export const takeKaraokeMakerRequest = (): IKaraokeMakerRequest | undefined => {
  const taken = pendingMaker;
  if (taken !== undefined) {
    pendingMaker = undefined;
    emit();
  }
  return taken;
};

export const usePendingKaraokeMakerRequest = ():
  IKaraokeMakerRequest | undefined =>
  useSyncExternalStore(
    subscribe,
    () => pendingMaker,
    () => undefined,
  );

/**
 * Whether anything is waiting, files or a song for the Maker.
 *
 * App watches this to switch to the Karaoke tab and to mount the workspace
 * that will drain it. It deliberately does not look at what is waiting —
 * moving the reader is all App's half of this is.
 */
export const useHasPendingKaraokeHandoff = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => pending.length > 0 || pendingMaker !== undefined,
    () => false,
  );

export const usePendingKaraokeFiles = (): readonly File[] =>
  useSyncExternalStore(
    subscribe,
    () => pending,
    () => EMPTY,
  );
