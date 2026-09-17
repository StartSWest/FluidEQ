/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { getEaseFactor } from 'common/smoothing';

/**
 * The frame cost readout on the Studio's card, settled enough to read.
 *
 * Written straight from the frame callback, the raw figures are unreadable:
 * the GPU's time for one frame swings by tenths of a millisecond from frame
 * to frame and the interval between frames by more, so the line rewrote
 * itself several times a second and the digits blurred — which is what "the
 * indicator changes too fast" was.
 *
 * Two things settle it, and neither is a timer:
 *
 * - each measurement is eased by half-life (`common/smoothing`), so the same
 *   wobble takes the same wall-clock time to fade whether the machine draws
 *   at 30 or at 144 frames a second — a fixed share per frame would settle
 *   four times faster on the fast one;
 * - and the number shown only moves once the eased value is further from it
 *   than `HOLD` past the half-step, so a reading sitting between two steps
 *   stays on the one it reached instead of alternating between them.
 *
 * The cost of the hold is that the figure can sit one step short of where the
 * measurement settles — a tenth of a millisecond, a frame a second — which is
 * the trade this readout wants: it is read to see whether a scene is cheap or
 * heavy, not to be measured against.
 *
 * The size is not eased at all: it is the controller's own choice from a
 * fixed ladder, a step rather than a measurement, and easing it would put
 * sizes on the card that the scene was never drawn at. And the GPU's time is
 * kept through the frames that carry none — its timer answers every few
 * frames — so the line does not change shape while it waits.
 */

/** How long a change takes to travel half the way to the new reading. */
const SETTLE_HALF_LIFE_MS = 320;

/**
 * How far past the half-step the eased value must go before the number shown
 * follows it, as a share of the step. Zero alternates on a value sitting on
 * the edge between two steps; a whole step lags a real change by a step.
 */
const HOLD = 0.35;

/**
 * Frames a second, shown whole up to a hundred and in fives above it: at 120
 * a frame either way is a fifth of a percent, and the rate wanders by more
 * than that on its own — 121, 120, 119, 118 in three seconds, each one a
 * rewrite. Below a hundred a single frame is worth seeing.
 */
const fpsStep = (fps: number) => (fps >= 100 ? 5 : 1);

/** The GPU's time for a frame, shown in tenths of a millisecond. */
const msStep = () => 0.1;

/**
 * A gap this long is not a rate: the page was away, the stage was covered,
 * or the scene was rebuilt. Left out of the average rather than counted as
 * one frame a second.
 */
const STALL_MS = 1000;

export interface IStudioReading {
  /** The GPU's own time for a frame, absent where it cannot be timed. */
  costMs?: number;
  /** Frames a second. */
  fps: number;
  /** What share of the stage the scene is drawn at, as a percentage. */
  size: number;
}

export interface IStudioFrameCost {
  /** The GPU's own time for the frame, where the card can time it. */
  costMs?: number;
  /**
   * The interval the runner works to (`frameCadence.ts`) — the low quartile
   * of the recent gaps, which is the display's beat and deliberately not the
   * rate frames are arriving at. Used only until two frames have been seen.
   */
  intervalMs: number;
  /**
   * The scale the scene was drawn at, 1 being the panel's own pixels and
   * more than 1 the `best` smoothing drawing larger to average down.
   */
  scale: number;
  /** When this frame was drawn, for the rate it is really arriving at. */
  atMs?: number;
}

export interface IStudioReadingSettler {
  /** What to show after this frame. */
  frame(cost: IStudioFrameCost): IStudioReading;
}

/** A measurement eased toward each new sample, by wall-clock half-life. */
const ease = () => {
  let value: number | undefined;
  return {
    of(sample: number, deltaMs: number): number {
      value =
        value === undefined
          ? sample
          : value +
            (sample - value) * getEaseFactor(deltaMs, SETTLE_HALF_LIFE_MS);
      return value;
    },
  };
};

/** A figure shown in steps, which it leaves only once clear of the one it is on. */
const hold = (stepOf: (value: number) => number) => {
  let shown: number | undefined;
  return {
    of(value: number): number {
      const step = stepOf(value);
      if (
        shown === undefined ||
        Math.abs(value - shown) > step * (0.5 + HOLD)
      ) {
        shown = Math.round(value / step) * step;
      }
      return shown;
    },
    /** What it last showed, or nothing if it has never been given a value. */
    last(): number | undefined {
      return shown;
    },
  };
};

/**
 * A settler for one stage. It keeps the easing between frames, so a scene
 * paused and played again picks the reading up where it was rather than
 * snapping: it is the same stage being described.
 */
export const createStudioReadingSettler = (): IStudioReadingSettler => {
  const cost = ease();
  const showCost = hold(msStep);
  const rate = ease();
  const showRate = hold(fpsStep);
  let lastAt: number | undefined;
  return {
    frame({ costMs, intervalMs, scale, atMs }) {
      // The gap since the frame before this one, which is the rate the scene
      // is really being drawn at. The runner's own interval is the low
      // quartile of the recent gaps — the display's beat, which is what a
      // frame's cost is judged against, and always the flattering end of
      // what is actually arriving — so it is used only until there are two
      // frames to measure between. A gap longer than a second is a stall or
      // a page that was away, not a rate, and is left out of the average.
      const gap =
        atMs !== undefined && lastAt !== undefined ? atMs - lastAt : undefined;
      lastAt = atMs;
      const measured = gap !== undefined && gap > 0 && gap <= STALL_MS;
      // A frame reported as instant says nothing about the rate, and
      // dividing by it would put an infinity on the card.
      const interval = measured
        ? Math.max(1, gap ?? 1)
        : Math.max(1, intervalMs);
      // A frame carrying no GPU time is not a machine that cannot time
      // frames: the timer answers every few frames, so the figure is kept as
      // it was in between. Dropping it made the line change shape — with the
      // milliseconds, then without them — several times a second, and start
      // the easing again each time it came back.
      const settled =
        costMs === undefined
          ? showCost.last()
          : showCost.of(cost.of(costMs, interval));
      // The rate is what is eased, not the interval. Easing by half-life
      // weights each sample by the time it stood for, and a time-weighted
      // mean of 1/interval is exactly the frames drawn over the time they
      // took; the same mean of the interval itself over-weights the slow
      // frames — a run alternating 8 ms and 24 ms reads as 50 a second when
      // 62 of them arrive.
      return {
        ...(settled === undefined ? {} : { costMs: settled }),
        fps: showRate.of(rate.of(1000 / interval, interval)),
        // The resolution in the words the rows above it use: 100% is the
        // panel's own pixels, and the steps below it are the ladder's.
        // Anything above 1 is `best` smoothing drawing larger to average
        // down, which is how the edges are finished rather than what the
        // scene is drawn at — it read as "200 %" beside a Resolution row
        // that only ever says up to full.
        size: Math.round(Math.min(1, scale) * 100),
      };
    },
  };
};
