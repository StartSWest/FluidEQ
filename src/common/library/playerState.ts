/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Library player is asked to do, as rules on its state.
 *
 * The player runs in the app's core (`main/libraryPlayer/`), so a song moves
 * on, fades into the next and is remembered whether or not a window is
 * open; the window draws it and sends presses. Every press lands here first,
 * as a pure step from one state to the next, and the core then brings the
 * deck — the native host, or the window's own element for what the host
 * cannot play — to what the state says.
 *
 * The rules are the ones the window's player kept in its hooks, each earned
 * one bug at a time; the comments that say why travelled with them.
 */
import {
  ILibraryQueue,
  TLibraryRepeat,
  advanceQueue,
  buildQueue,
  currentTrackId,
  queueAtEnd,
} from './queue';
import { isOnLastSong, settleGuesses, uniqueTrackIds } from './upNextRules';

const REPEAT_CYCLE: readonly TLibraryRepeat[] = ['off', 'all', 'one'];

export const nextRepeat = (repeat: TLibraryRepeat): TLibraryRepeat =>
  REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(repeat) + 1) % REPEAT_CYCLE.length];

/** Past this point Previous restarts first; inside it, Previous changes track. */
export const PREVIOUS_RESTART_THRESHOLD_MS = 10_000;

export interface ILibraryPlayerState {
  queue: ILibraryQueue | undefined;
  /** What the listener wants of the transport, not what a deck reported. */
  isPlaying: boolean;
  /**
   * The ids the listener added by hand, ever since the last fresh play.
   *
   * Kept beside the queue rather than inside it because the queue's job is
   * unchanged — one run of tracks with a position in it, the added ones
   * spliced in so advance, repeat and shuffle need know nothing of where a
   * track came from. This only tells Up Next which of them to head.
   */
  addedIds: ReadonlySet<string>;
  /** Drawn by continuation, so Up Next heads them as their own run. */
  continuedIds: ReadonlySet<string>;
  /**
   * Whether the player keeps going once the queue runs out, with more of the
   * playing track's genre drawn from the whole library. On unless turned off.
   */
  isContinuationOn: boolean;
  /**
   * Where a restored session left off: the deck cues the track there and
   * waits for Play. Coming back to the app and having it start making noise
   * on its own is the wrong side of the line between "where you were" and
   * "what you asked for". Gone as soon as anything else is chosen.
   */
  restore?: { trackId: string; positionMs: number };
  /** A track a deck could not play at all; cleared by any change of track. */
  failedTrackId?: string;
}

export const INITIAL_PLAYER_STATE: ILibraryPlayerState = {
  queue: undefined,
  isPlaying: false,
  addedIds: new Set(),
  continuedIds: new Set(),
  isContinuationOn: true,
};

export const playingTrackId = (
  state: ILibraryPlayerState,
): string | undefined =>
  state.queue ? currentTrackId(state.queue) : undefined;

/**
 * Whether a song stands in the queue as continuation's draw — drawn, and not
 * picked since.
 */
export const isGuessIn =
  (state: ILibraryPlayerState) =>
  (trackId: string): boolean =>
    state.continuedIds.has(trackId) && !state.addedIds.has(trackId);

/**
 * A new queue, and with it the one rule every change of song shares: a
 * different song is a song asked for, so it plays — Next pressed while
 * paused starts the next song, as it always did — and whatever a restored
 * session or a failed deck said was about the song before.
 */
export const withQueue = (
  state: ILibraryPlayerState,
  queue: ILibraryQueue | undefined,
): ILibraryPlayerState => {
  const before = playingTrackId(state);
  const after = queue ? currentTrackId(queue) : undefined;
  if (before === after) {
    return queue === state.queue ? state : { ...state, queue };
  }
  const { restore: _restore, failedTrackId: _failed, ...rest } = state;
  return { ...rest, queue, isPlaying: after !== undefined };
};

/**
 * The queue is whatever list the caller was looking at — a double click
 * inside an album hands the album's own track ids, a filtered search hands
 * the filtered list. Shuffle and repeat are the listener's settings rather
 * than the list's, so they come across; what was added by hand does not.
 */
export const playTracks = (
  state: ILibraryPlayerState,
  trackIds: readonly string[],
  startTrackId: string,
): ILibraryPlayerState => {
  const built = buildQueue(
    uniqueTrackIds(trackIds),
    startTrackId,
    state.queue?.isShuffled ?? false,
  );
  const queue = state.queue ? { ...built, repeat: state.queue.repeat } : built;
  const { restore: _restore, failedTrackId: _failed, ...rest } = state;
  return {
    ...rest,
    queue,
    addedIds: state.addedIds.size === 0 ? state.addedIds : new Set(),
    isPlaying: currentTrackId(queue) !== undefined,
  };
};

/** Play or pause; nothing to do with nothing queued or a song that failed. */
export const setPlaying = (
  state: ILibraryPlayerState,
  isPlaying: boolean,
): ILibraryPlayerState => {
  const playing = playingTrackId(state);
  if (
    state.isPlaying === isPlaying ||
    (isPlaying && (playing === undefined || state.failedTrackId === playing))
  ) {
    return state;
  }
  return { ...state, isPlaying };
};

/**
 * Next, or Previous. Previous inside the first ten seconds changes track;
 * past them it restarts, which is the caller's to do because it touches the
 * deck rather than the list (`PREVIOUS_RESTART_THRESHOLD_MS`).
 */
export const skip = (
  state: ILibraryPlayerState,
  direction: 1 | -1,
): ILibraryPlayerState =>
  state.queue
    ? withQueue(
        state,
        settleGuesses(advanceQueue(state.queue, direction), isGuessIn(state)),
      )
    : state;

/**
 * Straight to a track already in the queue, without rebuilding it — a
 * rebuild while shuffle is on would shuffle everything after it again.
 */
export const jumpTo = (
  state: ILibraryPlayerState,
  position: number,
): ILibraryPlayerState => {
  const { queue } = state;
  if (!queue || position < 0 || position >= queue.order.length) {
    return state;
  }
  return withQueue(
    state,
    settleGuesses({ ...queue, position }, isGuessIn(state)),
  );
};

/**
 * The song that just finished. Repeat one restarts it in place, on the deck
 * making the sound — that early answer is the ONLY thing implementing that
 * mode; `advanceQueue` used to hold position for it as well, which broke the
 * skip buttons. Everything else advances, and reaching the last song with
 * repeat off stops rather than replaying what just finished.
 */
export const trackEnded = (
  state: ILibraryPlayerState,
): { state: ILibraryPlayerState; restart: boolean } => {
  const { queue } = state;
  if (!queue) {
    return { state, restart: false };
  }
  if (queue.repeat === 'one') {
    return { state, restart: true };
  }
  const wasAtEnd = queueAtEnd(queue);
  const advanced = withQueue(state, advanceQueue(queue, 1));
  return {
    state:
      wasAtEnd && queue.repeat === 'off'
        ? { ...advanced, isPlaying: false }
        : advanced,
    restart: false,
  };
};

/**
 * The overlap is due: the next song comes in now, fading over the one still
 * playing, while there is still music to overlap with.
 */
export const crossfadeDue = (
  state: ILibraryPlayerState,
): ILibraryPlayerState =>
  state.queue ? withQueue(state, advanceQueue(state.queue, 1)) : state;

/** The deck has the restored song cued; the place it was cued at is spent. */
export const restoreCued = (
  state: ILibraryPlayerState,
  trackId: string,
): ILibraryPlayerState => {
  if (state.restore?.trackId !== trackId) {
    return state;
  }
  const { restore: _restore, ...rest } = state;
  return rest;
};

/** A song no deck can play: it stops, and says so, rather than sit silent. */
export const trackFailed = (
  state: ILibraryPlayerState,
  trackId: string,
): ILibraryPlayerState =>
  playingTrackId(state) === trackId
    ? { ...state, failedTrackId: trackId, isPlaying: false }
    : state;

/**
 * Whether continuation should draw now: switched on, repeat off, and the
 * last song of the list playing (Ivan, 2026-10-25: "only when a song reaches
 * its last position it shows more similar things"). It drew with three songs
 * still to come, so a short playlist carried ten strangers under it from its
 * first song.
 *
 * NOT A TIMER, and it must never become one: the condition is where the
 * playhead stands, which changes exactly when the queue does.
 */
export const wantsContinuation = (state: ILibraryPlayerState): boolean =>
  state.isContinuationOn &&
  state.queue !== undefined &&
  state.queue.repeat === 'off' &&
  isOnLastSong(state.queue);

/** Whether a natural overlap may start at all, before the clock is asked. */
export const mayCrossfadeOut = (state: ILibraryPlayerState): boolean => {
  const { queue } = state;
  return (
    queue !== undefined &&
    currentTrackId(queue) !== undefined &&
    queue.repeat !== 'one' &&
    (!queueAtEnd(queue) || queue.repeat === 'all')
  );
};
