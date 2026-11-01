/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What crosses between the Library player in the app's core and the window.
 *
 * The core sends the window what to draw (`ILibraryPlayerView`), the clock
 * separately because it changes four times a second and almost nothing reads
 * it (`ILibraryPlayerClock`), and — only while the window's own element is
 * the deck — what that element should be doing. The window sends presses
 * (`TLibraryPlayerCommand`) and, while its element is the deck, what the
 * element reports (`TWindowDeckReport`). Everything arriving at the core is
 * checked here: the window is the half of this app that loads remote pages.
 */
import type { TCrossfadeCurve } from '../dsp/chain';
import type { ICrossfadeShape } from '../dsp/crossfadeShape';
import type { ILibraryRackGate } from './playerRack';
import type { ILibraryQueue } from './queue';
import type { ILibraryTrack } from './types';

export const LIBRARY_PLAYER_CHANNEL = {
  /** Core → window: the player as it should be drawn. */
  view: 'library-player-view',
  /** Core → window: where the song is, four times a second at most. */
  clock: 'library-player-clock',
  /** Window → core: send me the view and the clock again. */
  ask: 'library-player-ask',
  /** Window → core: a press. Answered (`TLibraryPlayerAnswer`). */
  command: 'library-player-command',
  /** Window → core: what the window's own deck reports. */
  deck: 'library-player-deck',
  /** Window → core, once: its old copy of the session. */
  legacy: 'library-player-legacy',
  /**
   * Window → core: the window's Library player was put away (`away`). Its
   * rack copy arriving says it is back.
   */
  away: 'library-player-away',
} as const;

/** Which deck plays the song now. */
export type TLibraryDeckOwner = 'host' | 'window' | 'none';

/**
 * The native host as the DSP page tells it: idle (nothing for it, or still
 * coming up), engaged, or failed — a host asked for that did not arrive, so
 * the page says the rack is unavailable rather than look like it works.
 */
export type TLibraryHostState = 'idle' | 'engaged' | 'failed';

export interface IWindowDeckTransition {
  durationMs: number;
  curve: TCrossfadeCurve;
  shape: ICrossfadeShape;
  /** Cue the incoming element here before it is heard. */
  startPositionMs: number;
}

/**
 * What the window's element should be doing, while it is the deck: a video
 * (always), and a song the native host is not playing — no host on this
 * machine, a host that failed to start, or a file it could not open.
 */
export interface IWindowDeckWant {
  trackId: string;
  isPlaying: boolean;
  /**
   * Where the song is cued when the element first takes it: a restored
   * session, or a song the host gave up part way. Zero for a song chosen.
   */
  startMs: number;
  /** Cue only: a restored session waits for Play and fetches no more. */
  isRestore: boolean;
  /** The fade, when the song before it also played on the element. */
  transition?: IWindowDeckTransition;
  /** Bumped for each seek the listener asked for. */
  seek?: { id: number; positionMs: number };
}

export interface ILibraryPlayerView {
  queue?: ILibraryQueue;
  /** The song the queue is on, as the library has it. */
  track?: ILibraryTrack;
  isPlaying: boolean;
  isUnplayable: boolean;
  isContinuationOn: boolean;
  /** The queued ids added by hand, and those continuation drew. */
  added: readonly string[];
  continued: readonly string[];
  deck: TLibraryDeckOwner;
  host: TLibraryHostState;
  windowDeck?: IWindowDeckWant;
  /** The player's half of where the rack runs (`playerRack.ts`). */
  libraryGate: ILibraryRackGate;
}

export const NO_PLAYER_VIEW: ILibraryPlayerView = {
  isPlaying: false,
  isUnplayable: false,
  isContinuationOn: true,
  added: [],
  continued: [],
  deck: 'none',
  host: 'idle',
  libraryGate: { libraryAudible: false, librarySourceReady: false },
};

export interface ILibraryPlayerClock {
  trackId?: string;
  positionMs: number;
  durationMs: number;
}

export type TLibraryPlayerCommand =
  | { kind: 'play'; trackIds: readonly string[]; startTrackId: string }
  | { kind: 'toggle' }
  | { kind: 'setPlaying'; isPlaying: boolean }
  | { kind: 'stop' }
  | { kind: 'skip'; direction: 1 | -1 }
  | { kind: 'seek'; positionMs: number }
  | { kind: 'jump'; position: number }
  | { kind: 'add'; trackIds: readonly string[]; beforeIds?: readonly string[] }
  | { kind: 'remove'; position: number }
  | { kind: 'move'; from: number; to: number }
  | { kind: 'shuffle'; isShuffled: boolean }
  | { kind: 'repeat' }
  | { kind: 'retarget'; trackIds: readonly string[]; listKey: string }
  | { kind: 'topUp'; trackIds: readonly string[]; listKey: string }
  | { kind: 'continuation'; isOn: boolean };

/** What a press answers: how many songs joined, for an add. */
export interface ILibraryPlayerAnswer {
  joined?: number;
}

export type TWindowDeckReport =
  | { kind: 'clock'; trackId: string; positionMs: number; durationMs: number }
  | { kind: 'ended'; trackId: string }
  /** The element stopped or started on its own: its controls, a device. */
  | { kind: 'playing'; trackId: string; isPlaying: boolean }
  | { kind: 'failed'; trackId: string };

/** A list of song ids, as long as a library could ever hand over. */
const MAX_IDS = 200_000;
const MAX_ID_LENGTH = 512;

const isId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= MAX_ID_LENGTH;

const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length <= MAX_IDS && value.every(isId);

const isIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isFiniteMs = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const parsePlayerCommand = (
  raw: unknown,
): TLibraryPlayerCommand | undefined => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const value = raw as Record<string, unknown>;
  switch (value.kind) {
    case 'play':
      return isIdList(value.trackIds) && isId(value.startTrackId)
        ? {
            kind: 'play',
            trackIds: value.trackIds,
            startTrackId: value.startTrackId,
          }
        : undefined;
    case 'toggle':
    case 'stop':
    case 'repeat':
      return { kind: value.kind };
    case 'setPlaying':
      return typeof value.isPlaying === 'boolean'
        ? { kind: 'setPlaying', isPlaying: value.isPlaying }
        : undefined;
    case 'skip':
      return value.direction === 1 || value.direction === -1
        ? { kind: 'skip', direction: value.direction }
        : undefined;
    case 'seek':
      return isFiniteMs(value.positionMs)
        ? { kind: 'seek', positionMs: value.positionMs }
        : undefined;
    case 'jump':
      return isIndex(value.position)
        ? { kind: 'jump', position: value.position }
        : undefined;
    case 'add':
      if (!isIdList(value.trackIds)) {
        return undefined;
      }
      if (value.beforeIds === undefined) {
        return { kind: 'add', trackIds: value.trackIds };
      }
      return isIdList(value.beforeIds)
        ? { kind: 'add', trackIds: value.trackIds, beforeIds: value.beforeIds }
        : undefined;
    case 'remove':
      return isIndex(value.position)
        ? { kind: 'remove', position: value.position }
        : undefined;
    case 'move':
      return isIndex(value.from) && isIndex(value.to)
        ? { kind: 'move', from: value.from, to: value.to }
        : undefined;
    case 'shuffle':
      return typeof value.isShuffled === 'boolean'
        ? { kind: 'shuffle', isShuffled: value.isShuffled }
        : undefined;
    case 'retarget':
    case 'topUp':
      return isIdList(value.trackIds) && isId(value.listKey)
        ? { kind: value.kind, trackIds: value.trackIds, listKey: value.listKey }
        : undefined;
    case 'continuation':
      return typeof value.isOn === 'boolean'
        ? { kind: 'continuation', isOn: value.isOn }
        : undefined;
    default:
      return undefined;
  }
};

export const parseDeckReport = (
  raw: unknown,
): TWindowDeckReport | undefined => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const value = raw as Record<string, unknown>;
  if (!isId(value.trackId)) {
    return undefined;
  }
  switch (value.kind) {
    case 'clock':
      return isFiniteMs(value.positionMs) && isFiniteMs(value.durationMs)
        ? {
            kind: 'clock',
            trackId: value.trackId,
            positionMs: value.positionMs,
            durationMs: value.durationMs,
          }
        : undefined;
    case 'ended':
    case 'failed':
      return { kind: value.kind, trackId: value.trackId };
    case 'playing':
      return typeof value.isPlaying === 'boolean'
        ? {
            kind: 'playing',
            trackId: value.trackId,
            isPlaying: value.isPlaying,
          }
        : undefined;
    default:
      return undefined;
  }
};
