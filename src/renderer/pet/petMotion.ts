/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The titlebar pet's motions, as the stylesheet wrote them
 * (`SupportPet.scss`): the same keyframes, durations, delays and timing
 * functions, sampled in the canvas's own frames (`PetCanvas.tsx`). Change one
 * there and here together, or the pet in the titlebar stops being the one in
 * the support dialog.
 */

type TTiming = (progress: number) => number;

/**
 * CSS `cubic-bezier(x1, y1, x2, y2)`: x solved for the progress by Newton's
 * method with a bisection fallback, the way browsers do it.
 */
export const cubicBezier = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): TTiming => {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let step = 0; step < 8; step += 1) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-6) {
        return t;
      }
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) {
        break;
      }
      t -= error / slope;
    }
    let low = 0;
    let high = 1;
    t = x;
    while (high - low > 1e-6) {
      if (sampleX(t) < x) {
        low = t;
      } else {
        high = t;
      }
      t = (low + high) / 2;
    }
    return t;
  };
  return (progress) => {
    if (progress <= 0 || progress >= 1) {
      return progress <= 0 ? 0 : 1;
    }
    return sampleY(solve(progress));
  };
};

export const EASE_IN_OUT = cubicBezier(0.42, 0, 0.58, 1);
const LINEAR: TTiming = (progress) => progress;
const SWAY_TIMING = cubicBezier(0.4, 0, 0.2, 1);
const BOB_TIMING = cubicBezier(0.45, 0, 0.55, 1);

/** One keyframe: where in the cycle, and the values there. */
type TKeyframe = readonly [offset: number, values: readonly number[]];

interface IKeyframes {
  durationMs: number;
  timing: TTiming;
  frames: readonly TKeyframe[];
}

/**
 * The values `keyframes` hold `elapsedMs` into a running animation, each
 * interval between two keyframes eased by the animation's timing function,
 * as CSS applies `animation-timing-function` per keyframe interval.
 */
export const sample = (
  { durationMs, timing, frames }: IKeyframes,
  elapsedMs: number,
): readonly number[] => {
  const cycle = elapsedMs / durationMs;
  const progress = cycle - Math.floor(cycle);
  for (let index = 0; index < frames.length - 1; index += 1) {
    const [fromAt, from] = frames[index];
    const [toAt, to] = frames[index + 1];
    if (progress <= toAt) {
      const span = toAt - fromAt;
      const local = span > 0 ? timing((progress - fromAt) / span) : 1;
      return from.map((value, at) => value + (to[at] - value) * local);
    }
  }
  return frames[frames.length - 1][1];
};

/** `pet-breathe`: the body's scale x and y. */
export const BREATHE: IKeyframes = {
  durationMs: 3400,
  timing: EASE_IN_OUT,
  frames: [
    [0, [1, 1]],
    [0.5, [0.985, 1.045]],
    [1, [1, 1]],
  ],
};

/** `pet-blink`: the eyes' vertical scale; quicker under the pointer. */
export const blink = (isHovered: boolean): IKeyframes => ({
  durationMs: isHovered ? 1900 : 5200,
  timing: EASE_IN_OUT,
  frames: [
    [0, [1]],
    [0.92, [1]],
    [0.95, [0.08]],
    [1, [1]],
  ],
});

/** `pet-twinkle`: the star's opacity, scale and turn in degrees. */
export const TWINKLE: IKeyframes = {
  durationMs: 2600,
  timing: EASE_IN_OUT,
  frames: [
    [0, [1, 1, 0]],
    [0.5, [0.75, 1.14, 12]],
    [1, [1, 1, 0]],
  ],
};

/** `pet-sway` and `pet-dance`: the creature's shift in px and lean in degrees. */
export const sway = (isDancing: boolean): IKeyframes => ({
  durationMs: isDancing ? 1150 : 1800,
  timing: SWAY_TIMING,
  frames: [
    [0, [-3, -9]],
    [0.3, [3, 9]],
    [0.45, [3, 9]],
    [0.8, [-3, -9]],
    [0.95, [-3, -9]],
    [1, [-3, -9]],
  ],
});

/** How many sways a dance lasts (`pet-dance ... 6 forwards`). */
export const DANCE_SWAYS = 6;

/** `pet-ear-sway`: the ears' turn in degrees, after its delay. */
export const earSway = (isDancing: boolean): IKeyframes => ({
  durationMs: isDancing ? 1150 : 1800,
  timing: SWAY_TIMING,
  frames: [
    [0, [8]],
    [0.3, [-8]],
    [0.45, [-8]],
    [0.8, [8]],
    [0.95, [8]],
    [1, [8]],
  ],
});

/** The ears trail the body by this much (`animation-delay`). */
export const earSwayDelayMs = (isDancing: boolean) => (isDancing ? 90 : 140);

/** `pet-bob-layer`: a layer's rise, as a share of its square. */
export const BOB: IKeyframes = {
  durationMs: 575,
  timing: BOB_TIMING,
  frames: [
    [0, [0.015]],
    [0.5, [-0.035]],
    [1, [0.015]],
  ],
};

/** `pet-eye-scroll`: one period of the wave in the eye, linear. */
export const EYE_SCROLL: IKeyframes = {
  durationMs: 900,
  timing: LINEAR,
  frames: [
    [0, [0]],
    [1, [1]],
  ],
};
