/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which deck plays the song, and what each deck is asked for — pure, so each
 * rule is held by a test rather than by listening.
 */
import {
  encodeChainSettings,
  appendPresetTone,
} from '../../common/dsp/chainWire';
import { playerRunsRack, rackFor } from '../../common/dsp/rackPlacement';
import { leadInStartMs } from '../../common/library/crossfadeTiming';
import type {
  ILibraryRackGate,
  IPlayerRackCopy,
} from '../../common/library/playerRack';
import type { TLibraryDeckOwner } from '../../common/library/playerWire';
import type { ILibraryTrack } from '../../common/library/types';
import type { IHostDeckWant } from './hostDeckTypes';
import type { THostEngineState } from './hostEngine';

/**
 * The deck for this song.
 *
 * A video is the window's: it has a picture. A song the host cannot play is
 * the window's element too — no host built for this machine, a host that
 * would not start, or a file it refused — so the Library still plays,
 * unprocessed and saying so, rather than sit silent. A song nobody can play
 * has no deck at all.
 */
export const deckOwnerFor = (options: {
  track: ILibraryTrack | undefined;
  failedTrackId: string | undefined;
  refusedTrackId: string | undefined;
  hostAvailable: boolean;
  hostState: THostEngineState;
}): TLibraryDeckOwner => {
  const { track, failedTrackId, refusedTrackId, hostAvailable, hostState } =
    options;
  if (!track || !track.isPlayable || failedTrackId === track.id) {
    return 'none';
  }
  if (
    track.kind === 'video' ||
    !hostAvailable ||
    hostState === 'failed' ||
    refusedTrackId === track.id
  ) {
    return 'window';
  }
  return 'host';
};

/**
 * Whether the host should be up: while a song it could play is the current
 * one, playing or not, for as long as the Library is in use. A pause is a
 * loaded deck told to pause; tearing the host down for it is what once played
 * the same file twice, a few milliseconds apart.
 *
 * In use: playing, or the window's Library player out — opened, or put back
 * at launch because the Library was the last thing played. The host opens an
 * audio device, and opening one wakes the hardware, so a launch that never
 * touches the Library starts none; and a player put away while paused lets it
 * go, as it always did. Not before the window has handed the rack over — the
 * chain goes in before the device.
 */
export const hostWanted = (options: {
  track: ILibraryTrack | undefined;
  hasRack: boolean;
  isPlaying: boolean;
  windowHasPlayer: boolean;
}): boolean =>
  options.hasRack &&
  (options.isPlaying || options.windowHasPlayer) &&
  options.track?.kind === 'audio' &&
  options.track.isPlayable;

/** The song after this one, for the host to hold ready on its spare deck. */
export const upcomingFor = (
  track: ILibraryTrack | undefined,
  next: ILibraryTrack | undefined,
): IHostDeckWant['upcoming'] =>
  track !== undefined &&
  next !== undefined &&
  next.id !== track.id &&
  next.kind === 'audio' &&
  next.isPlayable
    ? {
        path: next.path,
        startPositionMs: leadInStartMs(next.normalization?.edges),
      }
    : undefined;

/**
 * The fade a change of song uses, carried as state: the change IS the cue.
 * On whenever the crossfade is — a Next pressed with the crossfade on fades,
 * as it did when the window drove the host — and cued at the incoming
 * song's music.
 */
export const transitionFor = (
  rack: IPlayerRackCopy | undefined,
  track: ILibraryTrack,
): IHostDeckWant['transition'] =>
  rack?.settings.crossfade.enabled
    ? {
        durationMs: rack.settings.crossfade.durationMs,
        curve: rack.settings.crossfade.curve,
        shape: rack.settings.crossfade.shape,
        startPositionMs: leadInStartMs(track.normalization?.edges),
      }
    : undefined;

/**
 * Where a fade onto this song is over, in the song's own time: its lead-in
 * plus the fade. Undefined when a change of song would not fade.
 */
export const fadeOverAtMs = (
  rack: IPlayerRackCopy | undefined,
  track: ILibraryTrack,
): number | undefined => {
  const transition = transitionFor(rack, track);
  return transition
    ? (transition.startPositionMs ?? 0) + transition.durationMs
    : undefined;
};

/** Whether the natural overlap at the end of a song runs at all. */
export const naturalFadeMs = (
  rack: IPlayerRackCopy | undefined,
): number | undefined =>
  rack?.settings.enabled && rack.settings.crossfade.enabled
    ? rack.settings.crossfade.durationMs
    : undefined;

/**
 * The rack line the host runs: the player's copy as the gate places it —
 * switched off at the root wherever it belongs somewhere else — with the
 * preset's curve after it for the Maximizer to limit through. A rack
 * switched off carries no curve: nothing limits through it.
 */
export const playerChainLine = (
  rack: IPlayerRackCopy,
  libraryGate: ILibraryRackGate,
): number[] => {
  const settings = rackFor(
    rack.settings,
    playerRunsRack({ ...rack.gate, ...libraryGate }),
  );
  const line = encodeChainSettings(settings);
  return settings.enabled ? appendPresetTone(line, rack.tone) : line;
};
