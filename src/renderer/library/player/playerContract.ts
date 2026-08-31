/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the library player promises its consumers, and the constants that shape
 * how it behaves.
 *
 * Split out of `LibraryPlayerContext` because the contract is read far more
 * often than the machinery behind it: every bar, menu and test that drives
 * playback imports this and none of them care how a deck is cued. It is also
 * the half that can be read without holding the whole transport in your head.
 */
import { ILibraryQueue, TLibraryRepeat } from '../../../common/library/queue';
import { ILibraryTrack } from '../../../common/library/types';

export const REPEAT_CYCLE: readonly TLibraryRepeat[] = ['off', 'all', 'one'];

export const nextRepeat = (repeat: TLibraryRepeat): TLibraryRepeat =>
  REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(repeat) + 1) % REPEAT_CYCLE.length];

export const clampVolume = (value: number): number =>
  Math.min(1, Math.max(0, value));

export const normalizationChanged = (
  previous: ILibraryTrack['normalization'],
  next: NonNullable<ILibraryTrack['normalization']>,
): boolean =>
  !previous ||
  previous.version !== next.version ||
  Math.abs(previous.truePeakDbtp - next.truePeakDbtp) >= 0.01 ||
  Math.abs(previous.integratedLufs - next.integratedLufs) >= 0.01 ||
  previous.edges?.leadInMs !== next.edges?.leadInMs ||
  previous.edges?.endMs !== next.edges?.endMs;

/**
 * How much leading silence is worth a seek.
 *
 * Below this the jump costs a decoder re-sync for something nobody could hear
 * missing, and the incoming deck is better off simply starting at the file's
 * first sample.
 */
export const MIN_LEAD_IN_TRIM_MS = 250;

/**
 * How long the level takes to come back after a seek.
 *
 * Long enough to cover the decoder's re-sync and short enough that nobody
 * reads it as a fade — about four frames. Ramped on `requestAnimationFrame`
 * rather than a timer: a timer would keep the renderer awake on a schedule of
 * its own, and this has to run in step with what is already being painted.
 */
export const SEEK_FADE_MS = 70;
/** Pop-free source handoff; longer than a seek because the decoder is new. */
export const TRACK_FADE_IN_MS = 80;
/** Past this point Previous restarts first; inside it, Previous changes track. */
export const PREVIOUS_RESTART_THRESHOLD_MS = 10_000;

export interface ILibraryPlayerContextValue {
  queue: ILibraryQueue | undefined;
  track: ILibraryTrack | undefined;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  isShuffled: boolean;
  repeat: TLibraryRepeat;
  /**
   * Set while the current track is a video — `LibraryVideoStage` reads this
   * to decide what its own `<video>` should show, instead of this context
   * ever pointing the hidden `Audio()` at it. That split is what keeps video
   * and audio from ever sounding at once.
   */
  videoTrackId: string | undefined;
  /** True once a track Chromium has no demuxer for (`isPlayable === false`,
   * see `isLibraryPlayable`) is asked to play. Nothing is ever handed to a
   * media element in this state — there is no `error` event to swallow,
   * because nothing was ever attempted. */
  isUnplayable: boolean;
  /** The queue is whatever list the caller was looking at — a double click
   * inside an album hands the album's own track ids, a filtered search hands
   * the filtered list. */
  playTracks: (trackIds: readonly string[], startTrackId: string) => void;
  /**
   * Clears the queue entirely — the one control that always ends playback
   * and returns the Library tab to browsing, wherever it currently is.
   * Setting `queue` to `undefined` drops `trackId`/`track`/`videoTrackId`
   * together in the same render, so `LibraryVideoStage` unmounts (its own
   * cleanup pauses and releases the `<video>`, see `registerVideoElement`)
   * and every browse view's `!videoTrackId` gate opens back up — the escape
   * hatch a video queue with no next track otherwise has none of.
   */
  stop: () => void;
  toggle: () => void;
  /**
   * Re-aims what plays next at a new list, without touching what is playing.
   *
   * The queue used to be whatever was on screen when Play was pressed, and it
   * stayed that list however the reader browsed afterwards. That reads as
   * stale rather than as stable: the same files group differently on every
   * shelf — an album is what the tags say, a folder is what the disk says,
   * and neither is what the Songs list shows — so the honest answer to "what
   * is next" is whatever is being looked at.
   *
   * The current track keeps playing and keeps its place in the new list. If
   * it is not in that list at all — a search that excludes it, a shelf it
   * does not appear on — the queue is left exactly as it was, because the
   * alternative is stranding somebody mid-song with nothing after it.
   */
  retargetQueue: (trackIds: readonly string[]) => void;
  /**
   * WHAT THE LISTENER PUT THERE, AND NOTHING ELSE.
   *
   * Not the rest of the album, not the rest of the shelf — those are the
   * context the queue is playing through, and a panel that listed them would
   * be a copy of the view already on screen. This is only what was added by
   * hand, still ahead of the playhead, in the order it will arrive. It
   * empties itself as it is played.
   */
  upNext: readonly {
    position: number;
    trackId: string;
    isAdded: boolean;
    /** Drawn by continuation once the shelf ran short — see
     * `isContinuationOn`. Neither a pick nor the rest of the record. */
    isContinued: boolean;
  }[];
  /**
   * Whether the player keeps going once the queue runs out, with more of the
   * playing track's genre drawn from the whole library.
   *
   * On unless it has been turned off. A player that stops dead at the end of
   * a record is the surprising one; the toggle lives in the Up Next panel,
   * beside the list it changes, so what it does is visible from where it is
   * pressed rather than buried in a settings page.
   */
  isContinuationOn: boolean;
  setIsContinuationOn: (next: boolean) => void;
  /**
   * Straight to a track already in the queue, without rebuilding it.
   *
   * `playTracks` would do the job but at a price: it builds a new queue, and
   * a queue built while shuffle is on gets a NEW shuffle, so jumping to the
   * fourth song in Up Next would reorder everything after it. This only moves
   * `position`; the loader effect sees a new `trackId` and starts it.
   */
  jumpToQueuePosition: (position: number) => void;
  /**
   * Puts a list at the end of what is already queued, without disturbing what
   * is playing.
   *
   * With nothing playing it starts the list instead, because "add to up next"
   * on an empty player means the same thing as pressing play and there is no
   * sense in a queue nobody is listening to. Tracks already queued are left
   * where they are rather than duplicated.
   */
  appendToQueue: (trackIds: readonly string[]) => void;
  /** Takes one entry back out of what is queued ahead, by its place in the
   * run — the same song can be in the list more than once. */
  removeUpNextAt: (position: number) => void;
  /**
   * Moves one queued entry to sit at another's place. Refuses to move
   * anything to or past the playhead: this list is what happens NEXT, and
   * dropping something behind the current track would drop it into the past.
   */
  moveUpNext: (from: number, to: number) => void;
  skip: (direction: 1 | -1) => void;
  seek: (positionMs: number) => void;
  setShuffle: (isShuffled: boolean) => void;
  cycleRepeat: () => void;
  /** Audible at once. Does not persist — see `commitVolume`. */
  setVolume: (value: number) => void;
  /**
   * Persist wherever the fader was left, at the end of a gesture.
   *
   * Separate from `setVolume` so dragging stays smooth: the sound follows the
   * pointer on every change, while the synchronous `localStorage` write
   * happens once, on release.
   */
  commitVolume: () => void;
  /**
   * `LibraryVideoStage`'s own registration hook: hand it the `<video>` it
   * just mounted and get back the cleanup that un-registers it. While
   * registered, `toggle`/`seek`/volume commands reach that element instead of
   * the hidden `Audio()` — see `videoTrackId`.
   */
  registerVideoElement: (element: HTMLVideoElement | null) => () => void;
}
