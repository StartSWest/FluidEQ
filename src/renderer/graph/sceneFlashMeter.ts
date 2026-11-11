/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  FLASH_PERIOD_S,
  FLASH_STATE_REST,
  FLASH_SWING,
  GAP_MARGIN_S,
  MAX_FRAME_MS,
  MAX_GAP_S,
  flashTravelDecay,
  flashTravelled,
  flashingDecay,
} from './sceneFlashGuard';

/**
 * How much of a scene flashes, measured frame by frame on the CPU, for the
 * review of a scene before it is published. No scene's picture is held back
 * on screen any more (Ivan, 2026-11-11: "all scenes need to work the same
 * way"), so flashing is caught here, once, by the admin.
 *
 * WHICH PIXELS FLASH is the brightness limiter's own test, unchanged: each
 * pixel of the frame at half size, read as the GPU read it, steps through the
 * same arithmetic as `flashStep` - a rise of a tenth or more in light or in
 * saturated red, less than a third of a second behind the last one, is a
 * flash too soon. That arithmetic was measured to hold at any frame rate.
 *
 * HOW MUCH OF THE VIEW is WCAG 2.3.1's: flashes over more than a quarter of
 * any 10-degree visual field fail. A 10-degree field at an ordinary viewing
 * distance is about a third of the screen each way (WCAG's own figure: 341 x
 * 256 on a 1024 x 768 screen), so the window is a third of the frame across
 * and a third down, kept wholly inside it. Not the limiter's area rule, which
 * read the flags through clamped mips: at the frame's edge that counted a
 * strip a sixteenth of the frame wide - a fire along the bottom - as half its
 * window, and held flame tips the standard allows.
 *
 * AND ONLY FLASHES AT THE SAME MOMENT. WCAG counts the area of flashes
 * "occurring concurrently": the pixels that rose too soon within the last
 * `CONCURRENT_S`, never those still flagged from a rise a third of a second
 * ago, which is how the limiter held a pixel. Counted by its flags,
 * Hyperdrive's thin streaks crossing a dark tunnel - each pixel lit by a
 * streak and then by the next - added up to 59 % of a field over 80 % of the
 * demo, on frames where nothing but those thin lines was bright.
 */

/** More than this share of a window flashing fails (WCAG 2.3.1). */
export const FLASH_FIELD_FAIL = 0.25;
/** Under this share there is nothing an admin need look at. */
export const FLASH_FIELD_NOTICE = 0.1;
/** A window is this share of the frame each way: a 10-degree field. */
const FIELD_SHARE = 1 / 3;
/**
 * Flashes this close together are at the same moment: three frames at
 * thirty a second, so a flashing area whose pixels turn a frame or two apart
 * - a gradient strobing, a blur's soft edge - is still one flash.
 */
const CONCURRENT_S = 0.1;

/** A frame's own reading. */
export interface IFlashFrame {
  /** The most of any window that is flashing, 0..1. */
  area: number;
  /** Over WCAG's line: more than a quarter of a window flashing. */
  over: boolean;
}

export interface IFlashMeter {
  /**
   * One frame, `width` x `height` RGBA bytes as the scene drew it, `deltaMs`
   * after the last. The first frame is only remembered: a flash is a change.
   */
  frame(rgba: Uint8Array | Uint8ClampedArray, deltaMs: number): IFlashFrame;
}

/**
 * One frame of `flashStep` for every pixel at once, in place: the same
 * arithmetic, with the frame's decays worked out once instead of once a
 * pixel, and no object a pixel. `sceneFlashMeter.test.ts` holds the two
 * equal. `sinceFlash` beside it counts the seconds since each pixel last
 * rose too soon, which `flashStep` folds into its held flag.
 */
export const stepFlashPixels = (
  swings: Float32Array,
  travel: Float32Array,
  sinceTurn: Float32Array,
  flashing: Float32Array,
  sinceFlash: Float32Array,
  deltaMs: number,
): void => {
  const elapsed = Math.max(0, Math.min(MAX_FRAME_MS, deltaMs)) / 1000;
  const travelDecay = flashTravelDecay(deltaMs);
  const flashDecay = flashingDecay(deltaMs);
  for (let i = 0; i < swings.length; i += 1) {
    const last = travel[i];
    const turned = flashTravelled(last, swings[i], travelDecay);
    const rose = turned > 0 && last <= -FLASH_SWING;
    const gap = Math.min(MAX_GAP_S, sinceTurn[i] + elapsed);
    const tooSoon = rose && gap < FLASH_PERIOD_S - GAP_MARGIN_S;
    const held = gap < FLASH_PERIOD_S ? flashing[i] : flashing[i] * flashDecay;
    sinceTurn[i] = rose ? 0 : gap;
    flashing[i] = Math.max(held, tooSoon ? 1 : 0);
    travel[i] = turned;
    sinceFlash[i] = tooSoon ? 0 : Math.min(MAX_GAP_S, sinceFlash[i] + elapsed);
  }
};

/**
 * Light from the sum of a two-by-two block's bytes in one channel: the GPU's
 * mip averages the bytes as drawn, and only then is the average turned to
 * light. A table, because `pow` three times a pixel was most of the time.
 */
const LIGHT_OF_SUM = Float32Array.from(
  { length: 4 * 255 + 1 },
  (_, sum) => (sum / 4 / 255) ** 2.2,
);

/** Every corner from 0 to `last` by `step`, `last` itself included. */
const corners = (last: number, step: number) => {
  const at: number[] = [];
  for (let v = 0; v < last; v += step) {
    at.push(v);
  }
  at.push(Math.max(0, last));
  return at;
};

export const createFlashMeter = (
  width: number,
  height: number,
): IFlashMeter => {
  const halfWidth = Math.max(1, Math.floor(width / 2));
  const halfHeight = Math.max(1, Math.floor(height / 2));
  const count = halfWidth * halfHeight;
  const luma = new Float32Array(count);
  const red = new Float32Array(count);
  const lastLuma = new Float32Array(count);
  const lastRed = new Float32Array(count);
  const swings = new Float32Array(count);
  const travel = new Float32Array(count);
  const sinceTurn = new Float32Array(count).fill(FLASH_STATE_REST.sinceTurn);
  const flags = new Float32Array(count).fill(FLASH_STATE_REST.flashing);
  const sinceFlash = new Float32Array(count).fill(MAX_GAP_S);
  const fieldWidth = Math.max(1, Math.round(halfWidth * FIELD_SHARE));
  const fieldHeight = Math.max(1, Math.round(halfHeight * FIELD_SHARE));
  const row = halfWidth + 1;
  const sums = new Float64Array(row * (halfHeight + 1));
  // Windows a quarter of a window apart, so a flashing area never falls
  // between two of them, and a frame costs a few hundred reads.
  const columns = corners(
    halfWidth - fieldWidth,
    Math.max(1, Math.floor(fieldWidth / 4)),
  );
  const rows = corners(
    halfHeight - fieldHeight,
    Math.max(1, Math.floor(fieldHeight / 4)),
  );
  let first = true;

  const halve = (rgba: Uint8Array | Uint8ClampedArray) => {
    const stride = width * 4;
    for (let y = 0; y < halfHeight; y += 1) {
      const top = y * 2 * stride;
      const bottom = top + stride;
      for (let x = 0; x < halfWidth; x += 1) {
        const a = top + x * 8;
        const b = bottom + x * 8;
        const r = LIGHT_OF_SUM[rgba[a] + rgba[a + 4] + rgba[b] + rgba[b + 4]];
        const g =
          LIGHT_OF_SUM[rgba[a + 1] + rgba[a + 5] + rgba[b + 1] + rgba[b + 5]];
        const bl =
          LIGHT_OF_SUM[rgba[a + 2] + rgba[a + 6] + rgba[b + 2] + rgba[b + 6]];
        const i = y * halfWidth + x;
        luma[i] = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
        red[i] = Math.max(0, r - Math.max(g, bl));
      }
    }
  };

  /** The share of the window with its corner at (x, y) that is flashing. */
  const fieldAt = (x: number, y: number) =>
    (sums[(y + fieldHeight) * row + x + fieldWidth] -
      sums[y * row + x + fieldWidth] -
      sums[(y + fieldHeight) * row + x] +
      sums[y * row + x]) /
    (fieldWidth * fieldHeight);

  return {
    frame: (rgba, deltaMs) => {
      halve(rgba);
      if (first) {
        first = false;
        lastLuma.set(luma);
        lastRed.set(red);
        return { area: 0, over: false };
      }
      for (let i = 0; i < count; i += 1) {
        const lumaSwing = luma[i] - lastLuma[i];
        const redSwing = red[i] - lastRed[i];
        swings[i] =
          Math.abs(redSwing) > Math.abs(lumaSwing) ? redSwing : lumaSwing;
      }
      stepFlashPixels(swings, travel, sinceTurn, flags, sinceFlash, deltaMs);
      lastLuma.set(luma);
      lastRed.set(red);

      for (let y = 0; y < halfHeight; y += 1) {
        let line = 0;
        for (let x = 0; x < halfWidth; x += 1) {
          line += sinceFlash[y * halfWidth + x] < CONCURRENT_S ? 1 : 0;
          sums[(y + 1) * row + x + 1] = sums[y * row + x + 1] + line;
        }
      }
      let area = 0;
      rows.forEach((y) =>
        columns.forEach((x) => {
          area = Math.max(area, fieldAt(x, y));
        }),
      );
      return { area, over: area > FLASH_FIELD_FAIL };
    },
  };
};

/**
 * The review's word: `fails` over WCAG's line; `some` where flashing covers
 * part of a view within it, worth a look; `none` otherwise.
 */
export type TFlashVerdict = 'none' | 'some' | 'fails';

export const flashVerdictOf = (worstAreaShare: number): TFlashVerdict => {
  if (worstAreaShare > FLASH_FIELD_FAIL) {
    return 'fails';
  }
  return worstAreaShare > FLASH_FIELD_NOTICE ? 'some' : 'none';
};

/** The whole run, read once it is over. */
export interface IFlashSummary {
  /** Of the frames measured, the share over WCAG's line. */
  flashingShare: number;
  /** The most of any 10-degree window flashing on any frame, 0..1. */
  worstAreaShare: number;
  /** When it first went over WCAG's line, in seconds of music. */
  firstAtSeconds?: number;
  /** When the worst moment came. */
  worstAtSeconds: number;
  framesMeasured: number;
  /** How much music was measured, in seconds. */
  seconds: number;
  verdict: TFlashVerdict;
}

/** Folds frames as they come into the summary, keeping only what it needs. */
export const createFlashTally = () => {
  let frames = 0;
  let overFrames = 0;
  let worst = 0;
  let worstAt = 0;
  let firstAt: number | undefined;
  let lastAt = 0;
  return {
    add: (reading: IFlashFrame, atSeconds: number) => {
      frames += 1;
      lastAt = atSeconds;
      if (reading.over) {
        overFrames += 1;
        firstAt ??= atSeconds;
      }
      if (reading.area > worst) {
        worst = reading.area;
        worstAt = atSeconds;
      }
    },
    summary: (): IFlashSummary => ({
      flashingShare: frames ? overFrames / frames : 0,
      worstAreaShare: worst,
      ...(firstAt !== undefined ? { firstAtSeconds: firstAt } : {}),
      worstAtSeconds: worstAt,
      framesMeasured: frames,
      seconds: lastAt,
      verdict: flashVerdictOf(worst),
    }),
  };
};
