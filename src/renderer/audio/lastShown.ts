/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { ITransportSource } from './transportSource';

/**
 * The players whose songs are the listener's own files: the Library's and
 * Karaoke's. The only ones anything here is remembered for.
 *
 * NOTHING THAT PLAYED OUTSIDE THEM OUTLIVES ITS PLAYER (Ivan, 2026-10-26:
 * "when nothing is playing it keeps last system audio thing on context ...
 * user maybe watching porn or whatever and closed it and get busted"). Every
 * owner used to be remembered, written to storage, so a browser tab closed an
 * hour before — its title, its channel, the cover Windows published for it —
 * went on standing on the bar after it was gone, and came back with the
 * window at the next launch. Another program (`system`), another computer
 * (`remote`) and a page in the Media tab (`media`, whose cover is a still of
 * the page itself) are shown only while their player still describes them,
 * and nothing of them is ever written down.
 */
export type TOwnOwner = 'library' | 'karaoke';

const OWN_OWNERS: readonly TOwnOwner[] = ['library', 'karaoke'];

/** Whether `owner`'s songs are the listener's own files — see `TOwnOwner`. */
export const isOwnMusic = (owner: unknown): owner is TOwnOwner =>
  OWN_OWNERS.some((candidate) => candidate === owner);

/**
 * What the bar last showed as playing of the listener's own, kept for when
 * the player that showed it is gone.
 *
 * A player's description lives only as long as the player: a reload of the
 * window, the queue stopped, the Karaoke session closed. Each of those left
 * the bar reading "Nothing playing" over a song somebody had been listening
 * to a minute before (Ivan, 2026-09-24: "we need to keep last thing was
 * playing on the bar always unless there is a new thing that plays"). This is
 * the words and the picture of that song, written down, so the bar can go on
 * showing it until something new plays.
 *
 * Words only, never controls. The player is not there to press, so the bar
 * that draws this keeps its buttons quiet; when the player comes back it
 * describes itself and its own bar takes the place of this one.
 */
export interface ILastShown {
  owner: TOwnOwner;
  title: string;
  subtitle?: string;
  artworkUrl?: string;
}

const LAST_SHOWN_KEY = 'fluideq.transport.lastShown';

/**
 * A Library cover is an app URL a few dozen characters long. Anything far past
 * that is not a cover this app made, and localStorage is shared by everything
 * the window keeps.
 */
const MAX_ARTWORK_CHARS = 64 * 1024;

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
 * snapshot of the listener's own song with a title is no snapshot at all. */
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
  const { owner } = record;
  const title = optionalText(record.title);
  if (!isOwnMusic(owner) || title === undefined) {
    return undefined;
  }
  const subtitle = optionalText(record.subtitle);
  const artworkUrl = lastingArtwork(optionalText(record.artworkUrl));
  return {
    owner,
    title,
    ...(subtitle === undefined ? {} : { subtitle }),
    ...(artworkUrl === undefined ? {} : { artworkUrl }),
  };
};

/**
 * The snapshot as the window opens, and the clean-up of every one that may
 * not stay.
 *
 * Builds before 2026-10-26 wrote another program's song here, and another
 * computer's with that computer's name; whatever is stored that is not a
 * song of the listener's own is removed as the window opens, so the title of
 * something played outside a previous session is neither shown nor kept.
 */
const readStored = (): ILastShown | undefined => {
  try {
    const raw = window.localStorage.getItem(LAST_SHOWN_KEY);
    const stored = parseLastShown(raw);
    if (raw !== null && stored === undefined) {
      window.localStorage.removeItem(LAST_SHOWN_KEY);
    }
    return stored;
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
  a.artworkUrl === b.artworkUrl;

/**
 * Remember what the bar is showing as the last thing played, when it is a
 * song of the listener's own — anything else passes through untouched.
 *
 * Called on every description of that player, position ticks included, so it
 * compares first: storage is written only when the words or the picture
 * change, which is once a song.
 */
export const noteShown = (source: ITransportSource): void => {
  const { owner } = source;
  if (!isOwnMusic(owner) || source.title === '') {
    return;
  }
  const subtitle = optionalText(source.subtitle);
  const artworkUrl = lastingArtwork(optionalText(source.artworkUrl));
  const next: ILastShown = {
    owner,
    title: source.title,
    ...(subtitle === undefined ? {} : { subtitle }),
    ...(artworkUrl === undefined ? {} : { artworkUrl }),
  };
  if (sameShown(lastShown, next)) {
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

/** The last song of the listener's own the bar showed — see `ILastShown`. */
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
