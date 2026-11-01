/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the window is told about the core's Library player, worked out from
 * one snapshot of it: the view it draws, the clock under the bar, and what
 * the window's own element should do while it is the deck. Pure, so the
 * window is held to what a test says rather than to a running player.
 */
import type { IPendingSeek } from '../../common/library/pendingSeek';
import type { ILibraryPlayerState } from '../../common/library/playerState';
import type {
  ILibraryRackGate,
  IPlayerRackCopy,
} from '../../common/library/playerRack';
import type {
  ILibraryPlayerClock,
  ILibraryPlayerView,
  IWindowDeckWant,
  TLibraryDeckOwner,
} from '../../common/library/playerWire';
import type { THostEngineState } from './hostEngine';
import type { ILibraryTrack } from '../../common/library/types';
import { quantizeTransportPosition } from '../../common/dsp/nativeTransport';
import { naturalFadeMs, transitionFor } from './deckWants';

/** Where a song is, from whichever deck plays it. */
export interface IHeardClock {
  trackId?: string;
  positionMs: number;
  durationMs: number;
}

export interface IPlayerSnapshot {
  state: ILibraryPlayerState;
  track?: ILibraryTrack;
  owner: TLibraryDeckOwner;
  hostState: THostEngineState;
  /** The deck the song before this one played on. */
  previousOwner?: TLibraryDeckOwner;
  rack?: IPlayerRackCopy;
  clock: IHeardClock;
  pendingSeek?: IPendingSeek;
  windowSeek?: IWindowDeckWant['seek'];
  libraryGate: ILibraryRackGate;
}

/**
 * The bar's clock: the deck's reading for this song, or where the listener
 * just asked to be while the host has not yet answered the seek
 * (`pendingSeek.ts`). A duration the deck could not give falls back to the
 * one in the song's tag.
 */
export const publishedClockOf = (
  snapshot: IPlayerSnapshot,
): ILibraryPlayerClock => {
  const { track, clock, pendingSeek } = snapshot;
  const own = clock.trackId !== undefined && clock.trackId === track?.id;
  return {
    ...(track ? { trackId: track.id } : {}),
    positionMs: pendingSeek?.targetMs ?? (own ? clock.positionMs : 0),
    durationMs:
      own && clock.durationMs > 0 ? clock.durationMs : (track?.durationMs ?? 0),
  };
};

/** A quarter of a second is what the bar can show; the rest is noise. */
export const clockKey = (clock: ILibraryPlayerClock): string =>
  JSON.stringify([
    clock.trackId,
    quantizeTransportPosition(clock.positionMs / 1_000),
    clock.durationMs,
  ]);

/** Where a song is cued when a deck first takes it. */
export const cuePositionOf = (snapshot: IPlayerSnapshot): number => {
  const { track, state, clock } = snapshot;
  if (!track) {
    return 0;
  }
  if (state.restore?.trackId === track.id) {
    return state.restore.positionMs;
  }
  return clock.trackId === track.id ? clock.positionMs : 0;
};

export const windowDeckWantOf = (
  snapshot: IPlayerSnapshot,
): IWindowDeckWant | undefined => {
  const { owner, track, state, rack, previousOwner, windowSeek } = snapshot;
  if (owner !== 'window' || !track) {
    return undefined;
  }
  // The element fades only from a song it was playing itself, and only as
  // the natural overlap would: with the rack and its crossfade both on.
  const transition =
    previousOwner === 'window' &&
    track.kind === 'audio' &&
    naturalFadeMs(rack) !== undefined
      ? transitionFor(rack, track)
      : undefined;
  return {
    trackId: track.id,
    isPlaying: state.isPlaying,
    startMs: cuePositionOf(snapshot),
    isRestore: state.restore?.trackId === track.id,
    ...(transition
      ? {
          transition: {
            durationMs: transition.durationMs,
            curve: transition.curve,
            shape: transition.shape,
            startPositionMs: transition.startPositionMs ?? 0,
          },
        }
      : {}),
    ...(windowSeek ? { seek: windowSeek } : {}),
  };
};

export const playerViewOf = (snapshot: IPlayerSnapshot): ILibraryPlayerView => {
  const { state, track, owner, hostState, libraryGate } = snapshot;
  const { queue } = state;
  // Only what the queue still holds: the sets remember every song ever
  // added or drawn, and the window has no use for the rest.
  const held = new Set(queue?.trackIds ?? []);
  const windowDeck = windowDeckWantOf(snapshot);
  return {
    ...(queue ? { queue } : {}),
    ...(track ? { track } : {}),
    isPlaying: state.isPlaying,
    isUnplayable:
      track !== undefined &&
      (!track.isPlayable || state.failedTrackId === track.id),
    isContinuationOn: state.isContinuationOn,
    added: [...state.addedIds].filter((id) => held.has(id)),
    continued: [...state.continuedIds].filter((id) => held.has(id)),
    deck: owner,
    // Coming up is not yet a host to speak of.
    host: hostState === 'engaging' ? 'idle' : hostState,
    ...(windowDeck ? { windowDeck } : {}),
    libraryGate,
  };
};
