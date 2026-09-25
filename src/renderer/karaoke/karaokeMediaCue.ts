/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IKaraokeAudioClock } from './karaokeAudioClock';

/** `whenMediaReaches` bound to the song's element and clock; returns the cancel. */
export type TWhenPlayheadReaches = (
  endMs: number,
  onReached: () => void,
) => () => void;

/**
 * Runs `onReached` once `media` has played up to `endMs` — how the Maker's
 * auditions know the stretch they are playing is over.
 *
 * They each guessed. A word played for its own length on a timer started when
 * the seek was asked for, so the seek and the element's start-up came out of
 * the word and it was cut short; a scrub grain did the same with 90 ms; a
 * sentence looped by polling the playhead every 25 ms, and was up to that
 * late at every pass (a second late in a hidden window).
 *
 * Measured instead on the audio clock (`karaokeAudioClock`), from the moments
 * the element itself says it is moving: `playing` when it starts, `seeked`
 * when a seek during playback has landed, `ratechange` when its speed moves.
 * At each of them the distance left is read off the element's playhead and
 * the cue is set that far ahead on a clock that runs at the same rate as the
 * sound card the song is playing through. Nothing is armed while the element
 * is paused or still seeking — the audition's own seek always comes first,
 * and a playhead read then is where the song will be, not where it is.
 *
 * Not a frame loop: the Maker paints its playhead twenty times a second, not
 * every frame, and a minimised window paints nothing while its audition
 * plays on. Not `timeupdate`, which comes four times a second.
 *
 * Returns the cancel. Neither it nor `onReached` pauses anything; the caller
 * decides what the end of the stretch means — stop, or go round again.
 */
export const whenMediaReaches = (
  clock: IKaraokeAudioClock,
  media: HTMLMediaElement,
  endMs: number,
  onReached: () => void,
): (() => void) => {
  let cancelMarker: (() => void) | undefined;
  let isOver = false;
  const listening = new AbortController();

  const disarm = () => {
    cancelMarker?.();
    cancelMarker = undefined;
  };

  const end = () => {
    isOver = true;
    listening.abort();
    disarm();
  };

  const isMoving = () => !media.paused && !media.seeking;

  const reach = () => {
    cancelMarker = undefined;
    end();
    onReached();
  };

  const arm = () => {
    // The new wait is set before the old one is let go, so the clock never
    // sees a moment with nothing waiting and lets the device go between them.
    const previous = cancelMarker;
    cancelMarker = undefined;
    if (!isOver && isMoving()) {
      cancelMarker = clock.schedule(() => {
        // Read with the clock running, so both are measured from one instant.
        if (!isMoving()) {
          return [];
        }
        const rate = media.playbackRate > 0 ? media.playbackRate : 1;
        return [
          {
            atSeconds: Math.max(0, (endMs / 1_000 - media.currentTime) / rate),
            run: reach,
          },
        ];
      });
    }
    previous?.();
  };

  const { signal } = listening;
  (['playing', 'seeked', 'ratechange'] as const).forEach((type) =>
    media.addEventListener(type, arm, { signal }),
  );
  // Stopped by something else — the space bar, another player taking over —
  // and nothing to time until it moves again.
  media.addEventListener('pause', disarm, { signal });
  arm();

  return () => {
    if (!isOver) {
      end();
    }
  };
};
