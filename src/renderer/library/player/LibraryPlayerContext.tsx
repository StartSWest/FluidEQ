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
import { buildSongIdentity } from 'common/songIdentity';
import {
  advanceQueue,
  currentTrackId,
  ILibraryQueue,
  queueAtEnd,
} from '../../../common/library/queue';
import { registerPlayer } from '../../audio/playbackOwner';
import {
  clearTransportSource,
  setTransportSource,
} from '../../audio/transportSource';
import { ILibraryProgrammeEdges } from '../../../common/library/types';
import { useDspEngine } from '../../dsp/useDspEngine';
import {
  useNativeBackend,
  useNativeDeviceGeneration,
  useNativeMeters,
  useNativeMirror,
  useNativeTransport,
} from '../../dsp/useNativeBackend';
import { useDspNativeTransport, useDspSettings } from '../../dsp/store';
import { useLibrary } from '../LibraryContext';
import { readStoredVolume } from './playbackMemory';
import { ILibraryPlayerContextValue } from './playerContract';
import { useDeckAudio } from './useDeckAudio';
import { useMediaEvents } from './useMediaEvents';
import { usePlaybackCommands } from './usePlaybackCommands';
import { useQueueControls } from './useQueueControls';
import { useSessionMemory } from './useSessionMemory';
import { useTrackAnalysis } from './useTrackAnalysis';
import { useTransportControls } from './useTransportControls';
import { useUpNext } from './useUpNext';
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

  // Two stable, hidden decks make a real overlap possible. Replacing one
  // element's source cannot crossfade: the old decoder is already gone by the
  // time the new source starts.
  const audioElementsRef = useRef<
    readonly [HTMLAudioElement, HTMLAudioElement] | undefined
  >(undefined);
  if (!audioElementsRef.current) {
    const storedVolume = readStoredVolume();
    const first = new Audio();
    const second = new Audio();
    [first, second].forEach((element) => {
      /**
       * Before any `src`, and that ordering is the whole point.
       *
       * Library tracks are served over `fluideq-media://`, which is a different
       * origin from this page. Without a CORS-mode request the media is tainted,
       * and Chromium's rule for tainted media is that the
       * `MediaElementAudioSourceNode` built on it emits SILENCE while the element
       * carries on decoding — so the transport ran and the seek bar moved with no
       * sound at all. `crossOrigin` is only consulted when the load starts, so
       * setting it after a `src` has been assigned does nothing.
       */
      element.crossOrigin = 'anonymous';
      // Set from storage here, not from an effect after the first render. An
      // element built at unity and turned down afterwards is briefly at unity,
      // and someone who left the fader at 17% would get a burst of full-scale
      // audio on launch — the opposite of what remembering it is for.
      element.volume = storedVolume;
    });
    audioElementsRef.current = [first, second];
  }
  const audioElements = audioElementsRef.current;
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

  const [queue, setQueue] = useState<ILibraryQueue | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  // Initialised from storage rather than defaulted and corrected later: the
  // element above was built at the stored level, and a state that disagreed
  // with it for one render would have the effect below undo that.
  const [volume, setVolumeState] = useState(readStoredVolume);
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
    audioElements.forEach((audio) => {
      audio.volume = volume;
    });
    if (videoElementRef.current) {
      videoElementRef.current.volume = volume;
    }
  }, [audioElements, volume]);

  const trackId = queue ? currentTrackId(queue) : undefined;
  const track = trackId ? trackById.get(trackId) : undefined;

  /**
   * The native engine, shadowing this player — and now the default one.
   *
   * Deliberately a SHADOW rather than a replacement, which is what it stays
   * after becoming the default. The elements above keep every job they have —
   * position, events, the queue's advance, the crossfade's cue point — and are
   * muted, while the host is told the same file at the same position. That is
   * what made the two engines comparable while there was a switch, and it is
   * what makes the fallback whole now that there is not: a host that cannot
   * start leaves the elements unmuted and the TypeScript chain processing, and
   * the only thing the user loses is which engine did the arithmetic.
   *
   * `useNativeBackend` answers `undefined` unless the native engine is
   * selected, so there is nothing here to call by accident on either path.
   */
  const nativeBackend = useNativeBackend(dspSettings);
  // The panel's graphs read the engine that is audible, not the muted one.
  useNativeMeters(nativeBackend);
  // And the mirror re-cues when the host moves to a different endpoint.
  useNativeDeviceGeneration(nativeBackend);
  // The clock comes from the engine making the sound. See `hostTransport`.
  useNativeTransport(nativeBackend);
  /**
   * One clock, and it belongs to whatever is audible.
   *
   * While the host is playing, the element is muted and its position is a
   * second decode of the same file kept only to be a clock. Reading both is
   * what let a track cued at the previous one's position play from the middle
   * with the bar at zero: each was right about a different player.
   *
   * `hasSource` rather than "is the native engine on", because the host has a
   * clock only once a deck holds something. Between engaging and the first
   * load there is nothing to read, and the element is still the authority.
   */
  const hostTransport = useDspNativeTransport();
  const hostOwnsTransport = hostTransport.hasSource;
  const publishedPositionMs = hostOwnsTransport
    ? hostTransport.positionSeconds * 1_000
    : positionMs;
  // A duration of zero means the decoder could not say, which is legal — the
  // element's own answer is better than none.
  const publishedDurationMs =
    hostOwnsTransport && hostTransport.durationSeconds > 0
      ? hostTransport.durationSeconds * 1_000
      : durationMs;
  const hostOwnsTransportRef = useRef(hostOwnsTransport);
  hostOwnsTransportRef.current = hostOwnsTransport;
  /** Fired for at most one track; see the effect beside `handleEnded`. */
  const endedTrackRef = useRef<string | undefined>(undefined);
  useNativeMirror(nativeBackend, audioElements, {
    mediaPath: track?.path,
    isPlaying,
    positionMs,
    volume,
    /**
     * The fade the mirror should use if the track changes under it.
     *
     * Passed as state rather than called as an event: the player sets the new
     * track, React re-renders, and the mirror sees the change on the very next
     * sync — which is exactly when the fade should start. A method called
     * afterwards always arrived to find the track already cued as a cut.
     */
    transition:
      dspSettings.enabled && dspSettings.crossfade.enabled
        ? {
            durationMs: dspSettings.crossfade.durationMs,
            curve: dspSettings.crossfade.curve,
            shape: dspSettings.crossfade.shape,
          }
        : undefined,
  });

  const analysisJobRef = useRef<
    | {
        trackId: string;
        controller: AbortController;
      }
    | undefined
  >(undefined);

  /** Read inside `swapBufferToBlob`'s continuation, where the `trackId` it
   * closed over would be the one from the render that started the read. */
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
   * Which track each element is playing, so only one of them reports position.
   *
   * A crossfade runs both elements at once, and for the length of the overlap
   * the outgoing one is still playing a track that is no longer the current
   * one. Its `timeupdate` kept writing `positionMs`, so the seek bar was being
   * driven by three writers at the same time: the reset to zero on the track
   * change, the outgoing element still reporting the middle of the previous
   * song, and the incoming element starting from nothing. The thumb jumped to
   * the start, back out to where the old track was, and to the start again —
   * reported as the bar "going crazy" on Next, which is a fair description.
   *
   * Ownership of TRANSPORT cannot be moved early to fix it — `audioElementRef`
   * deliberately waits for `play()` to settle, because handing Next and
   * Previous to a deck that then fails to start makes the working song
   * unreachable. But position is a different question with a different answer:
   * it belongs to the track on screen, and only the element playing that track
   * may report it.
   */
  const elementTrackRef = useRef(new Map<HTMLMediaElement, string>());

  /**
   * Decks holding a track that has just been loaded and must start at zero.
   *
   * A song reached by switching away and back was starting part-way in, and
   * every explanation for it was ruled out one at a time by measurement: the
   * crossfade lead-in trim never runs with crossfade off, the blob swap costs
   * 26ms, the fade-in is 80ms, and the element reports `currentTime` 0 when it
   * begins. Stopping a song and playing it again is fine and switching away
   * and back is not, which puts the write on the loader path — it is keyed on
   * the track id, so stop-and-play never re-runs it.
   *
   * Rather than keep hunting the writer, the load states the position it
   * wants. A track that has just been loaded plays from its beginning; that is
   * true of every path except the two that deliberately ask for somewhere
   * else, and both of those clear this first.
   *
   * Applied when metadata arrives rather than beside the `src` assignment, and
   * that ordering is not a detail — the comment above `audio.src` has the
   * measurements: seeking an element still at `HAVE_NOTHING` records the seek
   * against a resource whose ranges are unknown, and `seekable` then comes
   * back empty and STAYS empty, so every later seek is silently refused. That
   * is the disabled seek bar this file has already been through once.
   */
  const freshLoadRef = useRef(new Set<HTMLMediaElement>());

  /**
   * Where the music stops in whatever each deck is playing.
   *
   * Keyed by element rather than by track id so it holds two entries and not
   * one per song of a listening session, and so the `timeupdate` listener —
   * bound once for the life of the element — can answer for the track that
   * element is actually playing rather than the one the app is showing.
   *
   * Populated from the library's cached analysis at load, and again when a
   * first-play measurement finishes, which for a track long enough to matter
   * lands minutes before its own ending does.
   */
  const programmeEdgesRef = useRef(
    new Map<HTMLMediaElement, ILibraryProgrammeEdges>(),
  );

  /** Decks whose next `seeked` is the lead-in trim — see `bindMediaEvents`. */
  const leadInSeekRef = useRef(new Set<HTMLMediaElement>());
  /**
   * Remembering what was playing, and putting it back — a cued track with
   * its playhead offered to the loader, never a window that starts making
   * noise on its own. See `useSessionMemory`.
   */
  useSessionMemory({
    queue,
    queueRef,
    positionMs,
    trackById,
    libraryTracks: index.tracks,
    setQueue,
    setPositionMs,
    pendingRestore,
    isRestoringRef,
  });
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

  /**
   * End of track, from the deck that actually reached it.
   *
   * The host reports `ended` as a STATE and holds it until something else is
   * loaded, so this fires on the edge and remembers which track it fired for.
   * Reading it as an event would advance the queue again on every telemetry
   * frame until the next load, which is forty times a second.
   *
   * The element's own `ended` is ignored while the host owns the transport —
   * see `onEnded`. One of them has to be the authority, and it is the one
   * making the sound.
   */
  useEffect(() => {
    const playing = trackIdRef.current;
    if (!hostTransport.ended || !playing || endedTrackRef.current === playing) {
      return;
    }
    endedTrackRef.current = playing;
    const element = audioElementRef.current;
    if (element) {
      handleEnded(element);
    }
  }, [hostTransport.ended, handleEnded]);

  /**
   * Start the overlap while there is still music to overlap with.
   *
   * Driven by the published clock rather than by the element's `timeupdate`,
   * which is where this lived. The element is no longer necessarily running —
   * once the host owns the transport it is paused, and a paused element emits
   * no ticks — so a check that hung off one would simply stop happening on the
   * engine that is actually playing.
   *
   * One path serves both engines: `publishedPositionMs` is the host's when
   * there is a deck and the element's otherwise, so this reads whichever one
   * is making the sound.
   */
  useEffect(() => {
    const { current } = queueRef;
    const transition = dspSettings.crossfade;
    const playingId = current ? currentTrackId(current) : undefined;
    const element = audioElementRef.current;
    if (
      !current ||
      !playingId ||
      !element ||
      !dspSettings.enabled ||
      !transition.enabled ||
      current.repeat === 'one' ||
      naturalCrossfadeTrackRef.current === playingId ||
      !Number.isFinite(publishedDurationMs) ||
      publishedDurationMs <= 0 ||
      (queueAtEnd(current) && current.repeat !== 'all')
    ) {
      return;
    }
    /**
     * The end of the music, not the end of the file.
     *
     * A track padded with five seconds of digital silence used to start its
     * two-second fade three seconds into that silence: nothing audible crossed
     * over, and the next song waited for the padding to run out. Without a
     * measurement this is the duration, which is what it always was.
     */
    const edges = programmeEdgesRef.current.get(element);
    const programmeEndMs = Math.min(
      publishedDurationMs,
      edges?.endMs ?? Number.POSITIVE_INFINITY,
    );
    // Not `remaining > 0`, which is the same test only while the programme
    // runs to the last sample. Once the end is trimmed, being already inside
    // the trailing silence — seeked into it, or arrived there while the DSP
    // was off — is a reason to hand over now.
    if (
      publishedPositionMs < publishedDurationMs &&
      programmeEndMs - publishedPositionMs <= transition.durationMs
    ) {
      naturalCrossfadeTrackRef.current = playingId;
      setQueue(advanceQueue(current, 1));
    }
  }, [
    publishedPositionMs,
    publishedDurationMs,
    dspSettings,
    naturalCrossfadeTrackRef,
  ]);
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
      positionMs: publishedPositionMs,
      durationMs: publishedDurationMs,
      toggle,
      seek,
      volume,
      setVolume,
      identity: buildSongIdentity(
        'library',
        track.id,
        track.title,
        track.artist,
      ),
    });
  }, [
    track,
    isPlaying,
    publishedPositionMs,
    publishedDurationMs,
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
