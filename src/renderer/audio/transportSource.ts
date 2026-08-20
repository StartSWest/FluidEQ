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
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  toggle: () => void;
  /** Absent where the source cannot seek — a page we can only ask to play or
   * pause has no playhead to move. */
  seek?: (positionMs: number) => void;
  /** 0 to 1. Absent where the source has no fader of its own to offer. */
  volume?: number;
  setVolume?: (value: number) => void;
}

const listeners = new Set<() => void>();

let source: ITransportSource | undefined;

const publish = (next: ITransportSource | undefined) => {
  source = next;
  listeners.forEach((listener) => listener());
};

/**
 * Describe this player to the bar, or take the description away.
 *
 * Called on every change a transport can show — position included, which is
 * several times a second — so it is deliberately a plain assignment with no
 * comparison: working out whether a snapshot is equal to the last one costs
 * more than re-rendering a bar of six buttons.
 */
export const setTransportSource = (
  next: ITransportSource | undefined,
): void => {
  publish(next);
};

/** Withdraw a description, if it is still the one on show. Guarded for the
 * reason `releasePlayback` is: a tab unmounting after another has taken over
 * must not blank the bar the new one just filled. */
export const clearTransportSource = (owner: TPlaybackOwner): void => {
  if (source?.owner === owner) {
    publish(undefined);
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** What the bar should be showing, or nothing. */
export const useTransportSource = (): ITransportSource | undefined =>
  useSyncExternalStore(
    subscribe,
    () => source,
    () => undefined,
  );

/** Test seam — module state outlives a render, see `resetPlaybackOwner`. */
export const resetTransportSource = (): void => {
  source = undefined;
  listeners.forEach((listener) => listener());
};
