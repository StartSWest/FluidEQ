/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The three controls that move the listener rather than the list.
 *
 * Next/Previous, the scrubber and the fader. Grouped because each one has to
 * do something to the DECK as well as to the state — a jump silences and
 * restores the level around itself, Previous chooses between rewinding and
 * changing track by asking where the playhead is, and the fader has to be
 * audible immediately while being written to disk only when it settles.
 *
 * That last split is what keeps a drag smooth: the level follows the pointer
 * with nothing in between, and the synchronous `localStorage` write does not
 * land a hundred times across one drag of a step-0.01 slider.
 */
import { MutableRefObject, useCallback } from 'react';
import { ILibraryQueue, advanceQueue } from '../../../common/library/queue';
import { writeStoredVolume } from './playbackMemory';
import { PREVIOUS_RESTART_THRESHOLD_MS, clampVolume } from './playerContract';

export interface ITransportControls {
  /** Next, or Previous — which rewinds first if the track is underway. */
  skip: (direction: 1 | -1) => void;
  seek: (nextPositionMs: number) => void;
  /** Audible at once; not written to disk until `commitVolume`. */
  setVolume: (value: number) => void;
  commitVolume: () => void;
}

export const useTransportControls = (options: {
  /** The video element when one is registered, the audio deck otherwise. */
  activeElement: () => HTMLMediaElement | undefined;
  startSeekFade: (element: HTMLMediaElement) => void;
  finishCrossfadeRef: MutableRefObject<(() => void) | undefined>;
  /** True while a native deck holds the track, so the element is not audible. */
  hostOwnsTransportRef: MutableRefObject<boolean>;
  /** Move the audible deck's playhead. See `seek`. */
  seekHost: (positionMs: number) => void;
  /** The clock of whichever engine is playing. See `publishedPositionMs`. */
  publishedPositionMs: number;
  volumeRef: MutableRefObject<number>;
  setPositionMs: (value: number) => void;
  setVolumeState: (value: number) => void;
  setQueue: (
    update: (current: ILibraryQueue | undefined) => ILibraryQueue | undefined,
  ) => void;
}): ITransportControls => {
  const {
    activeElement,
    startSeekFade,
    finishCrossfadeRef,
    hostOwnsTransportRef,
    seekHost,
    publishedPositionMs,
    volumeRef,
    setPositionMs,
    setVolumeState,
    setQueue,
  } = options;

  /**
   * Move the playhead, on whichever engine is actually making the sound.
   *
   * BOTH are moved, always, and that is the point. The host is what the
   * listener hears; the element is the warm fallback that takes over if the
   * device goes away, and one left at the old position hands back a song that
   * jumps backwards at the worst possible moment.
   *
   * The host used to be reached only by side effect: this set the muted
   * element's `currentTime`, and the drift check in `nativeMirror.sync`
   * forwarded it on some later render if the gap happened to clear half a
   * second. That check exists to SUPPRESS seeks — steady playback would
   * otherwise seek on every tick and stutter — so it discarded every drag
   * shorter than its threshold, and the bar, which reads the host, snapped
   * back to a playhead that had never moved. Reported as the seek bar not
   * working, and it was not: nothing was ever asked of the engine.
   */
  const seek = useCallback(
    (nextPositionMs: number) => {
      const clamped = Math.max(0, nextPositionMs);
      if (hostOwnsTransportRef.current) {
        seekHost(clamped);
      }
      const element = activeElement();
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
    [
      activeElement,
      hostOwnsTransportRef,
      seekHost,
      startSeekFade,
      setPositionMs,
    ],
  );

  const skip = useCallback(
    (direction: 1 | -1) => {
      /*
       * `publishedPositionMs` alone, and a correction worth recording.
       *
       * This briefly took the LATER of this clock and the element's, on the
       * reasoning that during a handover one side can read zero while the
       * other knows where the track is, and that "a stale clock lags, it does
       * not run fast". The second half of that is false across a track change:
       * the element is a paused fallback holding the PREVIOUS track's
       * `currentTime`, so a second into a new song it reads minutes, and
       * Previous restarted instead of stepping back. Stale high, not stale low.
       *
       * The clock that follows whatever is audible is the only one that
       * describes this track.
       */
      if (
        direction === -1 &&
        publishedPositionMs > PREVIOUS_RESTART_THRESHOLD_MS
      ) {
        // Close any overlap before rewinding the deck that now owns the
        // transport. A second Previous sees position zero and advances to the
        // actual previous queue item.
        finishCrossfadeRef.current?.();
        // Through `seek` rather than straight at the element: Previous is a
        // jump to zero and has to reach the audible engine the same way the
        // scrubber does. Setting `currentTime` here rewound a muted element
        // while the deck played on, so the first Previous did nothing audible
        // and the second one — seeing a position it had reset — skipped a
        // track instead of restarting this one.
        seek(0);
        return;
      }
      /*
       * Settling the overlap here was a guess, and the real cause was
       * elsewhere: `advanceQueue` held position under repeat-one, so both
       * buttons handed back a new queue object on the same track and it
       * re-cued. That is fixed where it belongs, in the queue.
       *
       * The call is gone rather than kept as insurance. It was never shown to
       * change anything, and a settle on every Next is a real effect on the
       * crossfade path to carry on a hunch.
       */
      setQueue((current) =>
        current ? advanceQueue(current, direction) : current,
      );
    },
    [publishedPositionMs, finishCrossfadeRef, seek, setQueue],
  );

  /**
   * Move the fader. Audible immediately, not written to disk.
   *
   * The split is what keeps a drag smooth. The effect on `volume` above sets
   * the element on every change, so the sound tracks the pointer with nothing
   * in between; what does NOT happen per change is the `localStorage` write,
   * which is synchronous and would land on the main thread a hundred times
   * across one drag of a `step={0.01}` slider.
   */
  const setVolume = useCallback(
    (value: number) => {
      setVolumeState(clampVolume(value));
    },
    [setVolumeState],
  );

  /**
   * Remember where the fader was left.
   *
   * Called when a gesture ends — pointer released, key lifted, mute toggled —
   * rather than on every value. Reads from the ref instead of taking an
   * argument so a caller cannot commit a value the player is not actually at.
   */
  const commitVolume = useCallback(() => {
    writeStoredVolume(volumeRef.current);
  }, [volumeRef]);

  return { skip, seek, setVolume, commitVolume };
};
