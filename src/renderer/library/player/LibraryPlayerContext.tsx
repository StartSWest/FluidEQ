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
  buildQueue,
  currentTrackId,
  ILibraryQueue,
  queueAtEnd,
  setShuffle as setQueueShuffle,
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
import {
  ILibraryProgrammeEdges,
  ILibraryTrack,
} from '../../../common/library/types';
import { INoiseProfile } from '../../../common/dsp/noiseProfile';
import {
  DSP_DIAGNOSTIC_CODES,
  DSP_DIAGNOSTIC_SCHEMA_VERSION,
} from '../../../common/dsp/diagnostics';
import { selectDspDeck } from '../../dsp/deckCrossfade';
import { dspErrorValues, reportDspDiagnostic } from '../../dsp/diagnostics';
import {
  setDspInputTrackId,
  setDspNoiseProfile,
  setDspTrackLevelGains,
  useDspEngine,
} from '../../dsp/useDspEngine';
import {
  useNativeBackend,
  useNativeDeviceGeneration,
  useNativeMeters,
  useNativeMirror,
  useNativeTransport,
} from '../../dsp/useNativeBackend';
import {
  analyzeInputTrack,
  masterLoudnessGainDb,
  normalizerGainDb,
} from '../../dsp/inputNormalizer';
import {
  IDspInputAnalysisState,
  setDspInputAnalysis,
  useDspNativeTransport,
  useDspSettings,
} from '../../dsp/store';
import { useLibrary } from '../LibraryContext';
import {
  readPlaybackMemory,
  readStoredContinuation,
  readStoredVolume,
  restorablePositionMs,
  writePlaybackMemory,
  writeStoredContinuation,
  writeStoredVolume,
} from './playbackMemory';
import {
  CONTINUATION_LOW_WATER,
  pickContinuation,
} from '../../../common/library/continuation';

import {
  ILibraryPlayerContextValue,
  MIN_LEAD_IN_TRIM_MS,
  PREVIOUS_RESTART_THRESHOLD_MS,
  TRACK_FADE_IN_MS,
  clampVolume,
  nextRepeat,
  normalizationChanged,
} from './playerContract';
import { useDeckAudio } from './useDeckAudio';

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
    /**
     * Cued, never started — and that is unconditional.
     *
     * These are two separate questions and they were answered by one `if`.
     * `restorablePositionMs` decides whether the PLAYHEAD is worth putting
     * back, and it declines under five seconds; but the loader reads this same
     * ref to decide whether to cue the track or call `play()` on it. So a
     * session that ended two seconds into a song set nothing here, fell through
     * to the play branch, and the app started making noise on its own at
     * launch.
     *
     * Whether to resume a position is a judgement. Whether to start playing
     * unasked is not.
     */
    pendingRestore.current = {
      trackId: restoreTrackId,
      positionMs: restoreMs ?? 0,
    };
    if (restoreMs !== undefined) {
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

  const bindMediaEvents = useCallback(
    (element: HTMLMediaElement): (() => void) => {
      const isActive = () =>
        element === (videoElementRef.current ?? audioElementRef.current);
      /**
       * May this element speak for the position readout?
       *
       * Only if it is playing the track the rest of the app is showing. During
       * a crossfade the outgoing element is still running a track that has
       * already been replaced, and letting it answer here is what threw the
       * seek bar back to the middle of the previous song.
       *
       * Untagged elements are allowed through: everything outside a handoff
       * has exactly one audible element, and refusing an element that has not
       * been tagged yet would silence the readout on the very first track.
       */
      const ownsPosition = () => {
        const playing = elementTrackRef.current.get(element);
        return playing === undefined || playing === trackIdRef.current;
      };
      // `timeupdate` fires about four times a second — the right cadence for
      // a number that changes once a second on screen, and no reason to add
      // a `requestAnimationFrame` loop on top of it.
      const onTimeUpdate = () => {
        if (!isActive()) {
          return;
        }
        if (ownsPosition()) {
          setPositionMs(element.currentTime * 1000);
        }
      };
      // `seeked` as well, exactly as `useKaraokeSession` does it: the element
      // is the authority on where it actually landed, and `timeupdate` can
      // still report the old position for a tick or two after a seek is
      // asked for. Without this the thumb was dragged, released, and then
      // pulled back by a stale tick before the next one caught up.
      const onSeeked = () => {
        if (!isActive()) {
          return;
        }
        if (ownsPosition()) {
          setPositionMs(element.currentTime * 1000);
        }
        // Bring the level back after the jump — see `startSeekFade`. Reached
        // through a ref because this listener is bound once for the life of
        // the element and must not take a dependency on anything defined
        // later in this component.
        //
        // Except for the player's own lead-in jump, which is not a seek
        // anybody asked for: that deck is already inside a scheduled fade
        // that owns its level, and a 70ms ramp from zero on top of the
        // crossfade's own is the incoming song dipping as it arrives. The
        // flag is consumed here, so a real seek on the same deck a moment
        // later still gets its level back.
        if (!leadInSeekRef.current.delete(element)) {
          fadeInRef.current?.(element);
        }
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
        if (!isActive()) {
          return;
        }
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
        /**
         * The one safe moment to put the playhead back where the last session
         * left it: the ranges are known now, so the seek lands instead of
         * being silently dropped.
         *
         * Matched against the track this ELEMENT is actually playing, which
         * is the check every other reader of `pendingRestore` already makes
         * and this one did not — while being the only one that performs a
         * seek. A restore that outlived its own track landed the saved
         * position on whatever loaded next: a song chosen with Next or
         * Previous started near the end, because that is where the last
         * session had stopped. Reported as "the song starts mid-song, almost
         * at the end".
         *
         * The loader clears the ref when it loads a different track, so this
         * only bites when the loader has not run in between — it is keyed on
         * the track id alone, so navigating back to the same track never
         * re-runs it.
         */
        const restore = pendingRestore.current;
        if (
          restore !== undefined &&
          elementTrackRef.current.get(element) === restore.trackId
        ) {
          pendingRestore.current = undefined;
          // The restore is the position this load wants, so the reset below
          // must not then argue with it.
          freshLoadRef.current.delete(element);
          element.currentTime = restore.positionMs / 1000;
          setPositionMs(restore.positionMs);
        } else if (freshLoadRef.current.delete(element)) {
          /**
           * A newly loaded track starts at its beginning. Stated, not assumed.
           *
           * Only when something is actually there to correct: assigning zero
           * to an element already at zero makes the decoder re-sync for
           * nothing, which is audible as a tick at the top of every song.
           *
           * The crossfade's lead-in trim is the one caller that wants a fresh
           * load to begin somewhere else, and it seeks from `play()`'s
           * continuation — after this — so it still wins.
           */
          if (element.currentTime > 0) {
            element.currentTime = 0;
            setPositionMs(0);
          }
        }
      };
      // The element is the authority on when sound actually starts, so the
      // claim is made from its own event rather than from the call that asked
      // for it: `play()` is a promise that can be refused, and claiming on the
      // request would have silenced the karaoke tab for a track that never
      // began. See `playbackOwner`.
      const onPlay = () => {
        if (!isActive()) {
          return;
        }
        claimPlayback('library');
        setIsPlaying(true);
      };
      const onPause = () => {
        if (!isActive()) {
          return;
        }
        /**
         * A deck the host has taken over is paused deliberately, and that is
         * not the listener pausing.
         *
         * Once the host holds the track the element stops decoding it — see
         * the mirror — and the `pause` that follows is the second decoder
         * being switched off, not a transport event. Acting on it stopped the
         * music a moment after every track started.
         *
         * Play is not guarded the same way: a deck that has actually begun
         * playing is a track starting whichever engine owns it, and the host
         * has no transport of its own to report until a deck is loaded.
         */
        if (hostOwnsTransportRef.current) {
          return;
        }
        releasePlayback('library');
        setIsPlaying(false);
      };
      const onEnded = () => {
        /**
         * Only when this element is the one playing the track.
         *
         * While the host owns the transport the element is muted and running
         * a second decode purely as a clock, and its `ended` is that clock
         * reaching the end — not the music. Both firing advanced the queue
         * twice on the same track, and which one won depended on how far the
         * two decoders had drifted.
         */
        if (isActive() && !hostOwnsTransportRef.current) {
          handleEnded(element);
        }
      };
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
        if (!isActive()) {
          return;
        }
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
    [handleEnded, fadeInRef, hostOwnsTransportRef],
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
    // A track load owns exactly one analysis job. Aborting before every early
    // return prevents rapid next/previous actions from leaving an old decoder
    // alive or letting its result touch the newly selected track.
    analysisJobRef.current?.controller.abort();
    analysisJobRef.current = undefined;
    // A new queue owner closes the previous handoff before inspecting either
    // deck. This is what makes rapid Next/Previous deterministic instead of
    // letting an older completion callback pause the newly active song.
    finishCrossfadeRef.current?.();
    const outgoing = audioElementRef.current;
    if (!outgoing) {
      return undefined;
    }
    const transition = dspSettingsRef.current.crossfade;
    const isCrossfading =
      dspSettingsRef.current.enabled &&
      transition.enabled &&
      track?.kind === 'audio' &&
      track.isPlayable &&
      !outgoing.paused &&
      outgoing.getAttribute('src') !== null &&
      pendingRestore.current?.trackId !== track.id;
    const alternate =
      audioElements[0] === outgoing ? audioElements[1] : audioElements[0];
    const audio = isCrossfading && alternate ? alternate : outgoing;
    cancelAnimationFrame(fadeFrameRef.current);
    if (isCrossfading) {
      audio.pause();
      audio.volume = 0;
      releaseBlob(audio);
    } else {
      audioElements.forEach((element) => {
        element.pause();
        element.volume = 0;
      });
      selectDspDeck(audio);
    }
    naturalCrossfadeTrackRef.current = undefined;
    // On a direct load this must precede the new normalization gain. During a
    // crossfade both identity and track-level gain stay owned by the outgoing
    // song until the incoming deck has completed the configured overlap.
    if (!isCrossfading) {
      setDspInputTrackId(track?.id ?? '');
    }
    if (!isCrossfading) {
      releaseBlob(audio);
    }
    if (!trackId || !track) {
      audioElements.forEach((element) => element.removeAttribute('src'));
      setDspInputAnalysis({ status: 'idle', fraction: 0 });
      setIsUnplayable(false);
      setDurationMs(0);
      setPositionMs(0);
      return undefined;
    }
    // The tag's own duration first, so the bar shows a real number before the
    // element has read the file — overwritten by `loadedmetadata` once it has.
    setDurationMs(track.durationMs ?? 0);
    setPositionMs(0);
    // Tagged here, before either element can tick again, so the outgoing one
    // stops answering for a track it is no longer playing.
    elementTrackRef.current.set(audio, track.id);
    // Whatever this deck was doing, it is playing something new now, and
    // something new starts at the start. Consumed once, at metadata.
    freshLoadRef.current.add(audio);
    // Deleted first, and unconditionally: a deck that is handed an unmeasured
    // track must fall back to its duration rather than keep answering with
    // the previous song's ending.
    programmeEdgesRef.current.delete(audio);
    if (track.normalization?.edges) {
      programmeEdgesRef.current.set(audio, track.normalization.edges);
    }
    if (!track.isPlayable) {
      audio.removeAttribute('src');
      setDspInputAnalysis({
        trackId: track.id,
        status: 'unavailable',
        fraction: 0,
      });
      setIsUnplayable(true);
      setIsPlaying(false);
      return undefined;
    }
    setIsUnplayable(false);
    if (track.kind === 'video') {
      // Handed to `LibraryVideoStage` instead — never fed to the hidden
      // element, so the two can never sound at once.
      audioElements.forEach((element) => element.removeAttribute('src'));
      setDspInputAnalysis({
        trackId: track.id,
        status: 'unavailable',
        fraction: 0,
      });
      setIsPlaying(true);
      return undefined;
    }
    let cancelled = false;
    let transitionStarted = false;
    let playbackAccepted = pendingRestore.current?.trackId === track.id;
    let handoffComplete = !isCrossfading;
    let bufferedForSwap: ArrayBuffer | undefined;
    /**
     * Replacing `src` aborts an unsettled `play()` promise in Chromium.
     * Therefore a fast disk read may prepare the blob immediately, but it may
     * not install it until playback has started and any two-deck overlap has
     * finished. This ordering is what keeps Next from silently falling back
     * to the outgoing song.
     */
    const flushBufferedSwap = () => {
      if (
        cancelled ||
        isDisposedRef.current ||
        !playbackAccepted ||
        !handoffComplete ||
        !bufferedForSwap
      ) {
        return;
      }
      const buffer = bufferedForSwap;
      bufferedForSwap = undefined;
      swapBufferToBlob(audio, track.id, buffer);
    };
    const cachedAnalysis = track.normalization;
    // Only the modules that actually consume a scanned profile. Clicks and the
    // neural module need nothing measured, so having them on is not a reason
    // to decode a file again.
    const denoiseNeedsProfile =
      dspSettingsRef.current.denoise.enabled &&
      dspSettingsRef.current.denoise.profileSource === 'scanned' &&
      (dspSettingsRef.current.denoise.hiss.enabled ||
        dspSettingsRef.current.denoise.hum.enabled);
    const shouldAnalyze =
      dspSettingsRef.current.enabled &&
      (dspSettingsRef.current.normalizer.mode !== 'off' ||
        // The crossfade needs the same decode pass: it cannot know when this
        // song stops without measuring where its last audible sample is.
        transition.enabled ||
        denoiseNeedsProfile ||
        (dspSettingsRef.current.master.enabled &&
          dspSettingsRef.current.master.loudnessMaximize));
    /**
     * Skip the incoming track's leading silence, but only on a handoff.
     *
     * Starting a song the user picked out of the list still begins where the
     * file begins; it is the overlap that has to land on music at both ends.
     * Cached measurements only — the file has not been decoded yet at this
     * point, so a track heard for the first time is trimmed from its second
     * play onwards.
     */
    const leadInMs =
      isCrossfading && cachedAnalysis?.edges
        ? cachedAnalysis.edges.leadInMs
        : 0;
    let deferredAnalysis: IDspInputAnalysisState | undefined;
    let deferredTrackGains: readonly [number, number] | undefined;
    /**
     * The incoming track's noise floor, held across the overlap like the gains.
     *
     * A separate flag rather than checking the profile for undefined, because
     * "no profile" is itself a value that has to be delivered: a track with no
     * scan must CLEAR the previous one, and treating undefined as "nothing to
     * publish" is what leaves the outgoing song's floor subtracting from the
     * incoming one.
     */
    let deferredNoiseProfile: INoiseProfile | undefined;
    let hasDeferredNoiseProfile = false;
    const publishAnalysis = (next: IDspInputAnalysisState) => {
      if (isCrossfading && !handoffComplete) {
        deferredAnalysis = next;
        return;
      }
      setDspInputAnalysis(next);
    };
    const publishTrackGains = (analysis: ILibraryTrack['normalization']) => {
      if (isCrossfading && !handoffComplete && !analysis) {
        // No measurement means there is no justified incoming-track gain yet.
        // Keep the outgoing pair through the overlap; when analysis arrives it
        // will begin one phase-locked transition from the level being heard.
        return;
      }
      const next = [
        normalizerGainDb(dspSettingsRef.current.normalizer, analysis),
        masterLoudnessGainDb(
          dspSettingsRef.current.master,
          dspSettingsRef.current.normalizer,
          analysis,
        ),
      ] as const;
      if (isCrossfading && !handoffComplete) {
        deferredTrackGains = next;
        // Deferred TOGETHER with the gains. Sending the floor now and the gain
        // at the handoff would have the stage subtract the incoming track's
        // noise from the outgoing track's audio for the length of the overlap.
        deferredNoiseProfile = analysis?.noise;
        hasDeferredNoiseProfile = true;
        return;
      }
      setDspTrackLevelGains(next[0], next[1]);
      // Published with the gains rather than separately, so the floor and the
      // level the stage sees always describe the same track. Undefined when
      // this one has no scan: keeping the previous song's profile would
      // subtract that recording's hiss from this one.
      setDspNoiseProfile(analysis?.noise);
    };
    const completeTrackHandoff = () => {
      handoffComplete = true;
      if (cancelled) {
        return;
      }
      setDspInputTrackId(track.id, true);
      if (deferredAnalysis) {
        setDspInputAnalysis(deferredAnalysis);
        deferredAnalysis = undefined;
      }
      if (deferredTrackGains) {
        setDspTrackLevelGains(deferredTrackGains[0], deferredTrackGains[1]);
        deferredTrackGains = undefined;
      }
      // Replayed here for the same reason the gains are. Without it the
      // engine keeps whatever floor the PREVIOUS track left behind for the
      // whole of the new one — the incoming song denoised against the outgoing
      // song's hiss, which is heard as the stage doing nothing useful and
      // reported as "not scanning on switch".
      if (hasDeferredNoiseProfile) {
        setDspNoiseProfile(deferredNoiseProfile);
        deferredNoiseProfile = undefined;
        hasDeferredNoiseProfile = false;
      } else {
        // Nothing deferred means no measurement existed for this track when
        // the overlap began — `publishTrackGains` returns early in that case
        // to hold the outgoing level. The overlap is over now and the audio is
        // entirely the incoming track, so the outgoing track's floor has to go
        // whether or not a replacement has arrived yet. One that arrives later
        // publishes itself through the ordinary path.
        setDspNoiseProfile(undefined);
      }
      flushBufferedSwap();
    };
    const analysisJob = shouldAnalyze
      ? { trackId: track.id, controller: new AbortController() }
      : undefined;
    analysisJobRef.current = analysisJob;
    publishAnalysis(
      cachedAnalysis
        ? {
            trackId: track.id,
            status: 'ready',
            fraction: 1,
            analysis: cachedAnalysis,
          }
        : {
            trackId: track.id,
            status: shouldAnalyze ? 'analyzing' : 'idle',
            fraction: 0,
          },
    );

    // Playback starts before the first await. Analysis is preparation for the
    // cache, never permission to hear the track; an uncached song must switch
    // just as quickly as one the library has already measured.
    publishTrackGains(cachedAnalysis);
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
      audio.volume = volumeRef.current;
      audio.load();
      setIsPlaying(false);
    } else {
      pendingRestore.current = undefined;
      audio.preload = 'auto';
      audio.volume = 0;
      /**
       * Nothing is heard until the element knows what it is holding.
       *
       * `play()` used to be called on the same tick as the `src` assignment,
       * so a deck could be producing sound while still at `HAVE_NOTHING` —
       * with no duration, no seekable range, and a `currentTime` that still
       * reads out of the source it has not finished replacing. Every write
       * that lands in that window lands on audio the listener is already
       * hearing, which is why a song switched away from and back to could
       * begin part-way in.
       *
       * Waiting costs nothing audible: the element has to reach
       * `loadedmetadata` before it can render a sample anyway. It only moves
       * the app's decisions to the far side of that line.
       *
       * `error` resolves it too. A file that will never produce metadata must
       * still reach `play()`, because its rejection is what raises the
       * unplayable notice — a silent deck waiting forever would be the worse
       * failure, and it is the one this file has already shipped once.
       *
       * Those two events are the whole condition — there is no deadline here
       * on purpose. A timer would be guessing at how long a disk is allowed to
       * take, and it would guess wrong on the machine that needed it most. An
       * element that has neither announced itself nor failed is still reading,
       * and playing before it can render a sample buys nothing.
       */
      const metadataReady = new Promise<void>((resolve) => {
        const settle = () => {
          audio.removeEventListener('loadedmetadata', settle);
          audio.removeEventListener('error', settle);
          resolve();
        };
        audio.addEventListener('loadedmetadata', settle);
        audio.addEventListener('error', settle);
      });
      metadataReady
        .then(() => (cancelled ? undefined : audio.play()))
        .then(() => {
          if (!cancelled) {
            playbackAccepted = true;
            if (isCrossfading) {
              if (leadInMs >= MIN_LEAD_IN_TRIM_MS) {
                // Here and not beside the `src` assignment: an element at
                // `HAVE_NOTHING` records the seek against a resource whose
                // ranges are unknown and then refuses every later one — the
                // same trap the comment above `audio.src` describes. A
                // settled `play()` means the decoder has data, so this lands.
                leadInSeekRef.current.add(audio);
                audio.currentTime = leadInMs / 1_000;
                setPositionMs(leadInMs);
              }
              // The incoming decoder owns transport only after it has actually
              // started. Taking ownership before `play()` settled let a slow
              // or rejected alternate deck capture Next/Previous and made the
              // working song unreachable.
              audioElementRef.current = audio;
              transitionStarted = true;
              startCrossfade(
                outgoing,
                audio,
                transition.durationMs,
                transition.curve,
                transition.shape,
                () => {
                  completeTrackHandoff();
                },
              );
            } else {
              fadeIn(audio, TRACK_FADE_IN_MS);
              flushBufferedSwap();
            }
          }
          return undefined;
        })
        .catch((error: unknown) => {
          if (isCrossfading && !cancelled) {
            reportDspDiagnostic({
              schemaVersion: DSP_DIAGNOSTIC_SCHEMA_VERSION,
              code: DSP_DIAGNOSTIC_CODES.crossfadePlayFailed,
              severity: 'error',
              origin: 'renderer',
              values: {
                trackId: track.id,
                ...dspErrorValues(error),
              },
            });
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
            audioElementRef.current = outgoing;
            selectDspDeck(outgoing);
          }
          return undefined;
        });
    }

    const prepareInBackground = async () => {
      const [buffer, signature] = await Promise.all([
        window.electron.ipcRenderer.libraryTrackBytes(track.id),
        shouldAnalyze
          ? window.electron.ipcRenderer.libraryTrackSignature(track.id)
          : Promise.resolve(undefined),
      ]);
      if (!buffer || cancelled) {
        if (shouldAnalyze && !cachedAnalysis && !cancelled) {
          publishAnalysis({
            trackId: track.id,
            status: 'unavailable',
            fraction: 0,
          });
        }
        return;
      }
      // Keep the bytes ready, but do not replace the media source while its
      // first `play()` or an active crossfade still owns the decoder.
      bufferedForSwap = buffer;
      flushBufferedSwap();
      if (!shouldAnalyze) {
        return;
      }
      const needsFreshAnalysis =
        !cachedAnalysis ||
        !signature ||
        signature.sizeBytes !== track.sizeBytes ||
        signature.mtimeMs !== track.mtimeMs ||
        // An entry measured before the edges existed still holds correct
        // loudness numbers, so it is only worth decoding the file again for
        // the one feature that needs the missing half.
        (!cachedAnalysis.edges && transition.enabled) ||
        // Same rule for the noise floor, added the same way and for the same
        // reason: no version bump, no library-wide re-measure, just one more
        // decode for the one track whose missing half is now wanted.
        (!cachedAnalysis.noise && denoiseNeedsProfile);
      if (!needsFreshAnalysis) {
        return;
      }
      if (!analysisJob) {
        return;
      }
      const analysis = await analyzeInputTrack(buffer, {
        sampleRateHint: track.sampleRate,
        signal: analysisJob.controller.signal,
        isCancelled: () => cancelled || analysisJobRef.current !== analysisJob,
        measureNoise: denoiseNeedsProfile,
        onProgress: ({ fraction }) => {
          if (
            !cachedAnalysis &&
            !cancelled &&
            analysisJobRef.current === analysisJob
          ) {
            publishAnalysis({
              trackId: track.id,
              status: 'analyzing',
              fraction,
            });
          }
        },
      });
      if (!analysis || cancelled || analysisJobRef.current !== analysisJob) {
        if (
          !analysis &&
          !cachedAnalysis &&
          !cancelled &&
          analysisJobRef.current === analysisJob &&
          !analysisJob.controller.signal.aborted
        ) {
          publishAnalysis({
            trackId: track.id,
            status: 'unavailable',
            fraction: 0,
          });
        }
        return;
      }
      const changed = normalizationChanged(cachedAnalysis, analysis);
      // Straight onto the deck, without waiting for the index round trip: on
      // a first play this measurement is the only thing that knows where the
      // track stops, and it has to be in place before its own ending arrives.
      if (analysis.edges && elementTrackRef.current.get(audio) === track.id) {
        programmeEdgesRef.current.set(audio, analysis.edges);
      }
      publishAnalysis({
        trackId: track.id,
        status: 'ready',
        fraction: 1,
        analysis,
      });
      if (changed) {
        publishTrackGains(analysis);
        await window.electron.ipcRenderer.setLibraryTrackNormalization(
          track.id,
          analysis,
          signature ?? {
            sizeBytes: track.sizeBytes,
            mtimeMs: track.mtimeMs,
          },
        );
      }
    };

    prepareInBackground()
      .catch(() => {
        if (
          shouldAnalyze &&
          !cachedAnalysis &&
          !cancelled &&
          analysisJobRef.current === analysisJob &&
          !analysisJob?.controller.signal.aborted
        ) {
          publishAnalysis({
            trackId: track.id,
            status: 'unavailable',
            fraction: 0,
          });
        }
      })
      .finally(() => {
        if (analysisJobRef.current === analysisJob) {
          analysisJobRef.current = undefined;
        }
      });
    return () => {
      cancelled = true;
      bufferedForSwap = undefined;
      if (isCrossfading && !transitionStarted) {
        audio.pause();
        releaseBlob(audio);
        audio.removeAttribute('src');
        audio.load();
        audioElementRef.current = outgoing;
        selectDspDeck(outgoing);
      }
      analysisJob?.controller.abort();
      if (analysisJobRef.current === analysisJob) {
        analysisJobRef.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberate, see the comment above this effect.
  }, [trackId, loadRequest]);

  /**
   * Measure the NEXT track while this one plays.
   *
   * Without this, an uncached track starts at raw unity and steps to its
   * chosen gain over two seconds once the analysis lands — an audible level
   * move at the top of a song, and the one place where per-track loudness
   * matching is heard doing its job instead of doing it invisibly. It is also
   * the worst possible moment for it: the opening bars are where somebody is
   * deciding whether the record is at the right level.
   *
   * Measured here rather than made faster, because the decode is the cost and
   * the decode cannot be skipped. A track measured before it is reached starts
   * at its final gain from the first sample.
   *
   * Deliberately subordinate to the playing track's own analysis: while
   * `analysisJobRef` holds a job, the audible track is still being measured
   * and two full decodes at once would make the window drop frames to prepare
   * a song nobody is listening to yet.
   */
  useEffect(() => {
    const wantsLoudness =
      dspSettings.normalizer.mode !== 'off' ||
      (dspSettings.master.enabled && dspSettings.master.loudnessMaximize);
    if (!dspSettings.enabled || !wantsLoudness || !queue || !track) {
      return undefined;
    }
    // The queue's own rules decide what comes next — shuffle order, repeat,
    // the end of the shelf. Reimplementing them here is how a prefetch comes
    // to measure a track the player was never going to reach.
    const nextId = currentTrackId(advanceQueue(queue, 1));
    const next =
      nextId && nextId !== track.id ? trackById.get(nextId) : undefined;
    if (
      !next ||
      next.kind !== 'audio' ||
      next.normalization ||
      analysisJobRef.current
    ) {
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();
    const measure = async () => {
      const [buffer, signature] = await Promise.all([
        window.electron.ipcRenderer.libraryTrackBytes(next.id),
        window.electron.ipcRenderer.libraryTrackSignature(next.id),
      ]);
      if (!buffer || cancelled) {
        return;
      }
      const analysis = await analyzeInputTrack(buffer, {
        sampleRateHint: next.sampleRate,
        signal: controller.signal,
        // Yields to the playing track: if its loader starts a job mid-decode,
        // this one stops rather than competing for the same window.
        isCancelled: () => cancelled || analysisJobRef.current !== undefined,
        // Nothing is published while this runs. The panel's progress belongs
        // to the track being listened to, and a second bar for a song that has
        // not started reads as the current one having gone backwards.
        onProgress: () => undefined,
      });
      if (!analysis || cancelled) {
        return;
      }
      await window.electron.ipcRenderer.setLibraryTrackNormalization(
        next.id,
        analysis,
        signature ?? {
          sizeBytes: next.sizeBytes,
          mtimeMs: next.mtimeMs,
        },
      );
    };
    measure().catch(() => undefined);
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dspSettings, queue, track, trackById]);

  /**
   * Enabling normalization or the crossfade while an already-playing uncached
   * track is active.
   *
   * The ordinary loader already measures in the background. This path exists
   * for the one situation where it deliberately did not: the track was
   * started while both were off. The linked gain ramps once when analysis
   * completes; it never follows short-term level afterwards.
   */
  useEffect(() => {
    const wantsLoudness =
      (dspSettings.normalizer.mode !== 'off' ||
        (dspSettings.master.enabled && dspSettings.master.loudnessMaximize)) &&
      !track?.normalization;
    // A track already measured for loudness can still be missing its edges,
    // either because it was analyzed before they were measured at all or
    // because the crossfade was switched on after it started.
    const wantsEdges =
      dspSettings.crossfade.enabled && !track?.normalization?.edges;
    // Same shape as the edges above: a track measured before Denoise existed,
    // or measured while the stage was off, is still missing this half.
    const wantsNoise =
      dspSettings.denoise.enabled &&
      dspSettings.denoise.profileSource === 'scanned' &&
      (dspSettings.denoise.hiss.enabled || dspSettings.denoise.hum.enabled) &&
      !track?.normalization?.noise;
    if (
      !dspSettings.enabled ||
      (!wantsLoudness && !wantsEdges && !wantsNoise) ||
      !track ||
      track.kind !== 'audio' ||
      analysisJobRef.current?.trackId === track.id
    ) {
      return undefined;
    }
    let cancelled = false;
    analysisJobRef.current?.controller.abort();
    const analysisJob = {
      trackId: track.id,
      controller: new AbortController(),
    };
    analysisJobRef.current = analysisJob;
    setDspInputAnalysis({
      trackId: track.id,
      status: 'analyzing',
      fraction: 0,
    });
    const analyze = async () => {
      const [buffer, signature] = await Promise.all([
        window.electron.ipcRenderer.libraryTrackBytes(track.id),
        window.electron.ipcRenderer.libraryTrackSignature(track.id),
      ]);
      if (!buffer || cancelled) {
        return;
      }
      const analysis = await analyzeInputTrack(buffer, {
        sampleRateHint: track.sampleRate,
        signal: analysisJob.controller.signal,
        isCancelled: () => cancelled || analysisJobRef.current !== analysisJob,
        measureNoise: wantsNoise,
        onProgress: ({ fraction }) => {
          if (!cancelled && analysisJobRef.current === analysisJob) {
            setDspInputAnalysis({
              trackId: track.id,
              status: 'analyzing',
              fraction,
            });
          }
        },
      });
      if (
        !analysis ||
        cancelled ||
        analysisJobRef.current !== analysisJob ||
        trackIdRef.current !== track.id
      ) {
        if (
          !analysis &&
          !cancelled &&
          analysisJobRef.current === analysisJob &&
          !analysisJob.controller.signal.aborted
        ) {
          setDspInputAnalysis({
            trackId: track.id,
            status: 'unavailable',
            fraction: 0,
          });
        }
        return;
      }
      const deck = audioElementRef.current;
      if (
        analysis.edges &&
        deck &&
        elementTrackRef.current.get(deck) === track.id
      ) {
        programmeEdgesRef.current.set(deck, analysis.edges);
      }
      setDspInputAnalysis({
        trackId: track.id,
        status: 'ready',
        fraction: 1,
        analysis,
      });
      setDspTrackLevelGains(
        normalizerGainDb(dspSettingsRef.current.normalizer, analysis),
        masterLoudnessGainDb(
          dspSettingsRef.current.master,
          dspSettingsRef.current.normalizer,
          analysis,
        ),
      );
      await window.electron.ipcRenderer.setLibraryTrackNormalization(
        track.id,
        analysis,
        signature ?? {
          sizeBytes: track.sizeBytes,
          mtimeMs: track.mtimeMs,
        },
      );
    };
    analyze()
      .catch(() => {
        if (
          !cancelled &&
          analysisJobRef.current === analysisJob &&
          !analysisJob.controller.signal.aborted
        ) {
          setDspInputAnalysis({
            trackId: track.id,
            status: 'unavailable',
            fraction: 0,
          });
        }
      })
      .finally(() => {
        if (analysisJobRef.current === analysisJob) {
          analysisJobRef.current = undefined;
        }
      });
    return () => {
      cancelled = true;
      analysisJob.controller.abort();
      if (analysisJobRef.current === analysisJob) {
        analysisJobRef.current = undefined;
      }
    };
  }, [
    dspSettings.crossfade.enabled,
    dspSettings.denoise.enabled,
    dspSettings.denoise.hiss.enabled,
    dspSettings.denoise.hum.enabled,
    dspSettings.denoise.profileSource,
    dspSettings.enabled,
    dspSettings.master.enabled,
    dspSettings.master.loudnessMaximize,
    dspSettings.normalizer.mode,
    track,
    trackId,
  ]);

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
        setLoadRequest((current) => current + 1);
        return;
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
    /**
     * Ask the engine that is playing, not the one that is only loaded.
     *
     * While the host owns the transport the element is paused and holding the
     * file as a fallback, so `element.paused` answers "yes" forever and this
     * would have called `play()` on it every time — starting the second
     * decoder the pause exists to stop, and restarting the sound in the
     * element as well as the host on any deck the host had failed to open.
     *
     * The state IS the request here. `sync` carries it to the host on the very
     * next tick, which is where a play or a pause actually happens.
     */
    if (hostOwnsTransportRef.current) {
      setIsPlaying((playing) => {
        if (playing) {
          releasePlayback('library');
        } else {
          claimPlayback('library');
        }
        return !playing;
      });
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
      const ahead = current.order
        .slice(current.position + 1)
        .map((index) => current.trackIds[index])
        .filter((id): id is string => id !== undefined);
      const pending = ahead.filter((id) => addedIdsRef.current.has(id));
      // AND WHAT THE PLAYER DREW FOR ITSELF SURVIVES TOO — AT THE END.
      //
      // Continuation is not part of the context either: it exists precisely
      // because the context ran out. Left to be rebuilt, it was: this
      // callback runs on every track change, so a seven-track album with
      // continuation on dropped its ten drawn songs and drew ten different
      // ones after every single track. The panel then listed a different
      // "more like this" every three minutes with nothing having been asked
      // for — the same shape as the re-shuffle bug two comments down, and
      // the same report: something changing by itself.
      //
      // At the END rather than after the playhead, which is the one way this
      // differs from the picks above: what follows the current track is the
      // rest of the record, and a guess is what comes after all of it.
      const continued = ahead.filter(
        (id) => !addedIdsRef.current.has(id) && continuedIdsRef.current.has(id),
      );
      const pendingSet = new Set([...pending, ...continued]);
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
      const kept = base.trackIds.length;
      const next =
        pending.length === 0 && continued.length === 0
          ? base
          : {
              ...base,
              trackIds: [...base.trackIds, ...pending, ...continued],
              order: (() => {
                const order = [...base.order];
                order.splice(
                  base.position + 1,
                  0,
                  ...pending.map((_, index) => kept + index),
                );
                order.push(
                  ...continued.map((_, index) => kept + pending.length + index),
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
   * KEEP PLAYING WHEN THE LIST RUNS OUT.
   *
   * A queue is whatever shelf was being read, and a shelf ends: `advanceQueue`
   * holds at the last entry and `handleEnded` stops there. That is right for a
   * player with nothing queued and wrong for somebody who put a record on —
   * the answer arrives as silence with no explanation, which is the shape of
   * failure this project's rules are written against.
   *
   * So when the run ahead gets short, more of the same genre is drawn from
   * the whole library and appended. `pickContinuation` owns the choosing and
   * is pure; this owns only when to ask.
   *
   * NOT A TIMER, and it must never become one: the condition is how much is
   * left ahead of the playhead, which changes exactly when the queue does.
   */
  const [isContinuationOn, setIsContinuationOn] = useState<boolean>(
    readStoredContinuation,
  );
  useEffect(() => {
    writeStoredContinuation(isContinuationOn);
  }, [isContinuationOn]);

  /** Ids this drew, so the panel can head them as their own run rather than
   * passing them off as the rest of the record. */
  const [continuedIds, setContinuedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Read by `retargetQueue` for the same reason `addedIdsRef` is: that
  // callback has no dependencies and must see the set as it is when the view
  // changes, not as it was when the callback was made.
  const continuedIdsRef = useRef(continuedIds);
  continuedIdsRef.current = continuedIds;

  /**
   * Everything played this session.
   *
   * Kept so continuation never hands back a song that has just been heard —
   * a genre of forty tracks would otherwise start repeating itself inside an
   * hour, which reads as the feature being broken rather than as a small
   * pool. A ref rather than state: nothing renders from it, and a set that
   * grew by one every three minutes would re-render every consumer of this
   * context for it.
   */
  const playedIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (trackId !== undefined) {
      playedIds.current.add(trackId);
    }
  }, [trackId]);

  useEffect(() => {
    // `repeat` other than 'off' means the queue never runs out — 'all' wraps
    // and 'one' holds — so there is nothing here to answer.
    if (!isContinuationOn || !queue || queue.repeat !== 'off') {
      return;
    }
    const ahead = queue.order.length - queue.position - 1;
    if (ahead >= CONTINUATION_LOW_WATER) {
      return;
    }
    const playing = currentTrackId(queue);
    const seed = playing === undefined ? undefined : trackById.get(playing);
    // A film ending is not a request for more films. Continuation is about
    // music carrying on in the background; `pickContinuation` draws audio
    // only, and seeding it from a video would answer a question nobody asked.
    if (!seed || seed.kind !== 'audio') {
      return;
    }
    const exclude = new Set([...queue.trackIds, ...playedIds.current]);
    const picked = pickContinuation(index.tracks, seed, exclude);
    if (picked.length === 0) {
      // Nothing left in the genre that has not been heard. The player stops
      // at the end of the run, which is the honest answer — better than
      // starting the same forty songs again without being asked.
      return;
    }
    setContinuedIds((current) => {
      const next = new Set(current);
      picked.forEach((id) => next.add(id));
      return next;
    });
    // AT THE END, not after the playhead: what sits directly after the
    // current track is the listener's own picks, and a continuation that
    // pushed itself in front of them would answer a decision they made with
    // a guess this made.
    setQueue((current) => {
      if (!current) {
        return current;
      }
      const base = current.trackIds.length;
      return {
        ...current,
        trackIds: [...current.trackIds, ...picked],
        order: [...current.order, ...picked.map((_, index) => base + index)],
      };
    });
  }, [isContinuationOn, queue, index.tracks, trackById]);

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
          // Drawn by continuation rather than by the shelf. A third answer to
          // the same question the two above split, and it has to be its own:
          // heading a guess as "then" would claim the record does not end.
          isContinued: trackId !== undefined && continuedIds.has(trackId),
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          position: number;
          trackId: string;
          isAdded: boolean;
          isContinued: boolean;
        } => entry.trackId !== undefined,
      );
  }, [addedIds, continuedIds, queue]);

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

  const skip = useCallback(
    (direction: 1 | -1) => {
      if (
        direction === -1 &&
        publishedPositionMs > PREVIOUS_RESTART_THRESHOLD_MS
      ) {
        const element = activeElement();
        if (element) {
          // Close any overlap before rewinding the deck that now owns the
          // transport. A second Previous sees position zero and advances to the
          // actual previous queue item.
          finishCrossfadeRef.current?.();
          startSeekFade(element);
          element.currentTime = 0;
        }
        setPositionMs(0);
        return;
      }
      setQueue((current) =>
        current ? advanceQueue(current, direction) : current,
      );
    },
    [activeElement, publishedPositionMs, startSeekFade, finishCrossfadeRef],
  );

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

  /**
   * Move the fader. Audible immediately, not written to disk.
   *
   * The split is what keeps a drag smooth. The effect on `volume` above sets
   * the element on every change, so the sound tracks the pointer with nothing
   * in between; what does NOT happen per change is the `localStorage` write,
   * which is synchronous and would land on the main thread a hundred times
   * across one drag of a `step={0.01}` slider.
   */
  const setVolume = useCallback((value: number) => {
    setVolumeState(clampVolume(value));
  }, []);

  /**
   * Remember where the fader was left.
   *
   * Called when a gesture ends — pointer released, key lifted, mute toggled —
   * rather than on every value. Reads from the ref instead of taking an
   * argument so a caller cannot commit a value the player is not actually at.
   */
  const commitVolume = useCallback(() => {
    writeStoredVolume(volumeRef.current);
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
