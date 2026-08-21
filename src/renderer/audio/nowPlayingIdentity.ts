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

import type { ISongIdentity } from 'common/songIdentity';
import { usePlaybackOwner, useLastReleasedOwner } from './playbackOwner';
import type { TPlaybackOwner } from './playbackOwner';
import { useTransportSources } from './transportSource';
import type { ITransportSource } from './transportSource';

/** What is actually happening to a song, as far as the recorder is
 * concerned — never merely what the bar would show for it. */
export interface INowPlayingIdentity {
  identity?: ISongIdentity;
  isPlaying: boolean;
}

/**
 * What is ACTUALLY being equalised, which is not what the bar is showing.
 *
 * `pickTransportOwner` takes the current tab as an input, so with nothing
 * playing the bar shows the last paused thing and its subject changes as you
 * switch tabs. That is right for a bar — the resume button should follow you —
 * and wrong for a recorder: a paused song is not being equalised, and a song
 * must not start being recorded because somebody opened the EQ page.
 *
 * Three cases, in order:
 *
 * 1. A player of ours that holds playback wins outright.
 * 2. Failing that, the machine's own player while it says it is playing.
 * 3. Failing THAT — nobody playing right now — the identity `lastReleasedOwner`
 *    most recently held, reported with `isPlaying: false` rather than
 *    vanishing outright.
 *
 * The third case is what lets a pause read as a pause instead of a stop. Both
 * of this app's own release paths clear ownership immediately, so without it
 * this hook collapsed straight to "nothing" the instant anyone pressed pause
 * — which fed the recorder's `nowPlaying` event `{ identity: undefined }`
 * regardless of which of the two that actually was, and an *identity absent*
 * event closes a session outright rather than suspending it. See
 * `songEqTiming.ts`'s `SONG_EQ_SUSPEND_GRACE_MS`, which this exists to make
 * reachable at all.
 *
 * Deliberately excludes `system` from that third case: it never claims
 * playback in the first place (see `playbackOwner.ts`), so there is no
 * "release" for it to be remembered by — and the null test right below this
 * one, pinning a paused `system` player as still nothing, is the one case
 * that depends on that exclusion.
 */
export const pickPlayingIdentity = (
  sources: Partial<Record<TPlaybackOwner, ITransportSource>>,
  playingOwner: TPlaybackOwner | undefined,
  lastReleasedOwner: TPlaybackOwner | undefined,
): INowPlayingIdentity => {
  if (playingOwner !== undefined) {
    return { identity: sources[playingOwner]?.identity, isPlaying: true };
  }
  if (sources.system?.isPlaying === true) {
    return { identity: sources.system.identity, isPlaying: true };
  }
  const paused =
    lastReleasedOwner !== undefined
      ? sources[lastReleasedOwner]?.identity
      : undefined;
  return { identity: paused, isPlaying: false };
};

export const useNowPlayingIdentity = (): INowPlayingIdentity => {
  const sources = useTransportSources();
  const playingOwner = usePlaybackOwner();
  const lastReleasedOwner = useLastReleasedOwner();
  return pickPlayingIdentity(sources, playingOwner, lastReleasedOwner);
};
