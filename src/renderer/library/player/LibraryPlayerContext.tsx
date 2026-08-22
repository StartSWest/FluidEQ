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

/**
 * The thing that actually makes sound, held above the tab switch.
 *
 * The audio element is built with `new Audio()` in a ref, never rendered as
 * JSX. `LibraryWorkspace` — and everything under it — is hidden rather than
 * unmounted while another tab is open (see `App.tsx`'s comment above
 * `hasOpenedLibrary`), but a *rendered* `<audio>` would still be at the mercy
 * of React reconciling this component's tree: a key change, a conditional
 * branch taken differently, anything that makes React decide to tear down
 * and rebuild the element silently stops the music. An object living only in
 * a ref has no such risk — nothing about it is wired to the DOM at all.
 *
 * Deliberately NOT wired to `mediaKeys.ts` / `TitlebarMediaTransport`. That
 * transport presses a Windows virtual key for whatever application is
 * currently playing system-wide and is told nothing back — see its own doc
 * comment. Routing this player's transport into it as well would make one
 * press of Play/Pause act on two players when only one was asked for, and
 * `sendMediaTransportKey` has no way to target this one specifically. The two
 * transports stay independent on purpose.
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  advanceQueue,
  buildQueue,
  currentTrackId,
  ILibraryQueue,
  queueAtEnd,
  setShuffle as setQueueShuffle,
  TLibraryRepeat,
} from '../../../common/library/queue';
import { libraryMediaUrl } from '../../../common/library/mediaUrl';
import {
  claimPlayback,
  registerPlayer,
  releasePlayback,
} from '../../audio/playbackOwner';
import {
  clearTransportSource,
  setTransportSource,
} from '../../audio/transportSource';
import { ILibraryTrack } from '../../../common/library/types';
import { useLibrary } from '../LibraryContext';
import {
  readPlaybackMemory,
  restorablePositionMs,
  writePlaybackMemory,
} from './playbackMemory';

const REPEAT_CYCLE: readonly TLibraryRepeat[] = ['off', 'all', 'one'];

const nextRepeat = (repeat: TLibraryRepeat): TLibraryRepeat =>
  REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(repeat) + 1) % REPEAT_CYCLE.length];

/** Where every session's volume slider starts — the loudest a fresh
 * `HTMLAudioElement` already opens at, so this changes nothing until someone
 * touches the slider. */
const DEFAULT_VOLUME = 1;

const clampVolume = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * How long the level takes to come back after a seek.
 *
 * Long enough to cover the decoder's re-sync and short enough that nobody
 * reads it as a fade — about four frames. Ramped on `requestAnimationFrame`
 * rather than a timer: a timer would keep the renderer awake on a schedule of
 * its own, and this has to run in step with what is already being painted.
 */
const SEEK_FADE_MS = 70;

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
  }[];
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
  setVolume: (value: number) => void;
  /**
   * `LibraryVideoStage`'s own registration hook: hand it the `<video>` it
   * just mounted and get back the cleanup that un-registers it. While
   * registered, `toggle`/`seek`/volume commands reach that element instead of
   * the hidden `Audio()` — see `videoTrackId`.
   */
  registerVideoElement: (element: HTMLVideoElement | null) => () => void;
}

const LibraryPlayerContext = createContext<
  ILibraryPlayerContextValue | undefined
>(undefined);

export const LibraryPlayerProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  // Track metadata comes from the library index — the queue itself (Task 18)
  // only ever carries ids. `LibraryPlayerProvider` has to sit inside
  // `LibraryProvider` for this lookup to resolve, which `App.tsx` already
  // arranges the same way it nests every other library-scoped provider.
  const { index } = useLibrary();
  const trackById = useMemo(
    () => new Map(index.tracks.map((t) => [t.id, t])),
    [index.tracks],
  );

  // Created once, lazily, and never rendered — see the module doc comment.
  const audioElementRef = useRef<HTMLAudioElement | undefined>(undefined);
  if (!audioElementRef.current) {
    audioElementRef.current = new Audio();
    audioElementRef.current.volume = DEFAULT_VOLUME;
  }
  // Non-null while `LibraryVideoStage` has a `<video>` registered — the
  // element every transport command reaches instead, for exactly as long as
  // the current track is a video.
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  /** Set once `fadeIn` below exists. The `seeked` listener is bound for the
   * life of the element and reaches it through here rather than closing over
   * a function declared further down. */
  const fadeInRef = useRef<((element: HTMLMediaElement) => void) | undefined>(
    undefined,
  );

  // Silence the element if this provider ever goes away.
  //
  // It is a bare `new Audio()` in a ref, deliberately never rendered, which
  // means React tears down nothing for it: unmount the provider and the sound
  // simply carries on, reachable by nothing, until the window closes. Mount a
  // second provider — which a hot reload does on every save — and its own
  // fresh element starts a second song over the top of the orphan. Two tracks
  // at once, and no control on screen governs either.
  //
  // `hasOpenedLibrary` in `App.tsx` is one-way, so this should not fire in a
  // packaged build; it fires constantly in development, which is where the
  // overlap was found.
  useEffect(() => {
    const audio = audioElementRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    };
  }, []);

  const [queue, setQueue] = useState<ILibraryQueue | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  const [isUnplayable, setIsUnplayable] = useState(false);

  // The `ended` handler is attached once per media element and must never go
  // stale, so it reads the queue through a ref rather than closing over the
  // `queue` state directly.
  const queueRef = useRef<ILibraryQueue | undefined>(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  /**
   * Where the last session left off, waiting for the element to be ready for
   * it.
   *
   * Applied on `loadedmetadata`, never at load time — assigning a position
   * while the element is still at `HAVE_NOTHING` is exactly what emptied the
   * seekable range and broke seeking for the whole of that load; see the
   * loader's own comment. Cleared as soon as it is used, so it can only ever
   * move the playhead once.
   */
  const pendingRestore = useRef<
    { trackId: string; positionMs: number } | undefined
  >(undefined);
  /** True until the stored session has been read back. Nothing is written
   * before that, or the first render's empty queue would erase the very
   * thing being restored. */
  const isRestoringRef = useRef(true);

  const volumeRef = useRef(volume);
  useEffect(() => {
    volumeRef.current = volume;
    if (audioElementRef.current) {
      audioElementRef.current.volume = volume;
    }
    if (videoElementRef.current) {
      videoElementRef.current.volume = volume;
    }
  }, [volume]);

  const trackId = queue ? currentTrackId(queue) : undefined;
  const track = trackId ? trackById.get(trackId) : undefined;

  /** The object URL currently backing the element, so it can be revoked when
   * the next track replaces it. A blob URL that is never revoked pins its
   * whole buffer for the life of the window. */
  const blobUrlRef = useRef<string | undefined>(undefined);

  /** The running fade-in, so a second seek arriving mid-ramp cancels the
   * first rather than fighting it for the volume property. */
  const fadeFrameRef = useRef(0);

  const fadeIn = useCallback((element: HTMLMediaElement) => {
    cancelAnimationFrame(fadeFrameRef.current);
    const target = volumeRef.current;
    const started = performance.now();
    const step = () => {
      const progress = Math.min(
        1,
        (performance.now() - started) / SEEK_FADE_MS,
      );
      element.volume = clampVolume(target * progress);
      if (progress < 1) {
        fadeFrameRef.current = requestAnimationFrame(step);
        return;
      }
      // Land exactly on the user's level rather than on whatever the last
      // frame's arithmetic produced.
      element.volume = target;
      fadeFrameRef.current = 0;
    };
    fadeFrameRef.current = requestAnimationFrame(step);
  }, []);
  fadeInRef.current = fadeIn;

  /**
   * Drops the level for a jump, and guarantees it comes back.
   *
   * `seeked` is what normally brings it back — see `bindMediaEvents`. The
   * watchdog here exists because a seek into a range the element cannot serve
   * never fires it, and a player that silently muted itself forever would be
   * a far worse bug than the click this is hiding.
   */
  const startSeekFade = useCallback(
    (element: HTMLMediaElement) => {
      cancelAnimationFrame(fadeFrameRef.current);
      element.volume = 0;
      const deadline = performance.now() + 500;
      const watch = () => {
        if (element.volume > 0 || fadeFrameRef.current === 0) {
          // Something else already restored it, or a fade is under way.
          return;
        }
        if (performance.now() > deadline) {
          fadeIn(element);
          return;
        }
        fadeFrameRef.current = requestAnimationFrame(watch);
      };
      fadeFrameRef.current = requestAnimationFrame(watch);
    },
    [fadeIn],
  );

  /**
   * Undoes the half-finished `loadedmetadata` handler of a swap that has been
   * superseded — see `swapToBlob`, where it is set.
   *
   * A `{ once: true }` listener that never fires is never removed either. The
   * element outlives every track, so an abandoned swap left its handler
   * sitting on it waiting for *somebody's* metadata — and the next track's
   * would do: the new song would load and immediately jump to the previous
   * one's playhead, and start playing if the previous one had been. One
   * stale listener per abandoned swap, and each one wrong.
   */
  const cancelPendingSwap = useRef<(() => void) | undefined>(undefined);

  const releaseBlob = useCallback(() => {
    cancelPendingSwap.current?.();
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = undefined;
    }
  }, []);

  /**
   * Re-points a playing element at the same audio held in memory.
   *
   * Seeking inside a streamed resource makes Chromium abandon the connection,
   * ask for a fresh byte range and re-sync the decoder — heard as a stutter
   * with a moment of the previous passage repeating. Inside a blob there is
   * nothing to re-establish, so a jump is exact and silent. The Karaoke tab
   * has loaded its audio this way from the start, which is why it has always
   * seeked cleanly while this player did not.
   *
   * The stream still starts the track, because waiting for a 10MB read before
   * the first note would trade one visible fault for another. The swap
   * happens underneath, keeps the playhead where it was, and is abandoned if
   * the track changed while the bytes were in flight.
   */
  const swapToBlob = useCallback(
    async (element: HTMLAudioElement, forTrackId: string) => {
      const bytes = window.electron?.ipcRenderer?.libraryTrackBytes;
      if (!bytes) {
        return;
      }
      let buffer: ArrayBuffer | undefined;
      try {
        buffer = await bytes(forTrackId);
      } catch {
        // Main could not read it. The stream is already playing and is fine.
        return;
      }
      // The queue moved on while this was in flight, or main declined it —
      // either way there is nothing to swap to and nothing wrong.
      if (!buffer || trackIdRef.current !== forTrackId) {
        return;
      }
      const wasPlaying = !element.paused;
      const at = element.currentTime;
      releaseBlob();
      blobUrlRef.current = URL.createObjectURL(new Blob([buffer]));
      element.src = blobUrlRef.current;
      // Putting the playhead back is what makes the swap invisible; without
      // it the track would jump to its beginning a second in.
      //
      // Registered so it can be taken off again: `once` removes a listener
      // that fires, and this one has to survive being abandoned — see
      // `cancelPendingSwap`.
      const onSwapped = () => {
        cancelPendingSwap.current = undefined;
        element.currentTime = at;
        if (wasPlaying) {
          element.play().catch(() => undefined);
        }
      };
      element.addEventListener('loadedmetadata', onSwapped, { once: true });
      cancelPendingSwap.current = () => {
        element.removeEventListener('loadedmetadata', onSwapped);
        cancelPendingSwap.current = undefined;
      };
      element.load();
    },
    [releaseBlob],
  );

  /** Read inside `swapToBlob`'s async continuation, where the `trackId` it
   * closed over would be the one from the render that started the read. */
  const trackIdRef = useRef(trackId);
  trackIdRef.current = trackId;

  /**
   * Puts the last session's queue and playhead back, once.
   *
   * Waits for the index, because a queue is a list of ids and every one of
   * them has to still exist — a rescan that dropped the folder must leave
   * the player empty rather than pointing at files that are gone. Runs while
   * `index.tracks` is empty on the very first render and simply does nothing,
   * then again when the index arrives.
   */
  useEffect(() => {
    if (!isRestoringRef.current || index.tracks.length === 0) {
      return;
    }
    isRestoringRef.current = false;
    const memory = readPlaybackMemory();
    if (!memory) {
      return;
    }
    const survivors = memory.trackIds.filter((id) => trackById.has(id));
    if (survivors.length !== memory.trackIds.length) {
      // The library moved under it. Rebuilding a partial queue would silently
      // renumber `order` and put the reader on a different song than the one
      // they left, which is worse than starting empty.
      return;
    }
    const restoreTrackId = memory.trackIds[memory.order[memory.position]];
    const restoreMs = restorablePositionMs(
      memory.positionMs,
      trackById.get(restoreTrackId)?.durationMs,
    );
    if (restoreMs !== undefined) {
      pendingRestore.current = {
        trackId: restoreTrackId,
        positionMs: restoreMs,
      };
      setPositionMs(restoreMs);
    }
    setQueue({
      trackIds: memory.trackIds,
      order: memory.order,
      position: memory.position,
      repeat: memory.repeat,
      isShuffled: memory.isShuffled,
    });
  }, [index.tracks, trackById]);

  /**
   * Records what is playing and how far in.
   *
   * On the queue rather than on `positionMs`, which changes four times a
   * second — the position is read at that moment through a ref, and the
   * `pagehide` listener below catches the far more common case of the window
   * simply going away mid-track.
   */
  const positionRef = useRef(positionMs);
  positionRef.current = positionMs;
  useEffect(() => {
    if (isRestoringRef.current) {
      return;
    }
    writePlaybackMemory(queue, positionRef.current);
  }, [queue]);

  useEffect(() => {
    const save = () => {
      if (!isRestoringRef.current) {
        writePlaybackMemory(queueRef.current, positionRef.current);
      }
    };
    // `pagehide` rather than `beforeunload`: it fires on the reload a hot
    // rebuild triggers as well as on the window closing, and unlike
    // `unload` it is not skipped when the page goes into the back/forward
    // cache.
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('pagehide', save);
      save();
    };
  }, []);
  // Gated on `isPlayable` too: an mkv or avi is `kind === 'video'` exactly
  // like an mp4, but Chromium has no demuxer for it. Without this check
  // `LibraryVideoStage` would still mount a `<video src=...>` for a file it
  // cannot decode — a black box with a broken-media icon on the Library tab
  // — while the bar's own `isUnplayable` message is the only honest answer
  // this case has. Leaving it unset keeps the stage closed and routes
  // nothing anywhere, matching the audio branch below exactly.
  const videoTrackId =
    track?.kind === 'video' && track.isPlayable ? track.id : undefined;

  /** The element every transport command reaches right now. */
  const activeElement = useCallback(
    (): HTMLMediaElement | undefined =>
      videoTrackId
        ? (videoElementRef.current ?? undefined)
        : audioElementRef.current,
    [videoTrackId],
  );

  /**
   * The track that just finished. `repeat: 'one'` restarts it in place — the
   * queue's own `position` never moves for that mode (see `advanceQueue`'s
   * doc comment), so this is the one case that has to act on the element
   * directly rather than letting a `trackId` change trigger a reload.
   * Everything else calls `advanceQueue` and lets that effect take over —
   * stopping at the end with repeat off is `advanceQueue` holding position at
   * the last track combined with the check below, not a separate rule here.
   */
  const handleEnded = useCallback((element: HTMLMediaElement) => {
    const { current } = queueRef;
    if (!current) {
      return;
    }
    if (current.repeat === 'one') {
      element.currentTime = 0;
      element.play().catch(() => undefined);
      return;
    }
    const wasAtEnd = queueAtEnd(current);
    setQueue(advanceQueue(current, 1));
    if (wasAtEnd && current.repeat === 'off') {
      // Nothing queued after it — a player with nothing next just stops,
      // rather than replaying the track that just ended.
      setIsPlaying(false);
    }
  }, []);

  const bindMediaEvents = useCallback(
    (element: HTMLMediaElement): (() => void) => {
      // `timeupdate` fires about four times a second — the right cadence for
      // a number that changes once a second on screen, and no reason to add
      // a `requestAnimationFrame` loop on top of it.
      const onTimeUpdate = () => setPositionMs(element.currentTime * 1000);
      // `seeked` as well, exactly as `useKaraokeSession` does it: the element
      // is the authority on where it actually landed, and `timeupdate` can
      // still report the old position for a tick or two after a seek is
      // asked for. Without this the thumb was dragged, released, and then
      // pulled back by a stale tick before the next one caught up.
      const onSeeked = () => {
        setPositionMs(element.currentTime * 1000);
        // Bring the level back after the jump — see `startSeekFade`. Reached
        // through a ref because this listener is bound once for the life of
        // the element and must not take a dependency on anything defined
        // later in this component.
        fadeInRef.current?.(element);
      };
      // `durationchange` as well as `loadedmetadata`, and it is the one that
      // matters. A resource the element cannot seek in reports its duration
      // as `Infinity` at metadata time — which this correctly refuses, and
      // which left the seek bar disabled with no total length beside it for
      // the whole of a track that was playing perfectly well. The real number
      // arrives later, on `durationchange`, and nothing was listening for it.
      //
      // The underlying cause was the media protocol dropping Range headers
      // (see `libraryProtocol`); this is what stops the same symptom from
      // surviving anything else that makes a first read look unbounded.
      const onDuration = () => {
        // A length is only ever learned, never unlearned.
        //
        // `durationchange` does not only fire once with the answer: it fires
        // again mid-playback, and Chromium reports `Infinity` on some of
        // those. Writing that through as `0` — which is what "not finite, so
        // zero" did — collapsed the bar in the middle of a song, because
        // `NowPlayingBar` clamps its value to `max(1, durationMs)` and its
        // `max` to the same: at zero both become 1 and the thumb jumps to the
        // far left. That is the "it goes back to the start when I try to
        // seek" this was reported as, and the disabled seek bar beside it.
        // The per-track reset belongs to the loader, which sets the tag's own
        // duration when the source changes; nothing here needs to zero it.
        if (Number.isFinite(element.duration) && element.duration > 0) {
          setDurationMs(element.duration * 1000);
        }
        // The one safe moment to put the playhead back where the last session
        // left it: the ranges are known now, so the seek lands instead of
        // being silently dropped.
        const restore = pendingRestore.current;
        if (restore !== undefined) {
          pendingRestore.current = undefined;
          element.currentTime = restore.positionMs / 1000;
          setPositionMs(restore.positionMs);
        }
      };
      // The element is the authority on when sound actually starts, so the
      // claim is made from its own event rather than from the call that asked
      // for it: `play()` is a promise that can be refused, and claiming on the
      // request would have silenced the karaoke tab for a track that never
      // began. See `playbackOwner`.
      const onPlay = () => {
        claimPlayback('library');
        setIsPlaying(true);
      };
      const onPause = () => {
        releasePlayback('library');
        setIsPlaying(false);
      };
      const onEnded = () => handleEnded(element);
      // A track whose file the element cannot actually load — the drive it
      // lives on unplugged after the scan that found it, a permissions
      // error, a 404 from the protocol handler — fires `error`, never
      // `ended`. Nothing before this listener existed answered it: the bar
      // loaded, showed Play, and a click did nothing forever, with no
      // message and no log line. Reuses `isUnplayable`, the same flag and
      // the same "cannot play this format" message the `!track.isPlayable`
      // branch below already shows for a codec Chromium has no demuxer for
      // — from here, a missing file and an undecodable one look the same to
      // the person looking at the bar.
      const onError = () => {
        setIsUnplayable(true);
        setIsPlaying(false);
      };
      element.addEventListener('timeupdate', onTimeUpdate);
      element.addEventListener('seeked', onSeeked);
      element.addEventListener('loadedmetadata', onDuration);
      element.addEventListener('durationchange', onDuration);
      element.addEventListener('play', onPlay);
      element.addEventListener('pause', onPause);
      element.addEventListener('ended', onEnded);
      element.addEventListener('error', onError);
      return () => {
        element.removeEventListener('timeupdate', onTimeUpdate);
        element.removeEventListener('seeked', onSeeked);
        element.removeEventListener('loadedmetadata', onDuration);
        element.removeEventListener('durationchange', onDuration);
        element.removeEventListener('play', onPlay);
        element.removeEventListener('pause', onPause);
        element.removeEventListener('ended', onEnded);
        element.removeEventListener('error', onError);
      };
    },
    [handleEnded],
  );

  // Bound once, for the life of the app — `bindMediaEvents` is stable because
  // `handleEnded` only ever reads the queue through the ref above.
  useEffect(() => {
    const element = audioElementRef.current;
    if (!element) {
      return undefined;
    }
    return bindMediaEvents(element);
  }, [bindMediaEvents]);

  // How the rest of the app silences this player when it takes over. Pausing
  // rather than clearing the queue: the reader gets their album back where
  // they left it when they come back to the tab, which is what "something
  // else started" should cost them and no more.
  useEffect(
    () =>
      registerPlayer('library', () => {
        audioElementRef.current?.pause();
        videoElementRef.current?.pause();
      }),
    [],
  );

  const registerVideoElement = useCallback(
    (element: HTMLVideoElement | null): (() => void) => {
      videoElementRef.current = element;
      if (!element) {
        return () => undefined;
      }
      element.volume = volumeRef.current;
      const unbind = bindMediaEvents(element);
      return () => {
        unbind();
        // `LibraryVideoStage` unmounts the instant `videoTrackId` goes
        // undefined — the queue moved to an audio track, or off the end —
        // and this cleanup is what runs at that exact moment. It has to stop
        // the video itself rather than trust the unmount to: React tears
        // this element out of the DOM, but nothing about removing a node
        // stops whatever it was doing, and the `[trackId]` effect below
        // starts `audio.play()` in the very same commit. `pause()` is
        // synchronous and this cleanup is guaranteed to run before any new
        // effect fires this commit (React runs every destroy function across
        // the tree before any create function), so the two can never
        // overlap. `removeAttribute('src')` on top of `pause()` — matching
        // exactly how the audio element itself is released a few lines
        // down — because a paused-but-loaded video keeps its buffer and its
        // decoder alive; only clearing the source lets both go.
        element.pause();
        element.removeAttribute('src');
        if (videoElementRef.current === element) {
          videoElementRef.current = null;
        }
      };
    },
    [bindMediaEvents],
  );

  // Loads whatever `trackId` now points at. Keyed on the id alone: a rescan
  // refreshing this same track's tags must not restart whatever is already
  // playing, which is exactly what would happen if `track`/`trackById` were
  // dependencies too.
  useEffect(() => {
    const audio = audioElementRef.current;
    if (!audio) {
      return;
    }
    audio.pause();
    releaseBlob();
    if (!trackId || !track) {
      audio.removeAttribute('src');
      setIsUnplayable(false);
      setDurationMs(0);
      setPositionMs(0);
      return;
    }
    // The tag's own duration first, so the bar shows a real number before the
    // element has read the file — overwritten by `loadedmetadata` once it has.
    setDurationMs(track.durationMs ?? 0);
    setPositionMs(0);
    if (!track.isPlayable) {
      audio.removeAttribute('src');
      setIsUnplayable(true);
      setIsPlaying(false);
      return;
    }
    setIsUnplayable(false);
    if (track.kind === 'video') {
      // Handed to `LibraryVideoStage` instead — never fed to the hidden
      // element, so the two can never sound at once.
      audio.removeAttribute('src');
      setIsPlaying(true);
      return;
    }
    // The streaming URL first, so sound starts immediately, then the same
    // file again as a blob once main has handed the bytes over — see
    // `swapToBlob` for why the second one is worth the first one's trouble.
    audio.src = libraryMediaUrl('track', track.id);
    // No `audio.currentTime = 0` here, and this is not tidiness: assigning a
    // position on the same tick as the source is what made seeking
    // impossible for the whole life of that load.
    //
    // Measured in the running window, three elements against one file:
    //
    //   src, currentTime = 0, play()  ->  seekable.end = 0,      seek to 100s lands at 0.87
    //   src, play()                   ->  seekable.end = 168.88, seek to 100s lands at 100.91
    //   src, preload = "metadata"     ->  seekable.end = 168.88, seek to 100s lands at 100
    //
    // The element is at `HAVE_NOTHING` when the assignment lands, so the seek
    // is recorded against a resource whose ranges are not known yet, and the
    // seekable range comes back empty and stays empty — every later
    // `currentTime` is then silently refused, which is exactly what the seek
    // bar snapping back to nothing looked like. A freshly assigned `src`
    // already starts at zero, so the line bought nothing to begin with.
    //
    // A restored session loads but does not play. Coming back to the app and
    // having it start making noise on its own is the wrong side of the line
    // between "where you were" and "what you asked for"; the track is cued
    // with the playhead where it was and waits for Play.
    //
    // Matched against this track's own id, and cleared otherwise. Held as a
    // bare position it survived the restore it was for and then suppressed
    // `play()` for every track chosen afterwards — a click on a song loaded
    // it, left it silent, and left the seek bar disabled because nothing was
    // ever fetched to read a duration from.
    if (pendingRestore.current?.trackId === track.id) {
      // Without a `play()` there is nothing to make the element fetch, and
      // `loadedmetadata` — where the restored position is applied — would
      // never fire.
      audio.preload = 'metadata';
      audio.load();
      setIsPlaying(false);
      return;
    }
    pendingRestore.current = undefined;
    audio.preload = 'auto';
    audio.play().catch(() => undefined);
    // Deliberately not awaited: the stream is already playing, and this only
    // improves how the next seek feels. It never rejects — see its own body.
    swapToBlob(audio, track.id).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberate, see the comment above this effect.
  }, [trackId]);

  /**
   * Catches the one case the effect above cannot: `trackId` staying exactly
   * where it is while `track` disappears from under it — `library-root-remove`
   * (`ipc/library.ts`) deletes a root's tracks outright, so `trackById.get(trackId)`
   * starts returning `undefined` with no change to the queue that would
   * re-run the loader effect. Left alone, the hidden `Audio()` keeps whatever
   * `src` it already had — playing, with no bar and no controls, reachable
   * only by quitting.
   *
   * Deliberately its own effect, keyed on the transition into "track missing"
   * rather than on `track` itself: adding `track` to the effect above was
   * rejected on purpose (its own comment explains why — a rescan refreshing
   * this same track's tags must not restart what is already playing), and
   * `[track === undefined]` only fires on the one edge that actually matters
   * instead of on every `trackById` update a rescan produces.
   */
  useEffect(() => {
    const audio = audioElementRef.current;
    if (!audio || !trackId || track) {
      return;
    }
    audio.pause();
    audio.removeAttribute('src');
    setIsPlaying(false);
    setIsUnplayable(false);
    setDurationMs(0);
    setPositionMs(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the missing-track transition only; see the comment above.
  }, [track === undefined]);

  const stop = useCallback(() => {
    setQueue(undefined);
  }, []);

  const playTracks = useCallback(
    (trackIds: readonly string[], startTrackId: string) => {
      // PLAY REPLACES. Pressing play on a record is choosing what to listen
      // to now, and the list built by hand for what came before it does not
      // survive that — it was a list of what to play next, and "next" has
      // just been answered by something else. Add to up next is the half that
      // keeps a list; this is the half that starts one.
      setAddedIds((current) => (current.size === 0 ? current : new Set()));
      setQueue((current) => {
        const next = buildQueue(
          [...trackIds],
          startTrackId,
          current?.isShuffled ?? false,
        );
        // Shuffle and repeat are player preferences, not properties of one
        // list — picking a new album should not silently turn Repeat off.
        return current ? { ...next, repeat: current.repeat } : next;
      });

      // ASKING FOR THE TRACK THAT IS ALREADY CUED IS STILL ASKING FOR IT.
      //
      // Everything that starts sound hangs off the loader effect, and that
      // effect is keyed on `trackId` CHANGING — deliberately, so a rescan
      // refreshing this track's tags cannot restart it. The cost is the case
      // where the queue is already sitting on the very track being asked for,
      // and then a press did nothing at all:
      //
      //   - after a restart, where the session is restored cued and paused
      //     with no source fetched (see `pendingRestore` in that effect), so
      //     the album's Play looked broken while the bar's Play worked;
      //   - after Stop, where the same album is chosen again.
      //
      // Only the audio element is given a source here. A video belongs to
      // `LibraryVideoStage`, which loads it itself — see `videoTrackId`.
      const cued = queueRef.current
        ? currentTrackId(queueRef.current)
        : undefined;
      if (cued !== startTrackId) {
        return;
      }
      const element = activeElement();
      if (!element) {
        return;
      }
      pendingRestore.current = undefined;
      if (element === audioElementRef.current && !element.getAttribute('src')) {
        element.preload = 'auto';
        element.src = libraryMediaUrl('track', startTrackId);
      }
      element.play().catch(() => undefined);
    },
    [activeElement],
  );

  const toggle = useCallback(() => {
    const element = activeElement();
    if (!element) {
      return;
    }
    if (element.paused) {
      element.play().catch(() => undefined);
    } else {
      element.pause();
    }
  }, [activeElement]);

  /**
   * The list Next walks, swapped under a playing track. See the interface for
   * why the queue follows the view rather than the press that started it.
   *
   * Nothing here reaches the media element, and that is the point: `trackId`
   * comes out the same, so the loader effect — keyed on that id alone — does
   * not run, and the audio carries on through the swap without a gap. Shuffle
   * and repeat are the listener's settings rather than the list's, so they
   * come across too.
   */
  const retargetQueue = useCallback((trackIds: readonly string[]) => {
    setQueue((current) => {
      if (!current) {
        return current;
      }
      const playing = currentTrackId(current);
      if (playing === undefined || !trackIds.includes(playing)) {
        return current;
      }
      // WHAT WAS ADDED BY HAND SURVIVES THE SWAP, IN ITS OWN ORDER.
      //
      // The context changes whenever the reader changes shelf or sorts one —
      // that is the point of re-aiming. A list they built themselves is not
      // part of that context: losing it because they looked elsewhere would
      // be the worst kind of quiet, and re-sorting it along with the shelf is
      // very nearly as bad. Sorting Songs by title used to scatter the picks
      // into alphabetical order among fifty thousand rows, because a pick
      // that also appears in the new list was simply absorbed by it.
      //
      // So they are lifted out first and put back at the front, and the list
      // underneath is built WITHOUT them so nothing is drawn twice.
      const pending = current.order
        .slice(current.position + 1)
        .map((index) => current.trackIds[index])
        .filter(
          (id): id is string => id !== undefined && addedIdsRef.current.has(id),
        );
      const pendingSet = new Set(pending);
      const context = trackIds.filter(
        (id) => id === playing || !pendingSet.has(id),
      );
      // A SHUFFLED QUEUE IS NOT RE-AIMED BY A LIST OF THE SAME SONGS.
      //
      // `buildQueue` draws a FRESH random order every time it is asked for a
      // shuffled one, and this callback runs on every track change — so with
      // shuffle on, an album re-aimed at itself came back re-shuffled and the
      // playhead landed somewhere new in the new order each time. Up Next then
      // reported a different length on every pass of the same seven songs —
      // six, then one, then four, then none — which looks exactly like
      // something firing on a timer, and was reported as one.
      //
      // Order is what re-aiming is FOR when nothing is shuffled: sorting the
      // shelf by title should reorder what plays next. Under shuffle the
      // shelf's order is deliberately not the queue's, so membership is the
      // only thing that can mean anything — same songs, same queue, whatever
      // order they arrive in. Compared against the context rather than the
      // whole queue, because the picks are not part of what is being re-aimed.
      if (current.isShuffled) {
        const held = new Set(
          current.trackIds.filter((id) => !pendingSet.has(id)),
        );
        const arriving = new Set(context);
        if (
          held.size === arriving.size &&
          [...arriving].every((id) => held.has(id))
        ) {
          return current;
        }
      }
      const base = buildQueue([...context], playing, current.isShuffled);
      const next =
        pending.length === 0
          ? base
          : {
              ...base,
              trackIds: [...base.trackIds, ...pending],
              order: (() => {
                const order = [...base.order];
                order.splice(
                  base.position + 1,
                  0,
                  ...pending.map((_, index) => base.trackIds.length + index),
                );
                return order;
              })(),
            };
      if (
        next.trackIds.length === current.trackIds.length &&
        next.trackIds.every((id, index) => id === current.trackIds[index]) &&
        next.order.length === current.order.length &&
        next.order.every((value, index) => value === current.order[index])
      ) {
        // The same list arriving again — a re-render of the view rather than a
        // change of it. Returning the existing object keeps every consumer of
        // this context from re-rendering for nothing.
        return current;
      }
      return { ...next, repeat: current.repeat };
    });
  }, []);

  /**
   * The ids the listener added by hand, ever.
   *
   * Kept beside the queue rather than inside it because the queue's job is
   * unchanged — it is still one run of tracks with a position in it, and the
   * added ones are spliced into that run so everything downstream (advance,
   * repeat, shuffle, the loader) needs to know nothing about where a track
   * came from. This set is only what tells the panel which of them to draw.
   */
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Read by `retargetQueue`, which runs from a callback with no dependencies
  // — it must see the set as it is when the view changes, not as it was when
  // that callback was made.
  const addedIdsRef = useRef(addedIds);
  addedIdsRef.current = addedIds;

  /**
   * Everything still ahead of the playhead, in the order it arrives.
   *
   * What was added by hand sits at the front of it — `appendToQueue` splices
   * those in right after the current track — and the rest of the album, the
   * folder or the shelf follows. A list that showed ONLY hand-picked entries
   * was empty for the ordinary case of pressing play on a record and reading
   * as broken; a list that shows what is genuinely coming answers the
   * question either way.
   */
  const upNext = useMemo(() => {
    if (!queue) {
      return [];
    }
    return queue.order
      .slice(queue.position + 1)
      .map((trackIndex, offset) => {
        const trackId = queue.trackIds[trackIndex];
        return {
          position: queue.position + 1 + offset,
          trackId,
          // Which half of the list this belongs to: a decision the listener
          // made, or the record they happen to be playing through. The panel
          // draws the two under headings of their own — the whole point of
          // showing both is being able to tell them apart.
          isAdded: trackId !== undefined && addedIds.has(trackId),
        };
      })
      .filter(
        (
          entry,
        ): entry is { position: number; trackId: string; isAdded: boolean } =>
          entry.trackId !== undefined,
      );
  }, [addedIds, queue]);

  const jumpToQueuePosition = useCallback((position: number) => {
    setQueue((current) =>
      !current || position < 0 || position >= current.order.length
        ? current
        : { ...current, position },
    );
  }, []);

  const appendToQueue = useCallback(
    (trackIds: readonly string[]) => {
      const [first] = trackIds;
      if (first === undefined) {
        return;
      }
      if (!queueRef.current) {
        playTracks(trackIds, first);
        return;
      }
      setAddedIds((current) => {
        const next = new Set(current);
        trackIds.forEach((id) => next.add(id));
        return next;
      });
      setQueue((current) => {
        if (!current) {
          return current;
        }
        // PROMOTED, NOT COPIED.
        //
        // Pressing play on a record makes it the context, so the whole thing
        // is already sitting ahead of the playhead under "then". Choosing
        // "add to up next" on that same record afterwards used to append a
        // second copy of every track, and the panel then listed the album
        // twice — once as what happens to be coming, once as a decision.
        //
        // It is one decision. A track already queued ahead is MOVED into the
        // picks run rather than duplicated; only a track that is not there at
        // all is a genuinely new entry. Do the same on a second album and both
        // sit in the picks, in the order they were chosen, which is what
        // building a list for the evening actually looks like.
        //
        // AFTER WHAT WAS PICKED BEFORE THEM, never on top of it: the run of
        // hand-picked entries following the playhead is where these join, and
        // the playhead itself when there is no such run yet. `addedIdsRef` is
        // read rather than the set being written above, because that write
        // has not landed and the end of the OLD run is the insertion point.
        const nextTrackIds = [...current.trackIds];
        const order = [...current.order];
        let insertAt = current.position + 1;
        while (insertAt < order.length) {
          const id = nextTrackIds[order[insertAt] ?? -1];
          if (id === undefined || !addedIdsRef.current.has(id)) {
            break;
          }
          insertAt += 1;
        }
        const moved = trackIds.map((id) => {
          // An occurrence beyond the picks run — the context copy. Anything
          // inside the run is already a pick and is left where it stands.
          const at = order.findIndex(
            (trackIndex, position) =>
              position >= insertAt && nextTrackIds[trackIndex] === id,
          );
          if (at !== -1) {
            const [entry] = order.splice(at, 1);
            return entry ?? -1;
          }
          nextTrackIds.push(id);
          return nextTrackIds.length - 1;
        });
        order.splice(insertAt, 0, ...moved.filter((entry) => entry >= 0));
        return { ...current, trackIds: nextTrackIds, order };
      });
    },
    [playTracks],
  );

  /**
   * Out of the run, by place rather than by name.
   *
   * `order` alone is edited and `trackIds` is left as it is: the same song
   * can sit in this list several times, so the id says nothing about WHICH
   * entry was meant, and an unreferenced id costs a string.
   */
  const removeUpNextAt = useCallback((position: number) => {
    setQueue((current) => {
      if (
        !current ||
        position <= current.position ||
        position >= current.order.length
      ) {
        return current;
      }
      const order = [...current.order];
      order.splice(position, 1);
      return { ...current, order };
    });
  }, []);

  const moveUpNext = useCallback((from: number, to: number) => {
    setQueue((current) => {
      if (
        !current ||
        from <= current.position ||
        from >= current.order.length ||
        from === to
      ) {
        return current;
      }
      const order = [...current.order];
      const [moved] = order.splice(from, 1);
      if (moved === undefined) {
        return current;
      }
      // After the splice everything past `from` has shifted down one, so a
      // target that was below it is now one place nearer.
      const shifted = to > from ? to - 1 : to;
      order.splice(
        Math.min(Math.max(current.position + 1, shifted), order.length),
        0,
        moved,
      );
      return { ...current, order };
    });
  }, []);

  const skip = useCallback((direction: 1 | -1) => {
    setQueue((current) =>
      current ? advanceQueue(current, direction) : current,
    );
  }, []);

  const seek = useCallback(
    (nextPositionMs: number) => {
      const element = activeElement();
      const clamped = Math.max(0, nextPositionMs);
      if (!element) {
        setPositionMs(clamped);
        return;
      }
      // Silence first, then jump. Landing mid-frame makes the decoder
      // re-sync, and what that sounds like is a click or a scrap of the
      // passage just left — audible however cleanly the bytes arrive,
      // because it is the decoder catching up rather than the data being
      // late. Cutting the level for the length of the jump and bringing it
      // back over a few frames hides the seam without touching the audio.
      startSeekFade(element);
      element.currentTime = clamped / 1000;
      // Read back rather than trusting the request, the way
      // `useKaraokeSession.seek` does: the element clamps to its own seekable
      // range and can refuse outright, and a bar showing a position the audio
      // never went to is worse than one that admits it did not move.
      setPositionMs(element.currentTime * 1000);
    },
    [activeElement, startSeekFade],
  );

  const setShuffle = useCallback((isShuffled: boolean) => {
    setQueue((current) =>
      current ? setQueueShuffle(current, isShuffled) : current,
    );
  }, []);

  const cycleRepeat = useCallback(() => {
    setQueue((current) =>
      current ? { ...current, repeat: nextRepeat(current.repeat) } : current,
    );
  }, []);

  const setVolume = useCallback((value: number) => {
    setVolumeState(clampVolume(value));
  }, []);

  /**
   * The library's claim on the bar at the foot of the window.
   *
   * Published in the same register as karaoke's and the Media tab's, so one
   * rule can decide between them — see `pickTransportOwner`. What the library
   * gets when it wins is not this: `NowPlayingBar` draws it from this context
   * directly, because the library has cover art, a format readout, shuffle and
   * repeat, and none of those fit a shape the other two could honestly fill in.
   */
  useEffect(() => {
    if (!track) {
      clearTransportSource('library');
      return;
    }
    setTransportSource({
      owner: 'library',
      title: track.title,
      subtitle: track.artist,
      isPlaying,
      positionMs,
      durationMs,
      toggle,
      seek,
      volume,
      setVolume,
    });
  }, [
    track,
    isPlaying,
    positionMs,
    durationMs,
    toggle,
    seek,
    volume,
    setVolume,
  ]);

  useEffect(() => () => clearTransportSource('library'), []);

  const value = useMemo<ILibraryPlayerContextValue>(
    () => ({
      queue,
      track,
      isPlaying,
      positionMs,
      durationMs,
      volume,
      isShuffled: queue?.isShuffled ?? false,
      repeat: queue?.repeat ?? 'off',
      videoTrackId,
      isUnplayable,
      playTracks,
      stop,
      toggle,
      retargetQueue,
      upNext,
      jumpToQueuePosition,
      appendToQueue,
      removeUpNextAt,
      moveUpNext,
      skip,
      seek,
      setShuffle,
      cycleRepeat,
      setVolume,
      registerVideoElement,
    }),
    [
      queue,
      track,
      isPlaying,
      positionMs,
      durationMs,
      volume,
      videoTrackId,
      isUnplayable,
      playTracks,
      stop,
      toggle,
      retargetQueue,
      upNext,
      jumpToQueuePosition,
      appendToQueue,
      removeUpNextAt,
      moveUpNext,
      skip,
      seek,
      setShuffle,
      cycleRepeat,
      setVolume,
      registerVideoElement,
    ],
  );

  return (
    <LibraryPlayerContext.Provider value={value}>
      {children}
    </LibraryPlayerContext.Provider>
  );
};

export const useLibraryPlayer = (): ILibraryPlayerContextValue => {
  const context = useContext(LibraryPlayerContext);
  if (!context) {
    throw new Error(
      'useLibraryPlayer must be used inside LibraryPlayerProvider',
    );
  }
  return context;
};
