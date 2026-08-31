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
    publishedPositionMs,
    volumeRef,
    setPositionMs,
    setVolumeState,
    setQueue,
  } = options;

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
    [
      activeElement,
      publishedPositionMs,
      startSeekFade,
      finishCrossfadeRef,
      setPositionMs,
      setQueue,
    ],
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
    [activeElement, startSeekFade, setPositionMs],
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
