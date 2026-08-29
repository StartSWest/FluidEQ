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
import { TCrossfadeCurve } from '../../../common/dsp/chain';
import {
  DSP_DIAGNOSTIC_CODES,
  DSP_DIAGNOSTIC_SCHEMA_VERSION,
} from '../../../common/dsp/diagnostics';
import {
  scheduleDspDeckCrossfade,
  selectDspDeck,
} from '../../dsp/deckCrossfade';
import { dspErrorValues, reportDspDiagnostic } from '../../dsp/diagnostics';
import {
  setDspInputTrackId,
  setDspTrackLevelGains,
  useDspEngine,
} from '../../dsp/useDspEngine';
import {
  useNativeBackend,
  useNativeMeters,
  useNativeMirror,
} from '../../dsp/useNativeBackend';
import {
  analyzeInputTrack,
  masterLoudnessGainDb,
  normalizerGainDb,
} from '../../dsp/inputNormalizer';
import {
  IDspInputAnalysisState,
  setDspInputAnalysis,
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

const REPEAT_CYCLE: readonly TLibraryRepeat[] = ['off', 'all', 'one'];

const nextRepeat = (repeat: TLibraryRepeat): TLibraryRepeat =>
  REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(repeat) + 1) % REPEAT_CYCLE.length];

const clampVolume = (value: number): number => Math.min(1, Math.max(0, value));

const normalizationChanged = (
  previous: ILibraryTrack['normalization'],
  next: NonNullable<ILibraryTrack['normalization']>,
): boolean =>
  !previous ||
  previous.version !== next.version ||
  Math.abs(previous.truePeakDbtp - next.truePeakDbtp) >= 0.01 ||
  Math.abs(previous.integratedLufs - next.integratedLufs) >= 0.01;

/**
 * How long the level takes to come back after a seek.
 *
 * Long enough to cover the decoder's re-sync and short enough that nobody
 * reads it as a fade — about four frames. Ramped on `requestAnimationFrame`
 * rather than a timer: a timer would keep the renderer awake on a schedule of
 * its own, and this has to run in step with what is already being painted.
 */
const SEEK_FADE_MS = 70;
/** Pop-free source handoff; longer than a seek because the decoder is new. */
const TRACK_FADE_IN_MS = 80;
/** Past this point Previous restarts first; inside it, Previous changes track. */
const PREVIOUS_RESTART_THRESHOLD_MS = 10_000;

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
  /** Idempotent ownership handoff for the one transition allowed at a time. */
  const finishCrossfadeRef = useRef<(() => void) | undefined>(undefined);
  const crossfadeCompletionRef = useRef<number | undefined>(undefined);
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
    isDisposedRef.current = false;
    return () => {
      isDisposedRef.current = true;
      finishCrossfadeRef.current?.();
      audioElements.forEach((audio) => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      });
    };
  }, [audioElements]);

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
  const nativeMirror = useNativeMirror(nativeBackend, audioElements, {
    mediaPath: track?.path,
    isPlaying,
    positionMs,
    volume,
  });

  /** The object URL currently backing the element, so it can be revoked when
   * the next track replaces it. A blob URL that is never revoked pins its
   * whole buffer for the life of the window. */
  const blobUrlsRef = useRef(new Map<HTMLAudioElement, string>());
  const analysisJobRef = useRef<
    | {
        trackId: string;
        controller: AbortController;
      }
    | undefined
  >(undefined);

  /** The running fade-in, so a second seek arriving mid-ramp cancels the
   * first rather than fighting it for the volume property. */
  const fadeFrameRef = useRef(0);
  /** Prevents one track end advancing the queue more than once. */
  const naturalCrossfadeTrackRef = useRef<string | undefined>(undefined);

  const fadeIn = useCallback(
    (element: HTMLMediaElement, durationMs = SEEK_FADE_MS) => {
      cancelAnimationFrame(fadeFrameRef.current);
      const target = volumeRef.current;
      const started = performance.now();
      const step = () => {
        const progress = Math.min(
          1,
          (performance.now() - started) / durationMs,
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
    },
    [],
  );
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
   * superseded — see `swapBufferToBlob`, where it is set.
   *
   * A `{ once: true }` listener that never fires is never removed either. The
   * element outlives every track, so an abandoned swap left its handler
   * sitting on it waiting for *somebody's* metadata — and the next track's
   * would do: the new song would load and immediately jump to the previous
   * one's playhead, and start playing if the previous one had been. One
   * stale listener per abandoned swap, and each one wrong.
   */
  const pendingSwapsRef = useRef(new Map<HTMLAudioElement, () => void>());

  const releaseBlob = useCallback((element: HTMLAudioElement) => {
    pendingSwapsRef.current.get(element)?.();
    const blobUrl = blobUrlsRef.current.get(element);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      blobUrlsRef.current.delete(element);
    }
  }, []);

  const startCrossfade = useCallback(
    (
      outgoing: HTMLAudioElement,
      incoming: HTMLAudioElement,
      durationMs: number,
      curve: TCrossfadeCurve,
      incomingPath?: string,
      onFinished?: () => void,
    ) => {
      finishCrossfadeRef.current?.();
      const target = volumeRef.current;
      outgoing.volume = target;
      incoming.volume = target;
      const scheduled = scheduleDspDeckCrossfade(
        outgoing,
        incoming,
        durationMs,
        curve,
      );
      /**
       * The same fade, on the native engine's own two decks.
       *
       * Both are started, not one or the other. The element fade above is
       * running on muted elements while the native engine is audible, and it
       * is what keeps the meter, the cue point and the queue's advance
       * behaving identically on either engine — removing it would make the
       * two paths differ in everything except the sound.
       *
       * Not awaited, and its failure is not this function's business: the
       * mirror hands the audio back to the elements when it cannot load a
       * file, and a handoff that waited on the native decoder would stall the
       * song change on every engine for the sake of one.
       */
      if (incomingPath) {
        nativeMirror.crossfade(incomingPath, durationMs, curve).catch(() => {
          reportDspDiagnostic({
            schemaVersion: DSP_DIAGNOSTIC_SCHEMA_VERSION,
            code: DSP_DIAGNOSTIC_CODES.crossfadeDeckFallback,
            severity: 'warn',
            origin: 'renderer',
            values: { durationMs, curve },
          });
        });
      }
      let finished = false;
      const finish = () => {
        if (finished) {
          return;
        }
        finished = true;
        if (crossfadeCompletionRef.current !== undefined) {
          window.clearTimeout(crossfadeCompletionRef.current);
          crossfadeCompletionRef.current = undefined;
        }
        outgoing.pause();
        releaseBlob(outgoing);
        outgoing.removeAttribute('src');
        outgoing.load();
        outgoing.volume = target;
        incoming.volume = target;
        selectDspDeck(incoming);
        onFinished?.();
        if (finishCrossfadeRef.current === finish) {
          finishCrossfadeRef.current = undefined;
        }
      };
      finishCrossfadeRef.current = finish;
      if (!scheduled) {
        // An unavailable Web Audio mixer cannot be allowed to create two
        // direct-output players. Make the switch atomically instead.
        finish();
        return;
      }
      // This timer owns decoder/resource cleanup, not the fade. The fade is
      // already scheduled on the audio clock, so throttling this callback can
      // delay `pause()` but can never leave the outgoing song audible.
      crossfadeCompletionRef.current = window.setTimeout(
        finish,
        Math.max(1, durationMs) + 50,
      );
    },
    [releaseBlob, nativeMirror],
  );

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
  const swapBufferToBlob = useCallback(
    (element: HTMLAudioElement, forTrackId: string, buffer: ArrayBuffer) => {
      if (trackIdRef.current !== forTrackId) {
        return;
      }
      const wasPlaying = !element.paused;
      const at = element.currentTime;
      releaseBlob(element);
      const blobUrl = URL.createObjectURL(new Blob([buffer]));
      blobUrlsRef.current.set(element, blobUrl);
      element.src = blobUrl;
      // Putting the playhead back is what makes the swap invisible; without
      // it the track would jump to its beginning a second in.
      //
      // Registered so it can be taken off again: `once` removes a listener
      // that fires, and this one has to survive being abandoned — see
      // `cancelPendingSwap`.
      const onSwapped = () => {
        pendingSwapsRef.current.delete(element);
        element.currentTime = at;
        if (wasPlaying) {
          element.play().catch(() => undefined);
        }
      };
      element.addEventListener('loadedmetadata', onSwapped, { once: true });
      pendingSwapsRef.current.set(element, () => {
        element.removeEventListener('loadedmetadata', onSwapped);
        pendingSwapsRef.current.delete(element);
      });
      element.load();
    },
    [releaseBlob],
  );

  /** Read inside `swapBufferToBlob`'s continuation, where the `trackId` it
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

  const bindMediaEvents = useCallback(
    (element: HTMLMediaElement): (() => void) => {
      const isActive = () =>
        element === (videoElementRef.current ?? audioElementRef.current);
      // `timeupdate` fires about four times a second — the right cadence for
      // a number that changes once a second on screen, and no reason to add
      // a `requestAnimationFrame` loop on top of it.
      const onTimeUpdate = () => {
        if (!isActive()) {
          return;
        }
        setPositionMs(element.currentTime * 1000);
        const { current } = queueRef;
        const transition = dspSettingsRef.current.crossfade;
        const playingId = current ? currentTrackId(current) : undefined;
        const { duration } = element;
        const remainingMs = (duration - element.currentTime) * 1_000;
        if (
          element === audioElementRef.current &&
          dspSettingsRef.current.enabled &&
          transition.enabled &&
          current &&
          current.repeat !== 'one' &&
          playingId &&
          naturalCrossfadeTrackRef.current !== playingId &&
          Number.isFinite(duration) &&
          remainingMs > 0 &&
          remainingMs <= transition.durationMs &&
          (!queueAtEnd(current) || current.repeat === 'all')
        ) {
          naturalCrossfadeTrackRef.current = playingId;
          setQueue(advanceQueue(current, 1));
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
        releasePlayback('library');
        setIsPlaying(false);
      };
      const onEnded = () => {
        if (isActive()) {
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
    [handleEnded],
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
    const shouldAnalyze =
      dspSettingsRef.current.enabled &&
      (dspSettingsRef.current.normalizer.mode !== 'off' ||
        (dspSettingsRef.current.master.enabled &&
          dspSettingsRef.current.master.loudnessMaximize));
    let deferredAnalysis: IDspInputAnalysisState | undefined;
    let deferredTrackGains: readonly [number, number] | undefined;
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
        return;
      }
      setDspTrackLevelGains(next[0], next[1]);
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
      audio
        .play()
        .then(() => {
          if (!cancelled) {
            playbackAccepted = true;
            if (isCrossfading) {
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
                // The incoming file, for the native decks. The element beside
                // it is fed a blob URL, which is not something a native
                // decoder can open.
                track.path,
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
        signature.mtimeMs !== track.mtimeMs;
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
   * Enabling normalization while an already-playing uncached track is active.
   *
   * The ordinary loader already measures in the background. This path exists
   * for the one situation where it deliberately did not: the track was
   * started while the mode was Off. The linked gain ramps once when analysis
   * completes; it never follows short-term level afterwards.
   */
  useEffect(() => {
    if (
      !dspSettings.enabled ||
      (dspSettings.normalizer.mode === 'off' &&
        (!dspSettings.master.enabled ||
          !dspSettings.master.loudnessMaximize)) ||
      !track ||
      track.kind !== 'audio' ||
      track.normalization ||
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
      if (direction === -1 && positionMs > PREVIOUS_RESTART_THRESHOLD_MS) {
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
    [activeElement, positionMs, startSeekFade],
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
      positionMs,
      durationMs,
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
