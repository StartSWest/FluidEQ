/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which of an analyser's samples are new since the last time one reader took
 * them: what lets the recorder draw every block of audio exactly once.
 *
 * An analyser hands back its newest `fftSize` samples on every read, whoever
 * reads it and however often — the window overlaps the last one by most of
 * itself at display rate, and misses audio altogether when a frame comes
 * later than the window is long (2048 samples, 43 ms at 48 kHz). The capture's
 * audio clock says how much audio was rendered between two reads, so the new
 * part is that many samples at the window's end, and anything older than the
 * window was never seen by anybody.
 *
 * Counted in whole samples from the clock, never by adding up per-read
 * durations: rounding each read's share would drift the drawing off the
 * music by a sample or two every frame.
 */

export interface ISampleSpan {
  /** The new samples, as indices into the window: `from` up to `to`. */
  from: number;
  to: number;
  /**
   * Samples that went past between the two reads and are no longer in the
   * window, older than everything in `from`..`to`.
   */
  unseen: number;
}

export interface ISampleCursor {
  /**
   * The window's new samples, read at `audioMs` on the capture's clock.
   * Nothing on the first read, after `reset`, at a new sample rate, or when the
   * clock has not moved (or moved back: a new capture started from zero).
   */
  advance(
    audioMs: number,
    sampleRate: number,
    windowLength: number,
  ): ISampleSpan | undefined;
  /** Forget the position: the next read starts afresh. */
  reset(): void;
}

export const createSampleCursor = (): ISampleCursor => {
  let position: number | undefined;
  let rate = 0;
  return {
    advance: (audioMs, sampleRate, windowLength) => {
      const now = Math.round((audioMs * sampleRate) / 1000);
      if (position === undefined || sampleRate !== rate || now < position) {
        position = now;
        rate = sampleRate;
        return undefined;
      }
      const count = now - position;
      if (count <= 0 || windowLength <= 0) {
        return undefined;
      }
      position = now;
      const seen = Math.min(count, windowLength);
      return {
        from: windowLength - seen,
        to: windowLength,
        unseen: count - seen,
      };
    },
    reset: () => {
      position = undefined;
    },
  };
};
