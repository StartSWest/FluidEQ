/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Everything the player learns by listening to a deck.
 *
 * One function, bound once for the life of an element and never rebound, which
 * is why almost every dependency here is a ref: a listener that closed over a
 * callback would answer with the state of the render that attached it, and
 * these outlive every track.
 *
 * Split out of `LibraryPlayerContext` because it is the boundary between the
 * player and the DOM, and it reads as one subject — what an element says, and
 * which of those statements the player still believes now that the host owns
 * the transport.
 */
import { MutableRefObject, useCallback } from 'react';
import { claimPlayback, releasePlayback } from '../../audio/playbackOwner';

export interface IMediaEventDeps {
  /** The deck the player is on, and the video element that outranks it. */
  audioElementRef: MutableRefObject<HTMLAudioElement | undefined>;
  videoElementRef: MutableRefObject<HTMLVideoElement | null>;
  /** Which track each element is playing, so only one reports position. */
  elementTrackRef: MutableRefObject<Map<HTMLMediaElement, string>>;
  trackIdRef: MutableRefObject<string | undefined>;
  /** True while the native host is the transport, which mutes most of this. */
  hostOwnsTransportRef: MutableRefObject<boolean>;
  /** Decks whose track has just loaded and must start at zero. */
  freshLoadRef: MutableRefObject<Set<HTMLMediaElement>>;
  /** The player's own lead-in jump, which is not a seek anybody asked for. */
  leadInSeekRef: MutableRefObject<Set<HTMLMediaElement>>;
  pendingRestore: MutableRefObject<
    { trackId: string; positionMs: number } | undefined
  >;
  fadeInRef: MutableRefObject<
    ((element: HTMLMediaElement) => void) | undefined
  >;
  handleEnded: (element: HTMLMediaElement) => void;
  setPositionMs: (value: number) => void;
  setDurationMs: (value: number) => void;
  setIsPlaying: (value: boolean) => void;
  setRetainWhenHidden: (value: boolean) => void;
  setIsUnplayable: (value: boolean) => void;
}

export const useMediaEvents = (
  deps: IMediaEventDeps,
): ((element: HTMLMediaElement) => () => void) => {
  const {
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
  } = deps;

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
        setRetainWhenHidden(false);
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
        if (hostOwnsTransportRef.current || element.ended) {
          return;
        }
        setRetainWhenHidden(false);
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
        setRetainWhenHidden(false);
        releasePlayback('library');
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
    // Every entry but `handleEnded` is a ref or a state setter, so this list
    // never actually changes — it is spelled out because the rule cannot see
    // that through a parameter object, and a listener bound once for the life
    // of an element must not be rebuilt on a dependency that only looks new.
    [
      handleEnded,
      audioElementRef,
      videoElementRef,
      elementTrackRef,
      trackIdRef,
      hostOwnsTransportRef,
      freshLoadRef,
      leadInSeekRef,
      pendingRestore,
      fadeInRef,
      setPositionMs,
      setDurationMs,
      setIsPlaying,
      setRetainWhenHidden,
      setIsUnplayable,
    ],
  );

  return bindMediaEvents;
};
