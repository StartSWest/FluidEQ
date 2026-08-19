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
import { ILibraryTrack } from '../../../common/library/types';
import { useLibrary } from '../LibraryContext';

const REPEAT_CYCLE: readonly TLibraryRepeat[] = ['off', 'all', 'one'];

const nextRepeat = (repeat: TLibraryRepeat): TLibraryRepeat =>
  REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(repeat) + 1) % REPEAT_CYCLE.length];

/** Where every session's volume slider starts — the loudest a fresh
 * `HTMLAudioElement` already opens at, so this changes nothing until someone
 * touches the slider. */
const DEFAULT_VOLUME = 1;

const clampVolume = (value: number): number => Math.min(1, Math.max(0, value));

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
      const onLoadedMetadata = () =>
        setDurationMs(
          Number.isFinite(element.duration) ? element.duration * 1000 : 0,
        );
      const onPlay = () => setIsPlaying(true);
      const onPause = () => setIsPlaying(false);
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
      element.addEventListener('loadedmetadata', onLoadedMetadata);
      element.addEventListener('play', onPlay);
      element.addEventListener('pause', onPause);
      element.addEventListener('ended', onEnded);
      element.addEventListener('error', onError);
      return () => {
        element.removeEventListener('timeupdate', onTimeUpdate);
        element.removeEventListener('loadedmetadata', onLoadedMetadata);
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
    audio.src = libraryMediaUrl('track', track.id);
    audio.currentTime = 0;
    audio.play().catch(() => undefined);
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
    },
    [],
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

  const skip = useCallback((direction: 1 | -1) => {
    setQueue((current) =>
      current ? advanceQueue(current, direction) : current,
    );
  }, []);

  const seek = useCallback(
    (nextPositionMs: number) => {
      const element = activeElement();
      const clamped = Math.max(0, nextPositionMs);
      if (element) {
        element.currentTime = clamped / 1000;
      }
      setPositionMs(clamped);
    },
    [activeElement],
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
