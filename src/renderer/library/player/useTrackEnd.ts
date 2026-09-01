/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A track running out, in the three forms that can happen.
 *
 * `handleEnded` is what to DO about it: repeat one restarts in place, anything
 * else advances, and reaching the last track with repeat off stops rather than
 * replaying what just finished.
 *
 * The host reporting `ended` is when it happens for real. It is a STATE and is
 * held until something else is loaded, so this fires on the edge and remembers
 * which track it fired for — read as an event it would advance the queue again
 * on every telemetry frame until the next load, forty times a second.
 *
 * The crossfade trigger is when it happens EARLY, on purpose: the overlap has
 * to start while there is still music to overlap with. It runs off the
 * published clock — the host's when a deck holds something, the element's
 * otherwise — because the element is paused once the host is playing and a
 * paused element emits no ticks.
 *
 * The programme end is the measured end of the MUSIC rather than of the file.
 * A track padded with five seconds of digital silence used to start its
 * two-second fade three seconds into that padding: inaudible at both ends.
 */
import {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  useCallback,
  useEffect,
} from 'react';
import { IDspSettings } from '../../../common/dsp/chain';
import {
  ILibraryQueue,
  advanceQueue,
  currentTrackId,
  queueAtEnd,
} from '../../../common/library/queue';
import { ILibraryProgrammeEdges } from '../../../common/library/types';
import { releasePlayback } from '../../audio/playbackOwner';
import type { TSetPlaybackHandoff } from '../../audio/playbackHandoff';

export const useTrackEnd = (options: {
  queueRef: MutableRefObject<ILibraryQueue | undefined>;
  setQueue: Dispatch<SetStateAction<ILibraryQueue | undefined>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setRetainWhenHidden: TSetPlaybackHandoff;
  trackIdRef: MutableRefObject<string | undefined>;
  audioElementRef: MutableRefObject<HTMLAudioElement | undefined>;
  /** Which track already triggered its own end, so it cannot do so twice. */
  endedTrackRef: MutableRefObject<string | undefined>;
  naturalCrossfadeTrackRef: MutableRefObject<string | undefined>;
  programmeEdgesRef: MutableRefObject<
    Map<HTMLMediaElement, ILibraryProgrammeEdges>
  >;
  /** True when the deck has reached the end of its file. */
  hostEnded: boolean;
  dspSettings: IDspSettings;
  publishedPositionMs: number;
  publishedDurationMs: number;
}): ((element: HTMLMediaElement) => void) => {
  const {
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
  } = options;

  /**
   * The track that just finished. `repeat: 'one'` restarts it in place — the
   * queue's own `position` never moves for that mode (see `advanceQueue`'s
   * doc comment), so this is the one case that has to act on the element
   * directly rather than letting a `trackId` change trigger a reload.
   * Everything else calls `advanceQueue` and lets that effect take over —
   * stopping at the end with repeat off is `advanceQueue` holding position at
   * the last track combined with the check below, not a separate rule here.
   */
  const handleEnded = useCallback(
    (element: HTMLMediaElement) => {
      const { current } = queueRef;
      if (!current) {
        return;
      }
      if (current.repeat === 'one') {
        setRetainWhenHidden(true);
        element.currentTime = 0;
        element.play().catch(() => undefined);
        return;
      }
      const wasAtEnd = queueAtEnd(current);
      setRetainWhenHidden(!wasAtEnd || current.repeat === 'all');
      setQueue(advanceQueue(current, 1));
      if (wasAtEnd && current.repeat === 'off') {
        // Nothing queued after it — a player with nothing next just stops,
        // rather than replaying the track that just ended.
        releasePlayback('library');
        setIsPlaying(false);
      }
    },
    [queueRef, setIsPlaying, setQueue, setRetainWhenHidden],
  );

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
    if (!hostEnded || !playing || endedTrackRef.current === playing) {
      return;
    }
    endedTrackRef.current = playing;
    const element = audioElementRef.current;
    if (element) {
      handleEnded(element);
    }
  }, [hostEnded, handleEnded, audioElementRef, endedTrackRef, trackIdRef]);

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
    audioElementRef,
    programmeEdgesRef,
    queueRef,
    setQueue,
  ]);

  return handleEnded;
};
