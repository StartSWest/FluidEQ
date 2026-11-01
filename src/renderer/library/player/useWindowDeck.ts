/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's own element, as a deck the core's Library player drives.
 *
 * The core plays every song it can on the native host. What it cannot is
 * played here: a video, which has a picture; and a song on a machine with no
 * host (Linux, a checkout that never built it), a host that would not start,
 * or a file the host refused to open. The core says what this element should
 * be doing (`IWindowDeckWant`) and decides everything else — when the song
 * ends, when the next fades in, what is next — from what it reports
 * (`useWindowDeckEvents.ts`).
 *
 * The element work is what the window's player always did, earned one bug at
 * a time and kept: nothing heard before the element knows what it holds, no
 * seek on the tick of a new source, the overlap on two elements, and the
 * swap to the file's own bytes once nothing is mid-fade (`useDeckAudio`).
 */
import { MutableRefObject, useCallback, useEffect, useRef } from 'react';
import { libraryMediaUrl } from '../../../common/library/mediaUrl';
import type { IWindowDeckWant } from '../../../common/library/playerWire';
import type { ILibraryTrack } from '../../../common/library/types';
import {
  DSP_DIAGNOSTIC_CODES,
  DSP_DIAGNOSTIC_SCHEMA_VERSION,
} from '../../../common/dsp/diagnostics';
import { selectDspDeck } from '../../dsp/deckCrossfade';
import { dspErrorValues, reportDspDiagnostic } from '../../dsp/diagnostics';
import { TRACK_FADE_IN_MS } from './playerContract';
import { useDeckAudio } from './useDeckAudio';
import { FULL_LEVEL } from './usePlayerDecks';
import useWindowDeckEvents from './useWindowDeckEvents';

export interface IWindowDeck {
  /** Bind the video stage's element; answers its unbinding. */
  bindVideo: (element: HTMLVideoElement) => () => void;
}

export const useWindowDeck = (options: {
  want: IWindowDeckWant | undefined;
  track: ILibraryTrack | undefined;
  audioElements: readonly [HTMLAudioElement, HTMLAudioElement];
  videoElementRef: MutableRefObject<HTMLVideoElement | null>;
}): IWindowDeck => {
  const { want, track, audioElements, videoElementRef } = options;
  const wantRef = useRef(want);
  wantRef.current = want;
  const trackIdRef = useRef(want?.trackId);
  trackIdRef.current = want?.trackId;
  const audioElementRef = useRef<HTMLAudioElement>(audioElements[0]);
  const isDisposedRef = useRef(false);
  const isVideo = track?.kind === 'video';
  const isVideoRef = useRef(isVideo);
  isVideoRef.current = isVideo;
  const {
    fadeIn,
    seekQuietly,
    startCrossfade,
    releaseBlob,
    swapBufferToBlob,
    fadeInRef,
    finishCrossfadeRef,
    fadeFrameRef,
  } = useDeckAudio({ trackIdRef });
  const { bindVideo, pauseOwn, playOwn, cueAt, seekToLeadIn } =
    useWindowDeckEvents({
      audioElements,
      audioElementRef,
      videoElementRef,
      trackIdRef,
      fadeInRef,
    });

  /** The element a press reaches: the picture's while a video plays. */
  const activeElement = useCallback(
    (): HTMLMediaElement | undefined =>
      isVideoRef.current
        ? (videoElementRef.current ?? undefined)
        : audioElementRef.current,
    [videoElementRef],
  );

  // A song onto the element when the core hands it one; the elements emptied
  // when the deck is somebody else's. Keyed on the song alone: a rescan
  // refreshing its tags must not restart what plays.
  const trackId = want?.trackId;
  useEffect(() => {
    finishCrossfadeRef.current?.();
    const first = wantRef.current;
    const outgoing = audioElementRef.current;
    const isAudio = first !== undefined && !isVideo;
    const isCrossfading =
      isAudio &&
      first.transition !== undefined &&
      !outgoing.paused &&
      outgoing.getAttribute('src') !== null;
    const alternate =
      audioElements[0] === outgoing ? audioElements[1] : audioElements[0];
    const audio = isCrossfading ? alternate : outgoing;
    cancelAnimationFrame(fadeFrameRef.current);
    fadeFrameRef.current = 0;
    if (isCrossfading) {
      pauseOwn(audio);
      audio.volume = 0;
      releaseBlob(audio);
    } else {
      audioElements.forEach((element) => {
        pauseOwn(element);
        element.volume = 0;
        releaseBlob(element);
      });
      selectDspDeck(audio);
    }
    if (!first || trackId === undefined || !isAudio) {
      // A video plays on the stage's own element, and anything else is not
      // this deck's to play at all.
      audioElements.forEach((element) => {
        if (element.getAttribute('src') !== null) {
          element.removeAttribute('src');
          element.load();
        }
      });
      return undefined;
    }
    let cancelled = false;
    let transitionStarted = false;
    let playbackAccepted = first.isRestore;
    let handoffComplete = !isCrossfading;
    let bufferedForSwap: ArrayBuffer | undefined;
    /**
     * Replacing `src` aborts an unsettled `play()` in Chromium, so the file's
     * own bytes go in only once playback has started and any overlap is over.
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
      swapBufferToBlob(audio, trackId, buffer);
    };
    // The cue lands at `loadedmetadata`: a position given on the tick of the
    // source is recorded against ranges not known yet, and every seek after
    // it is refused.
    cueAt(audio, trackId, first.startMs);
    audio.src = libraryMediaUrl('track', trackId);
    if (!isCrossfading) {
      audioElementRef.current = audio;
    }
    if (first.isRestore) {
      // A restored session loads and waits for Play. Without a play nothing
      // makes the element fetch, so the metadata the cue waits on is asked
      // for by hand.
      audio.preload = 'metadata';
      audio.volume = FULL_LEVEL;
      audio.load();
    } else {
      audio.preload = 'auto';
      audio.volume = 0;
      /**
       * Nothing is heard until the element knows what it holds. `error`
       * settles it too: a file that never reaches metadata must still reach
       * `play()`, whose refusal is what says it cannot play. No deadline — a
       * timer would guess how long a disk may take.
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
        .then(() =>
          cancelled || wantRef.current?.isPlaying !== true
            ? undefined
            : playOwn(audio),
        )
        .then(() => {
          if (cancelled) {
            return undefined;
          }
          playbackAccepted = true;
          const { transition } = first;
          if (isCrossfading && transition) {
            // After `play()` settled: the decoder has data, so it lands.
            if (transition.startPositionMs > 0) {
              seekToLeadIn(audio, transition.startPositionMs);
            }
            // The incoming element owns the transport only once it started.
            audioElementRef.current = audio;
            transitionStarted = true;
            startCrossfade(
              outgoing,
              audio,
              transition.durationMs,
              transition.curve,
              transition.shape,
              () => {
                handoffComplete = true;
                flushBufferedSwap();
              },
            );
          } else {
            fadeIn(audio, TRACK_FADE_IN_MS);
            flushBufferedSwap();
          }
          return undefined;
        })
        .catch((error: unknown) => {
          if (!isCrossfading || cancelled) {
            return undefined;
          }
          reportDspDiagnostic({
            schemaVersion: DSP_DIAGNOSTIC_SCHEMA_VERSION,
            code: DSP_DIAGNOSTIC_CODES.crossfadePlayFailed,
            severity: 'error',
            origin: 'renderer',
            values: { trackId, ...dspErrorValues(error) },
          });
          pauseOwn(audio);
          audio.removeAttribute('src');
          audio.load();
          audioElementRef.current = outgoing;
          selectDspDeck(outgoing);
          return undefined;
        });
    }
    // The file's own bytes, swapped in once nothing is mid-fade: a long
    // file seeks exactly from memory where the protocol answered a range.
    window.electron.ipcRenderer
      .libraryTrackBytes(trackId)
      .then((buffer) => {
        if (buffer && !cancelled) {
          bufferedForSwap = buffer;
          flushBufferedSwap();
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      bufferedForSwap = undefined;
      if (isCrossfading && !transitionStarted) {
        pauseOwn(audio);
        releaseBlob(audio);
        audio.removeAttribute('src');
        audio.load();
        audioElementRef.current = outgoing;
        selectDspDeck(outgoing);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the song alone; see the comment above.
  }, [trackId, isVideo]);

  // Play and pause, asked of the element that holds the song.
  const isPlaying = want?.isPlaying === true;
  useEffect(() => {
    const element = activeElement();
    if (
      trackId === undefined ||
      !element ||
      element.getAttribute('src') === null
    ) {
      return;
    }
    if (isPlaying) {
      playOwn(element).catch(() => undefined);
    } else {
      pauseOwn(element);
    }
  }, [activeElement, isPlaying, pauseOwn, playOwn, trackId]);

  // A seek the listener asked for, once per ask; a song that ran out plays
  // on from where the seek put it. An overlap running is left to finish: the
  // seek moves the song coming in, as it always did.
  const seekId = want?.seek?.id;
  useEffect(() => {
    const seek = wantRef.current?.seek;
    const element = activeElement();
    if (seekId === undefined || seek === undefined || !element) {
      return;
    }
    seekQuietly(element, seek.positionMs / 1_000);
    if (wantRef.current?.isPlaying) {
      playOwn(element).catch(() => undefined);
    }
  }, [activeElement, playOwn, seekId, seekQuietly]);

  // The decks go quiet with the player that owns them: a hot reload must not
  // leave a song playing under the next copy of it.
  useEffect(() => {
    isDisposedRef.current = false;
    return () => {
      isDisposedRef.current = true;
      // Reading the CURRENT overlap is the whole point: there is none when
      // this effect runs, so the rule's advice — copy the ref at setup —
      // would capture `undefined` and leave a running crossfade holding both
      // decks after the player is gone.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- the overlap running now, never the one at setup; see above.
      finishCrossfadeRef.current?.();
      audioElements.forEach((audio) => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      });
    };
  }, [audioElements, finishCrossfadeRef]);

  const bindStageVideo = useCallback(
    (element: HTMLVideoElement) => {
      element.volume = FULL_LEVEL;
      return bindVideo(element);
    },
    [bindVideo],
  );
  return { bindVideo: bindStageVideo };
};
