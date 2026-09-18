/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How often frames are actually being drawn, measured from the gaps between
 * them — what a frame's GPU cost is judged against.
 *
 * The display's rate is not a number the page can ask for. It is what the
 * animation frames arrive at, and under a frame-rate cap it is the cap; so the
 * interval is read from the gaps themselves. The low quartile of the recent
 * gaps, not the mean: a stalled page makes a few long gaps, and the mean of
 * those would tell the controller the display was slow and let a slow frame
 * pass. The shortest gaps are the display's true beat.
 */

/**
 * The interval a frame's GPU cost is judged against, given the display's own
 * beat and the gap between the frames a worker actually drew.
 *
 * The tighter of the two, and the reason this is a named rule rather than a
 * `??`. A worker that skips ticks because the GPU is still busy reports a gap
 * equal to the frame's own cost, so judging the cost against it compares a
 * number with itself and every scene keeps up however heavy it is: a member's
 * scene climbed the warm-up ladder to full size on twelve "smooth" frames of
 * any cost, and full size on a 4K panel is where one frame can hold the GPU
 * long enough for Windows to reset the display for every program running.
 *
 * The page's own beat is the display's, because the page is not what waits on
 * the GPU; it is only distorted when the PAGE stalls, which the low quartile
 * above is there to shrug off. Taking the smaller keeps that and drops the
 * other.
 */
export const judgedIntervalMs = (
  displayMs: number,
  drawnMs: number | undefined,
): number => Math.min(drawnMs ?? displayMs, displayMs);

/** Gaps remembered. Two dozen is under half a second at any rate that matters. */
const CADENCE_WINDOW = 24;

/** Faster than 250 Hz or slower than 10 Hz is a measurement error, not a display. */
const SHORTEST_INTERVAL_MS = 4;
const LONGEST_INTERVAL_MS = 100;

const UNKNOWN_INTERVAL_MS = 1000 / 60;

export interface IFrameCadence {
  /** The gap since the last drawn frame. */
  note(deltaMs: number): void;
  /** The interval frames are arriving at, in milliseconds. */
  intervalMs(): number;
  reset(): void;
}

export const createFrameCadence = (): IFrameCadence => {
  const gaps: number[] = [];
  let next = 0;

  return {
    note: (deltaMs) => {
      if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
        return;
      }
      if (gaps.length < CADENCE_WINDOW) {
        gaps.push(deltaMs);
      } else {
        gaps[next] = deltaMs;
        next = (next + 1) % CADENCE_WINDOW;
      }
    },
    intervalMs: () => {
      if (gaps.length === 0) {
        return UNKNOWN_INTERVAL_MS;
      }
      const sorted = [...gaps].sort((a, b) => a - b);
      const low = sorted[Math.floor((sorted.length - 1) / 4)];
      return Math.min(LONGEST_INTERVAL_MS, Math.max(SHORTEST_INTERVAL_MS, low));
    },
    reset: () => {
      gaps.length = 0;
      next = 0;
    },
  };
};
