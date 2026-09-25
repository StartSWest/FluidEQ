/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Everything that touches a deck's level or its source, in one place.
 *
 * The fades, the overlap and the swap from a streamed source to an in-memory
 * blob are one subject: they all move a deck between states without the
 * listener hearing the move. They also share the state that makes that
 * possible — a single animation frame handle so two ramps on an element's
 * volume cannot fight over it, and one record of which swap is pending so an
 * abandoned one cannot fire against the next track.
 *
 * Split out of `LibraryPlayerContext` because that file is a queue, a
 * transport, a loader, an analysis pass and a restore as well, and this is the
 * part of it with no opinion about any of those. It takes the two things it
 * cannot know — how loud the listener wants it, and which track is current —
 * and hands back the operations.
 */
import { MutableRefObject, useCallback, useEffect, useRef } from 'react';
import { FULL_LEVEL } from './usePlayerDecks';
import { TCrossfadeCurve } from '../../../common/dsp/chain';
import { ICrossfadeShape } from '../../../common/dsp/crossfadeShape';
import {
  fadeInDspDeck,
  scheduleDspDeckCrossfade,
  selectDspDeck,
} from '../../dsp/deckCrossfade';
import { libraryMediaUrl } from '../../../common/library/mediaUrl';
import { SEEK_FADE_MS, clampVolume } from './playerContract';

export interface IDeckAudio {
  /** Ramp a deck back to the listener's level. */
  fadeIn: (element: HTMLMediaElement, durationMs?: number) => void;
  /** Move the playhead with the level dropped for the jump, and brought back. */
  seekQuietly: (element: HTMLMediaElement, seconds: number) => void;
  startCrossfade: (
    outgoing: HTMLAudioElement,
    incoming: HTMLAudioElement,
    durationMs: number,
    curve: TCrossfadeCurve,
    shape: ICrossfadeShape,
    onFinished?: () => void,
  ) => void;
  /** Revoke the object URL behind a deck and cancel any swap waiting on it. */
  releaseBlob: (element: HTMLAudioElement) => void;
  swapBufferToBlob: (
    element: HTMLAudioElement,
    forTrackId: string,
    buffer: ArrayBuffer,
  ) => void;
  /**
   * Reached from listeners bound once for the life of an element, which
   * therefore cannot close over a callback that is rebuilt.
   */
  fadeInRef: MutableRefObject<
    ((element: HTMLMediaElement) => void) | undefined
  >;
  /** Ends the running overlap early, or does nothing if there is none. */
  finishCrossfadeRef: MutableRefObject<(() => void) | undefined>;
  /** Which track already triggered its own end, so it cannot do so twice. */
  naturalCrossfadeTrackRef: MutableRefObject<string | undefined>;
  /**
   * The running frame ramp, so a cancel from outside can stop it. A cancel
   * sets it back to zero, which is how a hidden page knows none is pending.
   */
  fadeFrameRef: MutableRefObject<number>;
}

export const useDeckAudio = (options: {
  /**
   * Read inside `swapBufferToBlob`'s continuation, where a captured value
   * would be the one from the render that started the read.
   */
  trackIdRef: MutableRefObject<string | undefined>;
}): IDeckAudio => {
  const { trackIdRef } = options;
  const fadeInRef = useRef<((element: HTMLMediaElement) => void) | undefined>(
    undefined,
  );
  const finishCrossfadeRef = useRef<(() => void) | undefined>(undefined);

  const crossfadeCompletionRef = useRef<number | undefined>(undefined);

  /** The object URL currently backing the element, so it can be revoked when
   * the next track replaces it. A blob URL that is never revoked pins its
   * whole buffer for the life of the window. */
  const blobUrlsRef = useRef(new Map<HTMLAudioElement, string>());

  /** The running frame ramp, so a second seek arriving mid-ramp cancels the
   * first rather than fighting it for the volume property. Zero whenever no
   * ramp is pending — every cancel sets it back. */
  const fadeFrameRef = useRef(0);
  /** The element that ramp is moving, for as long as it is. */
  const rampingElementRef = useRef<HTMLMediaElement | undefined>(undefined);
  /** Prevents one track end advancing the queue more than once. */
  const naturalCrossfadeTrackRef = useRef<string | undefined>(undefined);

  const fadeIn = useCallback(
    (element: HTMLMediaElement, durationMs = SEEK_FADE_MS) => {
      cancelAnimationFrame(fadeFrameRef.current);
      fadeFrameRef.current = 0;
      rampingElementRef.current = undefined;
      /**
       * On the audio clock whenever the element is one of the two decks, which
       * is every Library track that is not a video. See `fadeInDspDeck` for
       * what ramping on animation frames did behind a minimised window.
       *
       * The envelope drops to zero before the element's level comes up, not
       * after. Both take effect on the next render quantum, and in the other
       * order one quantum can be heard at full level ahead of the ramp.
       */
      if (fadeInDspDeck(element, durationMs)) {
        element.volume = FULL_LEVEL;
        return;
      }
      /**
       * No audio clock for this element — the video, or a deck whose engine
       * never started — so the ramp is on its volume, one animation frame at a
       * time. Frames do not run while the page is hidden, so a hidden page
       * takes the level at once: a ramp that cannot finish would otherwise
       * hold the element at zero until the window came back.
       */
      if (document.visibilityState === 'hidden') {
        element.volume = FULL_LEVEL;
        return;
      }
      const target = FULL_LEVEL;
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
        rampingElementRef.current = undefined;
      };
      rampingElementRef.current = element;
      fadeFrameRef.current = requestAnimationFrame(step);
    },
    [],
  );
  fadeInRef.current = fadeIn;

  /**
   * A frame ramp still running when the page is hidden lands on the spot.
   *
   * Its next frame waits for the window to come back, and until then the
   * element would hold whatever fraction of the level the last frame gave it —
   * the start of a ramp is close to silence.
   */
  useEffect(() => {
    const land = () => {
      const element = rampingElementRef.current;
      if (
        document.visibilityState !== 'hidden' ||
        fadeFrameRef.current === 0 ||
        !element
      ) {
        return;
      }
      cancelAnimationFrame(fadeFrameRef.current);
      fadeFrameRef.current = 0;
      rampingElementRef.current = undefined;
      element.volume = FULL_LEVEL;
    };
    document.addEventListener('visibilitychange', land);
    return () => document.removeEventListener('visibilitychange', land);
  }, []);

  /**
   * Moves the playhead with the level dropped for the jump, and always brings
   * it back.
   *
   * `seeked` is what brings it back — see `bindMediaEvents`. A seek the element
   * never starts fires no `seeked`, and the element says so the moment it is
   * asked: `seeking` is still false straight after the assignment when nothing
   * is loaded yet or nothing is seekable. Nothing moved, so there is no seam to
   * hide, and the level comes back on the spot.
   *
   * That used to be a watch on animation frames with a half-second deadline: a
   * guess at how long a seek may take, and one that stopped guessing behind a
   * minimised window, where no frame arrives. A Previous pressed on the taskbar
   * there left the deck silent until the window was brought back.
   */
  const seekQuietly = useCallback(
    (element: HTMLMediaElement, seconds: number) => {
      cancelAnimationFrame(fadeFrameRef.current);
      fadeFrameRef.current = 0;
      rampingElementRef.current = undefined;
      element.volume = 0;
      element.currentTime = seconds;
      if (!element.seeking) {
        element.volume = FULL_LEVEL;
      }
    },
    [],
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

  /**
   * Every blob URL this player made goes when the player does.
   *
   * `useIdlePlayerMount` in `App.tsx` unmounts the provider once nothing on
   * screen uses it and nothing is playing, and `useDeckLifecycle`'s teardown
   * empties the decks without reaching this map. The paused track's URL
   * stayed registered with nothing left that could revoke it: a whole audio
   * file pinned for the rest of the session, once per visit. `releaseBlob`
   * also takes a swap still waiting for its metadata off its deck.
   */
  useEffect(() => {
    const blobUrls = blobUrlsRef.current;
    return () => {
      Array.from(blobUrls.keys()).forEach(releaseBlob);
    };
  }, [releaseBlob]);

  const startCrossfade = useCallback(
    (
      outgoing: HTMLAudioElement,
      incoming: HTMLAudioElement,
      durationMs: number,
      curve: TCrossfadeCurve,
      shape: ICrossfadeShape,
      onFinished?: () => void,
    ) => {
      finishCrossfadeRef.current?.();
      const target = FULL_LEVEL;
      outgoing.volume = target;
      incoming.volume = target;
      const scheduled = scheduleDspDeckCrossfade(
        outgoing,
        incoming,
        durationMs,
        curve,
        shape,
      );
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
    [releaseBlob],
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
      /**
       * Only a playhead this element can vouch for.
       *
       * The restore below makes a mid-playback swap inaudible, and it is only
       * meaningful if `currentTime` describes the media the element is
       * holding. Reported exactly: play A, play B, seek B to the middle, come
       * back to A — and A begins in the middle, with the seek bar reading
       * zero. B's playhead, on A's audio.
       *
       * `readyState` cannot catch that and neither can the `src` attribute.
       * Assigning `src` does not synchronously drop the element to
       * HAVE_NOTHING: the media load algorithm is QUEUED, so for a turn or
       * more afterwards the attribute names the new track while `readyState`
       * and `currentTime` still describe the previous one. Both guards read as
       * healthy and both are answering about the wrong resource.
       *
       * `currentSrc` is the one that cannot: it is the resource actually
       * selected, and it stays on the old track until the new load reaches it.
       *
       * Zero when there is nothing to vouch for, which is also where a track
       * that has not started belongs.
       */
      const holdsThisTrack =
        element.currentSrc === libraryMediaUrl('track', forTrackId);
      const at =
        holdsThisTrack && element.readyState >= HTMLMediaElement.HAVE_METADATA
          ? element.currentTime
          : 0;
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
        // Nothing to put back is left alone rather than written as a seek to
        // zero: a track that has just started is already there, and assigning
        // `currentTime` makes the decoder re-sync for no reason.
        if (at > 0) {
          element.currentTime = at;
        }
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
    [releaseBlob, trackIdRef],
  );

  return {
    fadeIn,
    seekQuietly,
    startCrossfade,
    releaseBlob,
    swapBufferToBlob,
    fadeInRef,
    finishCrossfadeRef,
    naturalCrossfadeTrackRef,
    fadeFrameRef,
  };
};
