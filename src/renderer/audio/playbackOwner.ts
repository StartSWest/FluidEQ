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

/**
 * Who is allowed to be making sound.
 *
 * This app has three players and no relationship between them: the library's
 * own audio element, the karaoke session's, and whatever page is loaded in the
 * Media tab's `<webview>`. Nothing stopped two of them running at once, so
 * starting a video over a playing album gave both, at full volume, with two
 * transports each insisting they were the one in charge.
 *
 * The rule is one owner. Claiming playback tells whoever held it to stop, and
 * that is the whole mechanism — there is no queue, no priority and no
 * negotiation, because "the thing the user just pressed play on" is always the
 * right answer.
 *
 * A module store rather than a context: the three players sit in different
 * branches of the tree and one of them is not React at all — the webview is a
 * custom element driven imperatively — so a provider above all three would
 * have to be above the whole app and reach into it by ref anyway.
 */
/**
 * `system` is the one that is not a player of this app's.
 *
 * It is whatever else on the machine is making sound — a browser tab, Spotify,
 * VLC — as Windows reports it, shown on the bar when this app has nothing of
 * its own to show. It never claims playback and never registers a stopper:
 * FluidEQ cannot silence another program, and a claim it could not honour
 * would have the library's own audio stop for something that cannot stop.
 */
export type TPlaybackOwner = 'library' | 'karaoke' | 'media' | 'system';

/** What each player hands over when it registers: how to silence it. Called
 * when somebody else claims playback, and never called on the owner that is
 * doing the claiming. */
type TStop = () => void;

const stoppers = new Map<TPlaybackOwner, TStop>();
const listeners = new Set<() => void>();

let owner: TPlaybackOwner | undefined;

const publish = (next: TPlaybackOwner | undefined) => {
  if (owner === next) {
    return;
  }
  owner = next;
  listeners.forEach((listener) => listener());
};

/**
 * Registers a player, and returns the function that takes it off the register.
 *
 * Registering does not claim anything. A player that is merely mounted is not
 * playing, and treating mount as a claim would have the library silence the
 * karaoke tab the moment somebody opened it.
 */
export const registerPlayer = (
  id: TPlaybackOwner,
  stop: TStop,
): (() => void) => {
  stoppers.set(id, stop);
  return () => {
    stoppers.delete(id);
    if (owner === id) {
      publish(undefined);
    }
  };
};

/**
 * Take playback. Everyone else is stopped first.
 *
 * Stopping happens before the claim is published so that a player which
 * reports its own state on `pause` — the library does — has settled by the
 * time anything re-renders against the new owner.
 */
export const claimPlayback = (id: TPlaybackOwner): void => {
  stoppers.forEach((stop, held) => {
    if (held !== id) {
      stop();
    }
  });
  publish(id);
};

/**
 * Give it up, if it is still yours.
 *
 * Guarded, because a player pausing itself long after somebody else has taken
 * over must not clear the new owner — pause events arrive late and out of
 * order, and an unguarded release would leave the app thinking nothing is
 * playing while something plainly is.
 */
export const releasePlayback = (id: TPlaybackOwner): void => {
  if (owner === id) {
    publish(undefined);
  }
};

/** For anything that needs to know without subscribing — an event handler
 * deciding whether the thing it is about to do is even its business. */
export const getPlaybackOwner = (): TPlaybackOwner | undefined => owner;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Who owns playback right now, as a hook. */
export const usePlaybackOwner = (): TPlaybackOwner | undefined =>
  useSyncExternalStore(
    subscribe,
    () => owner,
    () => undefined,
  );

/** Test seam. The store is module state and outlives a test's render, so a
 * suite that claims playback would otherwise leak that into the next one. */
export const resetPlaybackOwner = (): void => {
  stoppers.clear();
  owner = undefined;
  listeners.forEach((listener) => listener());
};
