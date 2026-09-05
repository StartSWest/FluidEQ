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
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { currentTrackId, ILibraryQueue } from '../../../common/library/queue';
import { useDspEngine } from '../../dsp/useDspEngine';
import { useDspSettings } from '../../dsp/store';
import { usePlaybackHandoff } from '../../audio/playbackHandoff';
import { claimPlayback, releasePlayback } from '../../audio/playbackOwner';
import { useLibrary } from '../LibraryContext';
import { readStoredVolume } from './playbackMemory';
import {
  ILibraryPlayerClock,
  ILibraryPlayerContextValue,
  ILibraryPlayerSession,
} from './playerContract';
import { useDeckAudio } from './useDeckAudio';
import useDeckBookkeeping from './useDeckBookkeeping';
import useDeckLifecycle from './useDeckLifecycle';
import { useMediaEvents } from './useMediaEvents';
import { usePlaybackCommands } from './usePlaybackCommands';
import { usePlayerDecks } from './usePlayerDecks';
import { usePlayerEngine } from './usePlayerEngine';
import usePublishedTransport from './usePublishedTransport';
import { useQueueControls } from './useQueueControls';
import { useSessionMemory } from './useSessionMemory';
import { useTrackAnalysis } from './useTrackAnalysis';
import { useTransportControls } from './useTransportControls';
import { useUpNext } from './useUpNext';
import { useVideoElement } from './useVideoElement';
import useTrackEnd from './useTrackEnd';
import { useTrackLoader } from './useTrackLoader';

// Re-exported so every existing importer keeps working: the contract moved,
// the module that serves it did not.
export type { ILibraryPlayerContextValue } from './playerContract';

const LibraryPlayerContext = createContext<ILibraryPlayerSession | undefined>(
  undefined,
);

const LibraryPlayerClockContext = createContext<
  ILibraryPlayerClock | undefined
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
  const [retainWhenHidden, setRetainWhenHidden] = usePlaybackHandoff();
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

  /**
   * The native engine, and the clock it hands back. See `usePlayerEngine`:
   * while a deck holds a track the position comes from the engine making the
   * sound, and the element is muted, paused and held only as a fallback.
   */
  const {
    hostOwnsTransport,
    hostOwnsTransportRef,
    seekHost,
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
  // The element claims fallback playback from its own `play` event. A native
  // deck has no DOM event, so its first non-ended telemetry frame is the real
  // signal that a queued handoff has begun making sound again.
  useEffect(() => {
    if (isPlaying && hostOwnsTransport && !hostEnded) {
      claimPlayback('library');
      setRetainWhenHidden(false);
    }
  }, [hostEnded, hostOwnsTransport, isPlaying, setRetainWhenHidden]);
  /** Read inside continuations that outlive the render which started them —
   * the disk read, the decode — where a captured `trackId` would name a track
   * that has since changed. */
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
    setRetainWhenHidden,
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
    setRetainWhenHidden,
    setIsUnplayable,
  });

  /**
   * Video is drawn by `LibraryVideoStage`, which owns a real element; the
   * player redirects transport at it while a video is current. See
   * `useVideoElement`.
   */
  const {
    videoTrackId,
    closeVideo: hideVideoStage,
    openVideo,
    reopenVideo,
    registerVideoElement,
    activeElement,
  } = useVideoElement({
    track,
    videoElementRef,
    audioElementRef,
    volumeRef,
    bindMediaEvents,
    setIsPlaying,
  });

  /**
   * Putting a track on a deck. The largest single thing the player does,
   * and the one with the widest reach into its state — see
   * `useTrackLoader`, where that surface is named rather than implied.
   */
  /**
   * A deck's life inside this provider: bound, reachable, and torn down.
   * See `useDeckLifecycle` — the teardown is why a hot reload does not leave
   * a second song playing over the top of the first.
   */
  useDeckLifecycle({
    audioElements,
    isDisposedRef,
    finishCrossfadeRef,
    bindMediaEvents,
  });
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
  const {
    stop,
    pausePlayback,
    playTracks: playTracksCommand,
    toggle: toggleElement,
  } = usePlaybackCommands({
    activeElement,
    audioElements,
    queueRef,
    hostOwnsTransportRef,
    setQueue,
    setIsPlaying,
    setRetainWhenHidden,
    setAddedIds,
    finishCrossfadeRef,
    fadeFrameRef,
    seekHost,
    setPositionMs,
    volumeRef,
    endedTrackRef,
    naturalCrossfadeTrackRef,
    setLoadRequest,
    pendingRestore,
    audioElementRef,
  });

  /**
   * Play/pause, with one thing to check before it reaches an element.
   *
   * A video the reader closed has no element to reach — `closeVideo` takes
   * the stage down and its own teardown releases the decoder — so the press
   * would land on a hidden audio deck holding no file, and the bar's play
   * button would be dead on a track it is still showing. Asking a closed
   * video to play means show it again, so that is what happens; everything
   * else is the ordinary command, unchanged.
   */
  const toggle = useCallback(() => {
    if (reopenVideo()) {
      return;
    }
    toggleElement();
  }, [reopenVideo, toggleElement]);

  /**
   * Play these, and never mind what was put away.
   *
   * Pressing the same video again after Back produces the same track id, and
   * the picture is remembered as closed BY that id — so the command loaded
   * it, marked the row as playing and showed nothing, which is a worse
   * failure than the one closing was added to fix. Asking for a track is the
   * end of any decision to hide it.
   */
  const playTracks = useCallback(
    (trackIds: readonly string[], startTrackId: string) => {
      openVideo();
      playTracksCommand(trackIds, startTrackId);
    },
    [openVideo, playTracksCommand],
  );

  /**
   * The Back button over a picture: silence it, then put it away.
   *
   * PAUSE AND NOT STOP, because stopping rewinds — and the stage writes down
   * where the reader got to as it unmounts, so a rewind first meant every
   * video was remembered at nought and came back to its own beginning.
   * Measured: closed at 3:25, stored as 0.
   *
   * Pausing before hiding, and that order matters too. Hiding first unmounts
   * the element, and the pause resolves the element it acts on at the moment
   * it runs — it would find the hidden audio deck instead, leaving the
   * video's own decoder to be torn down mid-play by the unmount.
   */
  const closeVideo = useCallback(() => {
    pausePlayback();
    hideVideoStage();
  }, [hideVideoStage, pausePlayback]);

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
    hostOwnsTransportRef,
    seekHost,
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
    retainWhenHidden,
    publishedPositionMs,
    publishedDurationMs,
    volume,
    toggle,
    seek,
    setVolume,
  });
  // Publish the handoff lease before giving up audible ownership. Otherwise
  // the synchronous owner update can let another tab's paused bar flash for
  // one render between tracks. The next real play event/telemetry frame claims
  // ownership again; expiry leaves it released for cleanup.
  useEffect(() => {
    if (retainWhenHidden) {
      releasePlayback('library');
    }
  }, [retainWhenHidden]);

  /**
   * The session and the clock travel separately.
   *
   * Native playback publishes the playhead four times a second. Keeping those
   * two numbers in this value invalidated LibraryWorkspace, Up Next, the video
   * stage and the full-screen artwork on every tick even though none of them
   * read either number. The clock has one visual consumer; the session has the
   * rest, so their context boundaries now match their actual update rates.
   */
  const value = useMemo<ILibraryPlayerSession>(
    () => ({
      queue,
      track,
      isPlaying,
      volume,
      isShuffled: queue?.isShuffled ?? false,
      repeat: queue?.repeat ?? 'off',
      videoTrackId,
      isUnplayable,
      playTracks,
      stop,
      closeVideo,
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
      volume,
      videoTrackId,
      isUnplayable,
      playTracks,
      stop,
      closeVideo,
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
  const clock = useMemo<ILibraryPlayerClock>(
    () => ({
      positionMs: publishedPositionMs,
      durationMs: publishedDurationMs,
    }),
    [publishedDurationMs, publishedPositionMs],
  );

  return (
    <LibraryPlayerContext.Provider value={value}>
      <LibraryPlayerClockContext.Provider value={clock}>
        {children}
      </LibraryPlayerClockContext.Provider>
    </LibraryPlayerContext.Provider>
  );
};

export const useLibraryPlayerSession = (): ILibraryPlayerSession => {
  const context = useContext(LibraryPlayerContext);
  if (!context) {
    throw new Error(
      'useLibraryPlayerSession must be used inside LibraryPlayerProvider',
    );
  }
  return context;
};

export const useLibraryPlayer = (): ILibraryPlayerContextValue => {
  const session = useLibraryPlayerSession();
  const clock = useContext(LibraryPlayerClockContext);
  if (!clock) {
    throw new Error(
      'useLibraryPlayer must be used inside LibraryPlayerProvider',
    );
  }
  return { ...session, ...clock };
};
