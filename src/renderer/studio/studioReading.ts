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
 * sizes on the card that the scene was never drawn at.
 */

/** How long a change takes to travel half the way to the new reading. */
const SETTLE_HALF_LIFE_MS = 320;

/**
 * How far past the half-step the eased value must go before the number shown
 * follows it, as a share of the step. Zero alternates on a value sitting on
 * the edge between two steps; a whole step lags a real change by a step.
 */
const HOLD = 0.35;

/** Frames a second, shown whole. */
const FPS_STEP = 1;

/** The GPU's time for a frame, shown in tenths of a millisecond. */
const MS_STEP = 0.1;

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
  /** How long since the frame before it. */
  intervalMs: number;
  /** The share of the stage the scene was drawn at, 1 being all of it. */
  scale: number;
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
    forget() {
      value = undefined;
    },
  };
};

/** A figure shown in steps, which it leaves only once clear of the one it is on. */
const hold = (step: number) => {
  let shown: number | undefined;
  return (value: number): number => {
    if (shown === undefined || Math.abs(value - shown) > step * (0.5 + HOLD)) {
      shown = Math.round(value / step) * step;
    }
    return shown;
  };
};

/**
 * A settler for one stage. It keeps the easing between frames, so a scene
 * paused and played again picks the reading up where it was rather than
 * snapping: it is the same stage being described.
 */
export const createStudioReadingSettler = (): IStudioReadingSettler => {
  const cost = ease();
  const showCost = hold(MS_STEP);
  const rate = ease();
  const showRate = hold(FPS_STEP);
  return {
    frame({ costMs, intervalMs, scale }) {
      // A frame reported as instant says nothing about the rate, and
      // dividing by it would put an infinity on the card.
      const interval = Math.max(1, intervalMs);
      if (costMs === undefined) {
        cost.forget();
      }
      // The rate is what is eased, not the interval. Easing by half-life
      // weights each sample by the time it stood for, and a time-weighted
      // mean of 1/interval is exactly the frames drawn over the time they
      // took; the same mean of the interval itself over-weights the slow
      // frames — a run alternating 8 ms and 24 ms reads as 50 a second when
      // 62 of them arrive.
      return {
        ...(costMs === undefined
          ? {}
          : { costMs: showCost(cost.of(costMs, interval)) }),
        fps: showRate(rate.of(1000 / interval, interval)),
        size: Math.round(scale * 100),
      };
    },
  };
};
