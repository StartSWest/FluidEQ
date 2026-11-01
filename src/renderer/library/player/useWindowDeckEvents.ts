/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the window's element tells the core's Library player while it is the
 * deck (`useWindowDeck.ts`): where the song is, that it ended, that it could
 * not play, and that something other than the player started or stopped it —
 * the video's own controls, or the system's media keys through Chromium.
 *
 * Only the element holding the song the core asked for speaks, and only for
 * that song: an element fading out, or one the loader is still filling, is
 * still a media element firing events, and each of them read as the deck's
 * would move the queue or the transport for a song nobody chose. The pauses
 * and plays the deck makes itself are its own (`own`) and never reported back
 * as the listener's.
 */
import { MutableRefObject, useCallback, useEffect, useRef } from 'react';
import { TRANSPORT_POSITION_STEP_SECONDS } from '../../../common/dsp/nativeTransport';
import { reportDeck } from './corePlayer';

/** The bar shows a quarter of a second; the core needs no finer. */
const REPORT_STEP_MS = TRANSPORT_POSITION_STEP_SECONDS * 1_000;

const useWindowDeckEvents = (options: {
  audioElements: readonly HTMLAudioElement[];
  audioElementRef: MutableRefObject<HTMLAudioElement>;
  videoElementRef: MutableRefObject<HTMLVideoElement | null>;
  trackIdRef: MutableRefObject<string | undefined>;
  fadeInRef: MutableRefObject<
    ((element: HTMLMediaElement) => void) | undefined
  >;
}) => {
  const {
    audioElements,
    audioElementRef,
    videoElementRef,
    trackIdRef,
    fadeInRef,
  } = options;
  /** Which song each element holds, so an outgoing one is not heard from. */
  const elementTrackRef = useRef(new Map<HTMLMediaElement, string>());
  /** Where a song is cued once its element knows what it holds. */
  const cueRef = useRef(new Map<HTMLMediaElement, number>());
  /** Plays and pauses the deck made itself, to be told from the listener's. */
  const ownRef = useRef(new Map<HTMLMediaElement, 'play' | 'pause'>());
  /**
   * Seeks that must land silently: the lead-in an overlap starts the
   * incoming song at, where the fade itself is the level.
   */
  const leadInRef = useRef(new Set<HTMLMediaElement>());
  /** The last clock sent, by the quarter second. */
  const reportedRef = useRef('');

  /** A pause the deck makes itself, never reported as the listener's. */
  const pauseOwn = useCallback((element: HTMLMediaElement): void => {
    if (!element.paused) {
      ownRef.current.set(element, 'pause');
      element.pause();
    }
  }, []);

  /** A play the deck makes itself, never reported as the listener's. */
  const playOwn = useCallback((element: HTMLMediaElement): Promise<void> => {
    if (!element.paused) {
      return Promise.resolve();
    }
    ownRef.current.set(element, 'play');
    return element.play();
  }, []);

  const cueAt = useCallback(
    (element: HTMLMediaElement, trackId: string, positionMs: number) => {
      elementTrackRef.current.set(element, trackId);
      cueRef.current.set(element, positionMs);
      reportedRef.current = '';
    },
    [],
  );

  /** Start the song at its music, under the fade rather than a fade-in. */
  const seekToLeadIn = useCallback(
    (element: HTMLMediaElement, positionMs: number) => {
      leadInRef.current.add(element);
      element.currentTime = positionMs / 1_000;
    },
    [],
  );

  const bind = useCallback(
    (element: HTMLMediaElement): (() => void) => {
      const speaks = () => {
        const active = videoElementRef.current ?? audioElementRef.current;
        const holds = elementTrackRef.current.get(element);
        return (
          element === active &&
          trackIdRef.current !== undefined &&
          (holds === undefined || holds === trackIdRef.current)
        );
      };
      const report = () => {
        const trackId = trackIdRef.current;
        if (!speaks() || trackId === undefined) {
          return;
        }
        const positionMs = element.currentTime * 1_000;
        const durationMs =
          Number.isFinite(element.duration) && element.duration > 0
            ? element.duration * 1_000
            : 0;
        const key = `${trackId}|${Math.round(positionMs / REPORT_STEP_MS)}|${durationMs}`;
        if (key !== reportedRef.current) {
          reportedRef.current = key;
          reportDeck({ kind: 'clock', trackId, positionMs, durationMs });
        }
      };
      const onSeeked = () => {
        report();
        if (!leadInRef.current.delete(element)) {
          fadeInRef.current?.(element);
        }
      };
      const onMetadata = () => {
        const cue = cueRef.current.get(element);
        if (cue !== undefined) {
          cueRef.current.delete(element);
          // A fresh source starts at the start; a cue starts where it says.
          if (cue > 0) {
            element.currentTime = cue / 1_000;
          } else if (element.currentTime > 0) {
            element.currentTime = 0;
          }
        }
        report();
      };
      const onPlay = () => {
        if (ownRef.current.get(element) === 'play') {
          ownRef.current.delete(element);
          return;
        }
        const trackId = trackIdRef.current;
        if (speaks() && trackId !== undefined) {
          reportDeck({ kind: 'playing', trackId, isPlaying: true });
        }
      };
      const onPause = () => {
        if (ownRef.current.get(element) === 'pause' || element.ended) {
          ownRef.current.delete(element);
          return;
        }
        const trackId = trackIdRef.current;
        if (speaks() && trackId !== undefined) {
          reportDeck({ kind: 'playing', trackId, isPlaying: false });
        }
      };
      const onEnded = () => {
        const trackId = trackIdRef.current;
        if (speaks() && trackId !== undefined) {
          reportDeck({ kind: 'ended', trackId });
        }
      };
      const onError = () => {
        const trackId = trackIdRef.current;
        if (
          speaks() &&
          trackId !== undefined &&
          element.getAttribute('src') !== null
        ) {
          reportDeck({ kind: 'failed', trackId });
        }
      };
      element.addEventListener('timeupdate', report);
      element.addEventListener('seeked', onSeeked);
      element.addEventListener('loadedmetadata', onMetadata);
      element.addEventListener('durationchange', report);
      element.addEventListener('play', onPlay);
      element.addEventListener('pause', onPause);
      element.addEventListener('ended', onEnded);
      element.addEventListener('error', onError);
      return () => {
        element.removeEventListener('timeupdate', report);
        element.removeEventListener('seeked', onSeeked);
        element.removeEventListener('loadedmetadata', onMetadata);
        element.removeEventListener('durationchange', report);
        element.removeEventListener('play', onPlay);
        element.removeEventListener('pause', onPause);
        element.removeEventListener('ended', onEnded);
        element.removeEventListener('error', onError);
      };
    },
    [audioElementRef, fadeInRef, trackIdRef, videoElementRef],
  );

  useEffect(() => {
    const unbind = audioElements.map((element) => bind(element));
    return () => unbind.forEach((one) => one());
  }, [audioElements, bind]);

  /** The video stage's element, bound while it is mounted. */
  const bindVideo = useCallback(
    (element: HTMLVideoElement): (() => void) => {
      const trackId = trackIdRef.current;
      if (trackId !== undefined) {
        elementTrackRef.current.set(element, trackId);
      }
      return bind(element);
    },
    [bind, trackIdRef],
  );

  return { bindVideo, pauseOwn, playOwn, cueAt, seekToLeadIn };
};

export default useWindowDeckEvents;
