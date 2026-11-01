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
 * The Library player, as the window sees it.
 *
 * The player runs in the app's core (`main/libraryPlayer/`): the queue, the
 * songs moving on and fading into each other, the session kept across
 * restarts, the native host that makes the sound. This provider draws what
 * the core says, sends the presses, and does the three things only a window
 * can: plays a video on the stage's element, plays on its own element what
 * the host cannot (`useWindowDeck`), and measures songs with the decoder it
 * has (`useTrackAnalysis`). Every surface reads the same contract it always
 * did (`playerContract.ts`).
 *
 * Deliberately NOT wired to `mediaKeys.ts` / `TitlebarMediaTransport`, which
 * press a Windows virtual key for whatever application is playing and are
 * told nothing back: routed here as well, one press of Play/Pause would act
 * on two players when only one was asked for.
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
import { advanceQueue, currentTrackId } from '../../../common/library/queue';
import type { ILibraryTrack } from '../../../common/library/types';
import { usePlaybackDspSettings } from '../../dsp/store';
import useDspEngine from '../../dsp/useDspEngine';
import {
  claimPlayback,
  registerPlayer,
  releasePlayback,
} from '../../audio/playbackOwner';
import {
  deckWindowIds,
  usePublishedLibraryDeck,
  type TDroppedMusic,
} from '../../player/libraryDeck';
import { usePublishedPlaylistDeck } from '../../player/playlistDeck';
import { useLibrary } from '../LibraryContext';
import { useLibraryTracks } from '../useLibraryTracks';
import {
  addToCoreQueue,
  followCorePlayer,
  handLegacyPlayback,
  pressPlayer,
  useCorePlayerClock,
  useCorePlayerView,
} from './corePlayer';
import { takeLegacyPlayback } from './playbackMemory';
import {
  ILibraryPlayerClock,
  ILibraryPlayerContextValue,
  ILibraryPlayerSession,
} from './playerContract';
import usePublishedTransport from './usePublishedTransport';
import { usePlayerDecks } from './usePlayerDecks';
import usePlayerRackHandover from './usePlayerRackHandover';
import useTrackAnalysis from './useTrackAnalysis';
import { useWindowDeck } from './useWindowDeck';

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
  const { queueFiles } = useLibrary();
  useEffect(() => followCorePlayer(), []);
  // The window's old copy of the session, handed to the core once.
  useEffect(() => {
    const legacy = takeLegacyPlayback();
    if (legacy) {
      handLegacyPlayback(legacy);
    }
  }, []);
  const view = useCorePlayerView();
  const coreClock = useCorePlayerClock();
  const { queue, track, isPlaying, isUnplayable } = view;

  /**
   * The songs around the playhead, for the mini player's list, and the next
   * one, to be measured before it plays. The song playing comes with the
   * view itself.
   */
  const nextId = queue ? currentTrackId(advanceQueue(queue, 1)) : undefined;
  const lookup = useLibraryTracks([
    ...(nextId === undefined ? [] : [nextId]),
    ...deckWindowIds(queue),
  ]);
  const trackById = useMemo(() => {
    const found = new Map<string, ILibraryTrack>();
    lookup.forEach((entry, id) => {
      if (entry !== null) {
        found.set(id, entry);
      }
    });
    if (track) {
      found.set(track.id, track);
    }
    return found;
  }, [lookup, track]);
  const next =
    nextId !== undefined && nextId !== track?.id
      ? trackById.get(nextId)
      : undefined;

  // Two hidden elements for the window's own deck, built once (see
  // `usePlayerDecks`), and the element graph their fades run through.
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const { audioElements } = usePlayerDecks(videoElementRef);
  const dspSettings = usePlaybackDspSettings();
  useDspEngine(audioElements, dspSettings);
  const { bindVideo } = useWindowDeck({
    want: view.windowDeck,
    track: view.deck === 'window' ? track : undefined,
    audioElements,
    videoElementRef,
  });
  usePlayerRackHandover({
    settings: dspSettings,
    libraryGate: view.libraryGate,
    host: view.host,
  });
  useTrackAnalysis({ track, next, settings: dspSettings });

  /**
   * One player at a time across the app: the Library starting stops Karaoke
   * and Online Media, and either of them starting pauses the Library — in the
   * core, which is where it plays.
   */
  useEffect(
    () =>
      registerPlayer('library', () =>
        pressPlayer({ kind: 'setPlaying', isPlaying: false }),
      ),
    [],
  );
  useEffect(() => {
    if (isPlaying) {
      claimPlayback('library');
    } else {
      releasePlayback('library');
    }
  }, [isPlaying]);

  /**
   * The picture put away, with the queue left as it was. Not stop: stopping
   * rewinds, and the stage writes down where the reader got to as it closes,
   * so a rewind first remembered every video at nought. Paused before it is
   * hidden, so the pause reaches the picture's own element.
   */
  const [closedVideoId, setClosedVideoId] = useState<string | undefined>();
  const videoTrackId =
    track?.kind === 'video' && track.isPlayable && track.id !== closedVideoId
      ? track.id
      : undefined;
  const closeVideo = useCallback(() => {
    pressPlayer({ kind: 'setPlaying', isPlaying: false });
    setClosedVideoId(track?.id);
  }, [track?.id]);
  const registerVideoElement = useCallback(
    (element: HTMLVideoElement | null): (() => void) => {
      videoElementRef.current = element;
      if (!element) {
        return () => undefined;
      }
      const unbind = bindVideo(element);
      return () => {
        unbind();
        element.pause();
        element.removeAttribute('src');
        if (videoElementRef.current === element) {
          videoElementRef.current = null;
        }
      };
    },
    [bindVideo],
  );

  /** Asking a closed video to play means showing it again. */
  const toggle = useCallback(() => {
    if (closedVideoId !== undefined && track?.id === closedVideoId) {
      setClosedVideoId(undefined);
      pressPlayer({ kind: 'setPlaying', isPlaying: true });
      return;
    }
    pressPlayer({ kind: 'toggle' });
  }, [closedVideoId, track?.id]);

  /** Playing a song is the end of any decision to hide its picture. */
  const playTracks = useCallback(
    (trackIds: readonly string[], startTrackId: string) => {
      setClosedVideoId(undefined);
      pressPlayer({ kind: 'play', trackIds, startTrackId });
    },
    [],
  );
  const stop = useCallback(() => pressPlayer({ kind: 'stop' }), []);
  const skip = useCallback(
    (direction: 1 | -1) => pressPlayer({ kind: 'skip', direction }),
    [],
  );
  const seek = useCallback(
    (positionMs: number) => pressPlayer({ kind: 'seek', positionMs }),
    [],
  );
  const jumpToQueuePosition = useCallback(
    (position: number) => pressPlayer({ kind: 'jump', position }),
    [],
  );
  const appendToQueue = useCallback((trackIds: readonly string[]) => {
    addToCoreQueue(trackIds).catch(() => undefined);
  }, []);
  const removeUpNextAt = useCallback(
    (position: number) => pressPlayer({ kind: 'remove', position }),
    [],
  );
  const moveUpNext = useCallback(
    (from: number, to: number) => pressPlayer({ kind: 'move', from, to }),
    [],
  );
  const setShuffle = useCallback(
    (isShuffled: boolean) => pressPlayer({ kind: 'shuffle', isShuffled }),
    [],
  );
  const cycleRepeat = useCallback(() => pressPlayer({ kind: 'repeat' }), []);
  const retargetQueue = useCallback(
    (trackIds: readonly string[], listKey: string) =>
      pressPlayer({ kind: 'retarget', trackIds, listKey }),
    [],
  );
  const topUpQueue = useCallback(
    (trackIds: readonly string[], listKey: string) =>
      pressPlayer({ kind: 'topUp', trackIds, listKey }),
    [],
  );
  const setIsContinuationOn = useCallback(
    (isOn: boolean) => pressPlayer({ kind: 'continuation', isOn }),
    [],
  );

  /** Up Next: everything still ahead, and where each of it came from. */
  const added = useMemo(() => new Set(view.added), [view.added]);
  const continued = useMemo(() => new Set(view.continued), [view.continued]);
  const isGuess = useCallback(
    (trackId: string) => continued.has(trackId) && !added.has(trackId),
    [added, continued],
  );
  const upNext = useMemo(
    () =>
      queue
        ? queue.order
            .slice(queue.position + 1)
            .map((index, offset) => ({
              position: queue.position + 1 + offset,
              trackId: queue.trackIds[index],
            }))
            .filter(
              (entry): entry is { position: number; trackId: string } =>
                entry.trackId !== undefined,
            )
            .map((entry) => ({
              ...entry,
              isAdded: added.has(entry.trackId),
              isContinued: continued.has(entry.trackId),
            }))
        : [],
    [added, continued, queue],
  );

  // The bar's clock belongs to the song it was sent for.
  const clock = useMemo<ILibraryPlayerClock>(
    () =>
      coreClock.trackId !== undefined && coreClock.trackId === track?.id
        ? { positionMs: coreClock.positionMs, durationMs: coreClock.durationMs }
        : { positionMs: 0, durationMs: track?.durationMs ?? 0 },
    [coreClock, track?.id, track?.durationMs],
  );

  usePublishedTransport({
    track,
    isPlaying,
    retainWhenHidden: false,
    publishedPositionMs: clock.positionMs,
    publishedDurationMs: clock.durationMs,
    toggle,
    skip,
    isUnplayable,
    seek,
  });

  /**
   * Music files dragged onto the player's queue: they join the library
   * first, which gives each a row and its id, and only then the queue — the
   * other way round the queue would hold ids nothing could resolve yet.
   */
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const addFiles = useCallback(
    async (paths: string[], at?: number): Promise<TDroppedMusic> => {
      // The gap, before an asynchronous folder scan can move the queue.
      const snapshot = queueRef.current;
      const beforeIds =
        at === undefined
          ? undefined
          : (snapshot?.order
              .slice(at)
              .map((index) => snapshot.trackIds[index])
              .filter((id): id is string => id !== undefined) ?? []);
      const trackIds = await queueFiles(paths);
      if (trackIds.length === 0) {
        return 'empty';
      }
      const joined = await addToCoreQueue(trackIds, beforeIds);
      return joined > 0 ? 'added' : 'already';
    },
    [queueFiles],
  );
  usePublishedLibraryDeck({
    queue,
    track,
    trackById,
    isShuffled: queue?.isShuffled ?? false,
    repeat: queue?.repeat ?? 'off',
    stop,
    setShuffle,
    cycleRepeat,
    jumpToQueuePosition,
    addFiles,
    moveUpNext,
    removeUpNextAt,
    isGuess,
  });
  usePublishedPlaylistDeck(playTracks);

  /**
   * The session and the clock travel separately: the playhead moves four
   * times a second and has one visual consumer, and keeping it in this value
   * invalidated every Library surface on every tick.
   */
  const value = useMemo<ILibraryPlayerSession>(
    () => ({
      queue,
      track,
      isPlaying,
      isShuffled: queue?.isShuffled ?? false,
      repeat: queue?.repeat ?? 'off',
      videoTrackId,
      isUnplayable,
      playTracks,
      stop,
      closeVideo,
      toggle,
      retargetQueue,
      topUpQueue,
      upNext,
      isContinuationOn: view.isContinuationOn,
      setIsContinuationOn,
      jumpToQueuePosition,
      appendToQueue,
      removeUpNextAt,
      moveUpNext,
      skip,
      seek,
      setShuffle,
      cycleRepeat,
      registerVideoElement,
    }),
    [
      queue,
      track,
      isPlaying,
      videoTrackId,
      isUnplayable,
      playTracks,
      stop,
      closeVideo,
      toggle,
      retargetQueue,
      topUpQueue,
      upNext,
      view.isContinuationOn,
      setIsContinuationOn,
      jumpToQueuePosition,
      appendToQueue,
      removeUpNextAt,
      moveUpNext,
      skip,
      seek,
      setShuffle,
      cycleRepeat,
      registerVideoElement,
    ],
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
