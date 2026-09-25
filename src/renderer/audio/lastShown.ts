/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { TPlaybackOwner } from './playbackOwner';
import type { ITransportSource } from './transportSource';

/**
 * What the bar last showed as playing, kept for when the player that showed
 * it is gone.
 *
 * A player's description lives only as long as the player: a reload of the
 * window, the browser tab closed, the other computer disconnected, the queue
 * stopped. Each of those left the bar reading "Nothing playing" over a song
 * somebody had been listening to a minute before (Ivan, 2026-09-24: "we need
 * to keep last thing was playing on the bar always unless there is a new
 * thing that plays"). This is the words and the picture of that song, written
 * down, so the bar can go on showing it until something new plays.
 *
 * Words only, never controls. The player is not there to press, so the bar
 * that draws this keeps its buttons quiet; when the player comes back it
 * describes itself and its own bar takes the place of this one.
 */
export interface ILastShown {
  owner: TPlaybackOwner;
  title: string;
  subtitle?: string;
  artworkUrl?: string;
  /** The sending computer's name, for sound that came over the LAN link. */
  origin?: string;
}

const LAST_SHOWN_KEY = 'fluideq.transport.lastShown';

/**
 * The Media tab's cover is a still of the page as a data URL, about 10 KB at
 * the 72px it is taken at. Anything far past that is not a cover this app
 * made, and localStorage is shared by everything the window keeps.
 */
const MAX_ARTWORK_CHARS = 64 * 1024;

const OWNERS: readonly TPlaybackOwner[] = [
  'library',
  'karaoke',
  'media',
  'system',
  'remote',
];

/**
 * A picture that will still be there after a restart.
 *
 * A `blob:` URL is not: it belongs to the page that made it (Karaoke's
 * cover) and dies with it, and a dead one draws as a broken image where the
 * generated tile would otherwise stand.
 */
const lastingArtwork = (url: string | undefined): string | undefined =>
  url === undefined || url.startsWith('blob:') || url.length > MAX_ARTWORK_CHARS
    ? undefined
    : url;

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

/** Written by an older build, by hand, or half: anything that is not a
 * snapshot with an owner and a title is no snapshot at all. */
const parseLastShown = (raw: string | null): ILastShown | undefined => {
  if (raw === null) {
    return undefined;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const owner = OWNERS.find((candidate) => candidate === record.owner);
  const title = optionalText(record.title);
  if (owner === undefined || title === undefined) {
    return undefined;
  }
  const subtitle = optionalText(record.subtitle);
  const artworkUrl = lastingArtwork(optionalText(record.artworkUrl));
  const origin = optionalText(record.origin);
  return {
    owner,
    title,
    ...(subtitle === undefined ? {} : { subtitle }),
    ...(artworkUrl === undefined ? {} : { artworkUrl }),
    ...(origin === undefined ? {} : { origin }),
  };
};

const readStored = (): ILastShown | undefined => {
  try {
    return parseLastShown(window.localStorage.getItem(LAST_SHOWN_KEY));
  } catch {
    return undefined;
  }
};

let lastShown: ILastShown | undefined = readStored();
const listeners = new Set<() => void>();

const sameShown = (a: ILastShown | undefined, b: ILastShown): boolean =>
  a?.owner === b.owner &&
  a.title === b.title &&
  a.subtitle === b.subtitle &&
  a.artworkUrl === b.artworkUrl &&
  a.origin === b.origin;

/**
 * Remember what the bar is showing as the last thing played.
 *
 * Called on every description of that player, position ticks included, so it
 * compares first: storage is written only when the words or the picture
 * change, which is once a song.
 */
export const noteShown = (source: ITransportSource): void => {
  const subtitle = optionalText(source.subtitle);
  const artworkUrl = lastingArtwork(optionalText(source.artworkUrl));
  const origin = optionalText(source.origin);
  const next: ILastShown = {
    owner: source.owner,
    title: source.title,
    ...(subtitle === undefined ? {} : { subtitle }),
    ...(artworkUrl === undefined ? {} : { artworkUrl }),
    ...(origin === undefined ? {} : { origin }),
  };
  if (source.title === '' || sameShown(lastShown, next)) {
    return;
  }
  lastShown = next;
  try {
    window.localStorage.setItem(LAST_SHOWN_KEY, JSON.stringify(next));
  } catch {
    // Kept for this window only, which still covers a player going away
    // mid-session; a restart then starts from the owner alone.
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The last thing the bar showed as playing — see `ILastShown`. */
export const useLastShown = (): ILastShown | undefined =>
  useSyncExternalStore(
    subscribe,
    () => lastShown,
    () => undefined,
  );

/** Test seam — module state and storage outlive a render. */
export const resetLastShown = (): void => {
  lastShown = undefined;
  try {
    window.localStorage.removeItem(LAST_SHOWN_KEY);
  } catch {
    // Nothing was stored; nothing to forget.
  }
  listeners.forEach((listener) => listener());
};
