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

import { useSyncExternalStore } from 'react';
import type { ISongIdentity } from 'common/songIdentity';
import type { TPlaybackOwner } from './playbackOwner';

/**
 * What a player tells the bar at the foot of the window about itself.
 *
 * The bar is one control for the whole app, and what it drives depends on
 * which tab is open — the library's queue, the karaoke session, or whatever
 * page the Media tab has loaded. Those three live in different branches of
 * the tree and one of them is a `<webview>` we do not own, so the bar cannot
 * reach into them. They describe themselves here instead, and the bar renders
 * whichever description is current.
 *
 * Deliberately the smallest thing a transport needs and no more. The library's
 * own bar keeps its cover art, its format readout, its shuffle and repeat —
 * that one is rendered from the library player directly, because it has more
 * to say than any other source does. This shape is what the *other* sources
 * can honestly fill in.
 */
export interface ITransportSource {
  owner: TPlaybackOwner;
  /** What is playing. A song title, a video's page title. */
  title: string;
  /** The line under it, if there is one worth showing. */
  subtitle?: string;
  /**
   * A cover, already resolved to a URL this source owns the lifetime of.
   *
   * Absent is not "no picture": the bar draws the same generated tile the
   * library draws for a track with no artwork, from the title. Every bar has
   * a cover in the same place, whichever tab drew it.
   */
  artworkUrl?: string;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  toggle: () => void;
  /** Absent where the source cannot seek — a page we can only ask to play or
   * pause has no playhead to move. */
  seek?: (positionMs: number) => void;
  /**
   * Move the playhead by a step, for a source that will not say where it is.
   *
   * The Media tab's page and the machine's own players both take "five
   * seconds on from wherever you are", and neither reports a position often
   * enough for the bar to work that out itself: the guest is sampled every
   * few seconds, and Windows publishes a position only when a player thinks
   * to republish one. A relative step is the honest shape for both, and where
   * a source has one the skip buttons use it rather than doing arithmetic on
   * a stale number.
   */
  nudge?: (deltaMs: number) => void;
  /**
   * The queue either side, where there is one.
   *
   * Absent for a karaoke session and for a web page: one song and one page
   * have no next. Present for another program's player only where Windows
   * says that player takes the command — a button that answers nothing is
   * worse than a button that is not offered.
   */
  next?: () => void;
  previous?: () => void;
  /** 0 to 1. Absent where the source has no fader of its own to offer. */
  volume?: number;
  setVolume?: (value: number) => void;
  /**
   * This context's own controls, drawn inside the bar in place of the plain
   * play button.
   *
   * One wrapper, and the options change with the tab. Karaoke's transport is
   * not a play button — it has the mix faders, the jump-to-start and
   * jump-to-end, the pitch tone — and reducing it to play/pause on the way
   * into a shared bar would be taking those away from the tab that needs
   * them. It hands over the row it already draws instead, and the bar puts it
   * where its own buttons would have gone.
   *
   * A flag and not the element itself: the tab portals its controls into the
   * space the bar keeps for them — see `transportSlot` for why the element
   * cannot travel through here.
   */
  hasOwnControls?: boolean;
  /**
   * What this is, for the app to remember it by.
   *
   * Optional because a source can honestly have none — a page with no title,
   * a player that registered and loaded nothing. Absent means this is not a
   * thing worth filing a correction under, and the recorder skips it.
   */
  identity?: ISongIdentity;
}

const listeners = new Set<() => void>();

/**
 * One description per player, not one for the app.
 *
 * The bar belongs to the page it is under: open Karaoke and it drives the
 * karaoke session, open Media and it drives the page. Only a tab with nothing
 * loaded falls back to whatever is actually making sound, so a song started
 * in the library can still be paused from anywhere. Keeping a single
 * description would make that impossible — the last tab to publish would own
 * the bar on every other tab.
 */
let sources: Partial<Record<TPlaybackOwner, ITransportSource>> = {};

/**
 * Who described themselves last.
 *
 * The bar on a tab that is not a player — the EQ, Voicing, Config — is
 * whatever was last being used, and this is how it is known. Publishing
 * happens on every change a transport can show, so the most recent publish is
 * the song that is playing, or, once it is paused, the song somebody paused
 * and is about to resume. Without it, pausing while on one of those tabs made
 * the bar vanish and took the resume button with it.
 *
 * Remembered across restarts, so the answer survives the one moment it is
 * least obvious: the app opens with nothing having been described yet, and
 * the first player to come back — the library restoring its queue, karaoke
 * its session — is not necessarily the one somebody was using. The stored
 * name is only a preference for whichever of them registers; a source that
 * never arrives is never shown, because `pickTransportOwner` reads the
 * register rather than this.
 */
const LAST_OWNER_KEY = 'fluideq.transport.lastOwner';

const OWNERS: readonly TPlaybackOwner[] = [
  'library',
  'karaoke',
  'media',
  'system',
];

const readLastOwner = (): TPlaybackOwner | undefined => {
  try {
    const stored = window.localStorage.getItem(LAST_OWNER_KEY);
    return OWNERS.find((owner) => owner === stored);
  } catch {
    return undefined;
  }
};

let lastOwner: TPlaybackOwner | undefined = readLastOwner();

const publish = (next: Partial<Record<TPlaybackOwner, ITransportSource>>) => {
  sources = next;
  listeners.forEach((listener) => listener());
};

/**
 * Describe this player to the bar.
 *
 * Called on every change a transport can show — position included, which is
 * several times a second — so it is deliberately a plain assignment with no
 * comparison: working out whether a snapshot is equal to the last one costs
 * more than re-rendering a bar of six buttons.
 */
export const setTransportSource = (next: ITransportSource): void => {
  // THE MACHINE'S OWN PLAYER IS NEVER "THE LAST THING".
  //
  // It takes the bar by playing and by nothing else — see `pickTransportOwner`
  // — so on a tab that is not a player, with nothing making any sound, the bar
  // goes back to the last song of this app's rather than to a browser tab
  // somebody paused an hour ago. Which is the whole of the rule: something
  // outside is worth the bar while it is playing, and worth nothing once it
  // stops.
  if (next.owner !== 'system') {
    lastOwner = next.owner;
    try {
      window.localStorage.setItem(LAST_OWNER_KEY, next.owner);
    } catch {
      // The preference then lasts as long as the window, which is what it
      // did before it was written down at all.
    }
  }
  publish({ ...sources, [next.owner]: next });
};

/** Withdraw a description. Not guarded against another owner's, the way
 * `releasePlayback` has to be — each player has its own entry here, so a tab
 * unmounting can only ever take its own away. */
export const clearTransportSource = (owner: TPlaybackOwner): void => {
  if (sources[owner] === undefined) {
    return;
  }
  const next = { ...sources };
  delete next[owner];
  if (lastOwner === owner) {
    lastOwner = undefined;
  }
  publish(next);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const EMPTY: Partial<Record<TPlaybackOwner, ITransportSource>> = {};

/** Every player that has something to show, by owner. */
export const useTransportSources = (): Partial<
  Record<TPlaybackOwner, ITransportSource>
> =>
  useSyncExternalStore(
    subscribe,
    () => sources,
    () => EMPTY,
  );

/** The owner of the most recent description — see `lastOwner`. */
export const useLastTransportOwner = (): TPlaybackOwner | undefined =>
  useSyncExternalStore(
    subscribe,
    () => lastOwner,
    () => undefined,
  );

/** Test seam — module state outlives a render, see `resetPlaybackOwner`. */
export const resetTransportSource = (): void => {
  sources = {};
  lastOwner = undefined;
  try {
    // Tests share one jsdom, and a remembered owner would leak from one case
    // into the next exactly as the register itself would.
    window.localStorage.removeItem(LAST_OWNER_KEY);
  } catch {
    // Nothing was stored; nothing to forget.
  }
  listeners.forEach((listener) => listener());
};
