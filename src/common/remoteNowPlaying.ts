/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IRemoteNowPlaying } from './remoteAudio';

/**
 * The rules "what is playing over there" is decided by, for both of its
 * deciders: the window while it is there (`useRemoteNowPlayingBroadcast`,
 * `useRemoteNowPlayingSource`), and main while it is let go in the tray
 * (`main/shareAudio/windowlessShare.ts`). One copy, so the two cannot drift
 * into telling a linked computer two different things about one press.
 */

/** A player as these rules see it: whose it is and whether it plays. */
export interface IPlayerState<TOwner extends string = string> {
  owner: TOwner;
  isPlaying: boolean;
}

/**
 * Whether this description is somebody pressing play ON THIS MACHINE.
 *
 * The listener stops its own music for this, so it has to mean a press and
 * nothing else. Three things that are not a press all look identical in a
 * description that says "playing", and each of them silenced a listener that
 * was happily playing its own album:
 *
 * - THE BAR CHANGING WHAT IT POINTS AT. The listener pauses this machine's
 *   library, the bar falls through to the browser tab that was already
 *   playing here, and the description goes from paused to playing with nobody
 *   near the keyboard. That is the pause coming back as a start, which is the
 *   loop: the listener stops its own player for it and pauses this one again.
 * - A RECONNECTION. The link drops, the peer is new, and the sender
 *   re-announces the song it has been playing all along.
 * - WINDOWS' POLLED SESSION LIST FLAPPING, which republishes a player's state
 *   without the player having done anything.
 *
 * So the question is asked of the PLAYER, not of the bar: this player was not
 * playing a moment ago and is playing now. `seen` carries what each of this
 * machine's players was last doing, and it is what separates the three above
 * from a press — each of them describes a player this machine already knew
 * was playing.
 *
 * ANYTHING ELSE THAT STARTS IS A PRESS, including a player this end is seeing
 * for the first time: a program launched straight into playing publishes its
 * Windows session already playing, and somebody plainly pressed play on it.
 * One player at a time is the whole point of the rule and it does not get
 * holes cut in it to make a loop impossible — the loop is stopped by the
 * clause above, which no starting player can trip.
 *
 * `seen` keeps a player that goes away, which is the other half of that: a
 * Windows session that disappears and comes back playing — the list is
 * polled, and it flaps — is remembered as the one that was already playing.
 */
export const startedHere = <TOwner extends string>(
  seen: ReadonlyMap<TOwner, boolean>,
  source: IPlayerState<TOwner> | undefined,
): boolean =>
  source !== undefined && source.isPlaying && seen.get(source.owner) !== true;

/**
 * Everything a message would say, so two that say the same are one: at most
 * one message a second (the whole second of position), and none while nothing
 * changes.
 */
export const wireKey = (playing: IRemoteNowPlaying | undefined): string =>
  playing
    ? JSON.stringify([
        playing.title,
        playing.subtitle,
        playing.artist,
        playing.isPlaying,
        playing.durationMs,
        Math.floor(playing.positionMs / 1000),
        playing.canNext,
        playing.canPrevious,
        playing.canStep,
        playing.canStop,
      ])
    : '';

/** A player's clock, made safe for the wire: whole, finite, not negative. */
export const wireMs = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

/**
 * Which senders have turned up playing since this end last looked. Used for
 * one thing only — deciding who to pause — and never for deciding whether
 * anything here should stop: stopping what this machine plays needs a press.
 */
export const nowPlayingSenders = (
  known: ReadonlySet<string>,
  playing: readonly string[],
): string[] => playing.filter((id) => !known.has(id));
