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
 * The player, held above the tab switch: its state, and the wiring between the
 * hooks that do the work.
 *
 * Nearly everything that used to be here now lives beside it — the decks, the
 * loader, the analysis, the queue, the transport, the session, the native
 * engine — and each says what it is for at the top of its own file. What is
 * left is the state those parts share, the order they have to run in, and the
 * value the rest of the app reads.
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
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { currentTrackId, ILibraryQueue } from '../../../common/library/queue';
import { registerPlayer } from '../../audio/playbackOwner';
import { useDspEngine } from '../../dsp/useDspEngine';
import { useDspSettings } from '../../dsp/store';
import { useLibrary } from '../LibraryContext';
import { readStoredVolume } from './playbackMemory';
import { ILibraryPlayerContextValue } from './playerContract';
import { useDeckAudio } from './useDeckAudio';
import { useDeckBookkeeping } from './useDeckBookkeeping';
import { useMediaEvents } from './useMediaEvents';
import { usePlaybackCommands } from './usePlaybackCommands';
import { usePlayerDecks } from './usePlayerDecks';
import { usePlayerEngine } from './usePlayerEngine';
import { usePublishedTransport } from './usePublishedTransport';
import { useQueueControls } from './useQueueControls';
import { useSessionMemory } from './useSessionMemory';
import { useTrackAnalysis } from './useTrackAnalysis';
import { useTransportControls } from './useTransportControls';
import { useUpNext } from './useUpNext';
import { useVideoElement } from './useVideoElement';
import { useTrackEnd } from './useTrackEnd';
import { useTrackLoader } from './useTrackLoader';

// Re-exported so every existing importer keeps working: the contract moved,
// the module that serves it did not.
export type { ILibraryPlayerContextValue } from './playerContract';

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
  // Non-null while `LibraryVideoStage` has a `<video>` registered — the
  // element every transport command reaches instead, for exactly as long as
  // the current track is a video.
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  // Read from storage rather than defaulted and corrected afterwards: the
  // decks below are built at the stored level, and a state that disagreed with
  // them for one render would put a burst of full-scale audio through them.
  const [volume, setVolumeState] = useState(readStoredVolume);
  // Two hidden decks, built once, kept at the listener's level. See
  // `usePlayerDecks` for why they are never rendered.
  const { audioElements, volumeRef } = usePlayerDecks(volume, videoElementRef);
  const audioElementRef = useRef<HTMLAudioElement | undefined>(
    audioElements[0],
  );
  const isDisposedRef = useRef(false);
  // The DSP chain attaches here rather than in the panel that configures it,
  // because `createMediaElementSource` binds to THIS element and may be called
  // for it exactly once, ever. The panel writes settings into a store; the
  // engine reads them. Nothing about the chain is rebuilt when they change.
  //
  // Only the audio element. The video element below keeps its direct path —
  // routing it through Web Audio as well would mean a second source node and a
  // second chain for a track type the DSP was never asked to colour.
  const dspSettings = useDspSettings();
  useDspEngine(audioElements, dspSettings);
  const dspSettingsRef = useRef(dspSettings);
  dspSettingsRef.current = dspSettings;

  const [queue, setQueue] = useState<ILibraryQueue | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isUnplayable, setIsUnplayable] = useState(false);

  // Re-runs the loader when Play targets the already-cued track after Stop or
  // session restore. A direct src assignment here used to bypass every piece
  // of preparation the normal track loader owns.
  const [loadRequest, setLoadRequest] = useState(0);

  // The `ended` handler is attached once per media element and must never go
  // stale, so it reads the queue through a ref rather than closing over the
  // `queue` state directly.
  const queueRef = useRef<ILibraryQueue | undefined>(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const trackId = queue ? currentTrackId(queue) : undefined;
  const track = trackId ? trackById.get(trackId) : undefined;

  const analysisJobRef = useRef<
    | {
        trackId: string;
        controller: AbortController;
      }
    | undefined
  >(undefined);

  /** Read inside `swapBufferToBlob`'s continuation, where the `trackId` it
   * closed over would be the one from the render that started the read. */
  /**
   * The native engine, and the clock it hands back. See `usePlayerEngine`:
   * while a deck holds a track the position comes from the engine making the
   * sound, and the element is muted, paused and held only as a fallback.
   */
  const {
    hostOwnsTransportRef,
    hostEnded,
    publishedPositionMs,
    publishedDurationMs,
    endedTrackRef,
  } = usePlayerEngine({
    dspSettings,
    audioElements,
    track,
    isPlaying,
    positionMs,
    durationMs,
    volume,
  });
  const trackIdRef = useRef(trackId);
  trackIdRef.current = trackId;

  /**
   * Levels and sources: the fades, the overlap and the swap to an in-memory
   * blob. One subject, and they share the state that makes them safe — see
   * `useDeckAudio`.
   */
  const {
    fadeIn,
    startSeekFade,
    startCrossfade,
    releaseBlob,
    swapBufferToBlob,
    fadeInRef,
    finishCrossfadeRef,
    naturalCrossfadeTrackRef,
    fadeFrameRef,
  } = useDeckAudio({ volumeRef, trackIdRef });

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
    isDisposedRef.current = false;
    return () => {
      isDisposedRef.current = true;
      // Reading the CURRENT overlap is the whole point: there is none when
      // this effect runs, so the rule's advice — copy the ref at setup —
      // would capture `undefined` and leave a running crossfade holding both
      // decks after the provider is gone.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      finishCrossfadeRef.current?.();
      audioElements.forEach((audio) => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      });
    };
  }, [audioElements, finishCrossfadeRef]);
  /**
   * What each deck is currently doing, keyed by the deck itself. See
   * `useDeckBookkeeping` for why element and not track id.
   */
  const { elementTrackRef, freshLoadRef, programmeEdgesRef, leadInSeekRef } =
    useDeckBookkeeping();
  /**
   * Remembering what was playing, and putting it back — a cued track with
   * its playhead offered to the loader, never a window that starts making
   * noise on its own. See `useSessionMemory`.
   */
  const { pendingRestore } = useSessionMemory({
    queue,
    queueRef,
    positionMs,
    trackById,
    libraryTracks: index.tracks,
    setQueue,
    setPositionMs,
  });
  /**
   * A track running out — what to do about it, when the host says it has,
   * and when to start an overlap before it does. See `useTrackEnd`.
   */
  const handleEnded = useTrackEnd({
    queueRef,
    setQueue,
    setIsPlaying,
    trackIdRef,
    audioElementRef,
    endedTrackRef,
    naturalCrossfadeTrackRef,
    programmeEdgesRef,
    hostEnded,
    dspSettings,
    publishedPositionMs,
    publishedDurationMs,
  });
  /**
   * What the player learns by listening to a deck. See `useMediaEvents`,
   * which is also where the reasoning about which of those statements
   * still counts now that the host owns the transport lives.
   */
  const bindMediaEvents = useMediaEvents({
    audioElementRef,
    videoElementRef,
    elementTrackRef,
    trackIdRef,
    hostOwnsTransportRef,
    freshLoadRef,
    leadInSeekRef,
    pendingRestore,
    fadeInRef,
    handleEnded,
    setPositionMs,
    setDurationMs,
    setIsPlaying,
    setIsUnplayable,
  });

  /**
   * Video is drawn by `LibraryVideoStage`, which owns a real element; the
   * player redirects transport at it while a video is current. See
   * `useVideoElement`.
   */
  const { videoTrackId, registerVideoElement, activeElement } = useVideoElement(
    {
      track,
      videoElementRef,
      audioElementRef,
      volumeRef,
      bindMediaEvents,
    },
  );

  // Bound once to both decks. Only the active deck writes transport state;
  // the outgoing deck stays audible during overlap without fighting the UI.
  useEffect(() => {
    const unbind = audioElements.map((element) => bindMediaEvents(element));
    return () => unbind.forEach((one) => one());
  }, [audioElements, bindMediaEvents]);

  // How the rest of the app silences this player when it takes over. Pausing
  // rather than clearing the queue: the reader gets their album back where
  // they left it when they come back to the tab, which is what "something
  // else started" should cost them and no more.
  useEffect(
    () =>
      registerPlayer('library', () => {
        audioElements.forEach((audio) => audio.pause());
        videoElementRef.current?.pause();
      }),
    [audioElements],
  );

  /**
   * Putting a track on a deck. The largest single thing the player does,
   * and the one with the widest reach into its state — see
   * `useTrackLoader`, where that surface is named rather than implied.
   */
  useTrackLoader({
    trackId,
    track,
    loadRequest,
    audioElements,
    audioElementRef,
    dspSettingsRef,
    elementTrackRef,
    programmeEdgesRef,
    freshLoadRef,
    leadInSeekRef,
    naturalCrossfadeTrackRef,
    finishCrossfadeRef,
    fadeFrameRef,
    volumeRef,
    isDisposedRef,
    analysisJobRef,
    pendingRestore,
    fadeIn,
    releaseBlob,
    swapBufferToBlob,
    startCrossfade,
    setPositionMs,
    setDurationMs,
    setIsPlaying,
    setIsUnplayable,
  });
  /**
   * Measuring tracks in the background — the one coming next, and the one
   * already playing when a setting asks for a number it does not have.
   * See `useTrackAnalysis`, including why they share one job.
   */
  useTrackAnalysis({
    track,
    trackId,
    queue,
    trackById,
    dspSettings,
    dspSettingsRef,
    trackIdRef,
    audioElementRef,
    elementTrackRef,
    programmeEdgesRef,
    analysisJobRef,
  });

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

  /**
   * What is coming, and where each of it came from — the record being
   * played through, what was added by hand, and what continuation guessed.
   * See `useUpNext`.
   */
  const {
    upNext,
    isContinuationOn,
    setIsContinuationOn,
    setAddedIds,
    addedIdsRef,
    continuedIdsRef,
  } = useUpNext({
    queue,
    trackId,
    trackById,
    libraryTracks: index.tracks,
    setQueue,
  });
  /**
   * Start, stop and suspend — the three commands that decide whether there
   * is anything playing at all. See `usePlaybackCommands`.
   */
  const { stop, playTracks, toggle } = usePlaybackCommands({
    activeElement,
    queueRef,
    hostOwnsTransportRef,
    setQueue,
    setIsPlaying,
    setAddedIds,
    setLoadRequest,
    pendingRestore,
    audioElementRef,
  });
  /**
   * Rearranging what is coming, none of which can make a sound. See
   * `useQueueControls` for why that is a boundary rather than a filing
   * decision.
   */
  const {
    jumpToQueuePosition,
    appendToQueue,
    removeUpNextAt,
    moveUpNext,
    setShuffle,
    cycleRepeat,
    retargetQueue,
  } = useQueueControls({
    setQueue,
    queueRef,
    addedIdsRef,
    continuedIdsRef,
    setAddedIds,
    playTracks,
  });
  /**
   * Next/Previous, the scrubber and the fader — the controls that move the
   * listener rather than the list. See `useTransportControls`.
   */
  const { skip, seek, setVolume, commitVolume } = useTransportControls({
    activeElement,
    startSeekFade,
    finishCrossfadeRef,
    publishedPositionMs,
    volumeRef,
    setPositionMs,
    setVolumeState,
    setQueue,
  });
  /**
   * Telling the rest of the app what this player is doing, in the shape
   * every source can answer with. See `usePublishedTransport`.
   */
  usePublishedTransport({
    track,
    isPlaying,
    publishedPositionMs,
    publishedDurationMs,
    volume,
    toggle,
    seek,
    setVolume,
  });

  const value = useMemo<ILibraryPlayerContextValue>(
    () => ({
      queue,
      track,
      isPlaying,
      positionMs: publishedPositionMs,
      durationMs: publishedDurationMs,
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
      isContinuationOn,
      setIsContinuationOn,
      jumpToQueuePosition,
      appendToQueue,
      removeUpNextAt,
      moveUpNext,
      skip,
      seek,
      setShuffle,
      cycleRepeat,
      setVolume,
      commitVolume,
      registerVideoElement,
    }),
    [
      queue,
      track,
      isPlaying,
      publishedPositionMs,
      publishedDurationMs,
      volume,
      videoTrackId,
      isUnplayable,
      playTracks,
      stop,
      toggle,
      retargetQueue,
      upNext,
      isContinuationOn,
      setIsContinuationOn,
      jumpToQueuePosition,
      appendToQueue,
      removeUpNextAt,
      moveUpNext,
      skip,
      seek,
      setShuffle,
      cycleRepeat,
      setVolume,
      commitVolume,
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
