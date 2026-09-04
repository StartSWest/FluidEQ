/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Putting a track on a deck, which is the largest single thing the player does.
 *
 * Everything between choosing a track and hearing it: releasing the previous
 * source, deciding whether this is a cue or a handoff, driving the overlap,
 * reading the file for the blob swap, running any required loudness analysis,
 * loading a saved noise profile, and publishing what all of that produced.
 *
 * The dependency list below is long and is meant to be looked at. This effect
 * closes over most of the player's state, and that coupling was invisible
 * while it lived inside the provider — the point of naming every piece is that
 * a reader can see the surface before they change something inside it. Almost
 * all of it is refs, because the effect outlives the render that started it:
 * the disk read, the decode and the crossfade completion all land later, and a
 * value captured at the start would describe a track that has since changed.
 *
 * Keyed on the track id ALONE. A rescan refreshing this same track's tags must
 * not restart what is already playing, which is exactly what would happen if
 * `track` or `trackById` were dependencies too.
 */
import { MutableRefObject, useEffect } from 'react';
import { IDspSettings, TCrossfadeCurve } from '../../../common/dsp/chain';
import {
  DSP_DIAGNOSTIC_CODES,
  DSP_DIAGNOSTIC_SCHEMA_VERSION,
} from '../../../common/dsp/diagnostics';
import { INoiseProfile } from '../../../common/dsp/noiseProfile';
import { libraryMediaUrl } from '../../../common/library/mediaUrl';
import {
  ILibraryProgrammeEdges,
  ILibraryTrack,
} from '../../../common/library/types';
import { selectDspDeck } from '../../dsp/deckCrossfade';
import { dspErrorValues, reportDspDiagnostic } from '../../dsp/diagnostics';
import {
  analyzeInputTrack,
  masterLoudnessGainDb,
  normalizerGainDb,
} from '../../dsp/inputNormalizer';
import { IDspInputAnalysisState, setDspInputAnalysis } from '../../dsp/store';
import {
  setDspNoiseProfile,
  setDspTrackLevelGains,
} from '../../dsp/useDspEngine';
import { ICrossfadeShape } from '../../../common/dsp/crossfadeShape';
import {
  MIN_LEAD_IN_TRIM_MS,
  TRACK_FADE_IN_MS,
  normalizationChanged,
} from './playerContract';

export interface ITrackLoaderDeps {
  /** What to load. The effect is keyed on the id alone; see above. */
  trackId: string | undefined;
  track: ILibraryTrack | undefined;
  /** Bumped to force a reload of the same id — a retry after a failure. */
  loadRequest: number;
  audioElements: readonly HTMLAudioElement[];

  audioElementRef: MutableRefObject<HTMLAudioElement | undefined>;
  dspSettingsRef: MutableRefObject<IDspSettings>;
  elementTrackRef: MutableRefObject<Map<HTMLMediaElement, string>>;
  programmeEdgesRef: MutableRefObject<
    Map<HTMLMediaElement, ILibraryProgrammeEdges>
  >;
  freshLoadRef: MutableRefObject<Set<HTMLMediaElement>>;
  leadInSeekRef: MutableRefObject<Set<HTMLMediaElement>>;
  naturalCrossfadeTrackRef: MutableRefObject<string | undefined>;
  finishCrossfadeRef: MutableRefObject<(() => void) | undefined>;
  fadeFrameRef: MutableRefObject<number>;
  volumeRef: MutableRefObject<number>;
  isDisposedRef: MutableRefObject<boolean>;
  analysisJobRef: MutableRefObject<
    { trackId: string; controller: AbortController } | undefined
  >;
  pendingRestore: MutableRefObject<
    { trackId: string; positionMs: number } | undefined
  >;

  fadeIn: (element: HTMLMediaElement, durationMs?: number) => void;
  releaseBlob: (element: HTMLAudioElement) => void;
  swapBufferToBlob: (
    element: HTMLAudioElement,
    forTrackId: string,
    buffer: ArrayBuffer,
  ) => void;
  startCrossfade: (
    outgoing: HTMLAudioElement,
    incoming: HTMLAudioElement,
    durationMs: number,
    curve: TCrossfadeCurve,
    shape: ICrossfadeShape,
    onFinished?: () => void,
  ) => void;

  setPositionMs: (value: number) => void;
  setDurationMs: (value: number) => void;
  setIsPlaying: (value: boolean) => void;
  setIsUnplayable: (value: boolean) => void;
}

export const useTrackLoader = (deps: ITrackLoaderDeps): void => {
  const {
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
  } = deps;

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
    const shouldAnalyze =
      dspSettingsRef.current.enabled &&
      (dspSettingsRef.current.normalizer.mode !== 'off' ||
        // The crossfade needs the same decode pass: it cannot know when this
        // song stops without measuring where its last audible sample is.
        transition.enabled ||
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
        (!cachedAnalysis.edges && transition.enabled);
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
};
