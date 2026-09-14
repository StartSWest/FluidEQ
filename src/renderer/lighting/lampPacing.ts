/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { READBACK_MS } from '../graph/sceneDrawWatch';

/**
 * The size the lamps draw a scene at, frame by frame: as large as the GPU
 * keeps in time, smaller when it does not — never the scene given up for
 * being slow.
 *
 * The lamps used to give a scene up on its first frames, or after two late
 * ones, and the desk then showed the scene's colours as bars for the rest of
 * the session. Neither was the scene's weight. A program's first draws carry
 * the driver's one-time work on it: Alpine's took 50 to 114 ms, then drew in
 * 6. And a frame waits behind whatever else shares the GPU — the graph, the
 * Studio, a desktop visualizer on each monitor. Drawing smaller answers a
 * scene that really is heavy — a quarter of the pixels, a quarter of the work,
 * and the lamps only sample a 48 by 27 grid of it — so the real picture stays
 * on the lamps and on the desk.
 *
 * A scene starts at the smallest size and climbs while each size leaves room
 * for the next, so nothing large reaches the GPU before a small draw of it has
 * shown what it costs; a frame of a member's scene built to hold the GPU holds
 * it for a sliver of the time at 96 by 54. Only a scene that holds the GPU even
 * there, long enough to be what resets a display, is given up.
 *
 * Pure: the worker times each frame — drawn, and waited for — and says so.
 */

/** Largest first, each a quarter of the pixels of the one before. */
export const LAMP_SIZES = [
  [768, 432],
  [384, 216],
  [192, 108],
  [96, 54],
] as const;

export type TLampSize = (typeof LAMP_SIZES)[number];

/** A lamp frame, drawn and waited for, within the lamps' tick and a bit. */
export const LAMP_FRAME_MS = 40;

/**
 * The share of a lamp frame a larger size is expected to fill before it is
 * tried. Short of the whole frame, so the estimate's error and a busy GPU's
 * wait do not carry it straight into late frames and back down again.
 */
export const ROOM_TO_GROW = 0.75;

/** Late this many frames running, the next frame is drawn a size smaller. */
export const LATE_RUN = 3;

/** Frames timed at a size before a larger one is tried, while climbing. */
export const CLIMB_WINDOW = 3;

/**
 * Frames timed at a size before a larger one is tried again, once the climb
 * has stopped: a second of the lamps' ticks, so a busy GPU does not make the
 * picture pump between two sizes.
 */
export const SETTLED_WINDOW = 30;

/**
 * Frames before a size that was late is tried again: five seconds of ticks,
 * doubling each time it is late again, up to a minute.
 */
export const FIRST_REST = 150;
export const MAX_REST = 1800;

/**
 * A frame this slow at the smallest size is the scene holding the GPU — it
 * would be sixteen seconds at the largest — and not anything sharing it.
 */
export const HOPELESS_FRAME_MS = 250;

export type TLampPace = 'same' | 'smaller' | 'larger' | 'give-up';

export interface ILampPacing {
  size(): TLampSize;
  /**
   * How long the last frame at `size()` took. The first frame after a change
   * of size carries the new size's own warm-up and is not counted.
   */
  record(elapsedMs: number): TLampPace;
}

const quartile = (times: readonly number[], at: number) => {
  const sorted = [...times].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * at)];
};

/** The upper quartile: a frame in four may wait behind somebody else's. */
const upperQuartile = (times: readonly number[]) => quartile(times, 0.75);

/** The lower quartile: the frames that did not wait behind anyone. */
const lowerQuartile = (times: readonly number[]) => quartile(times, 0.25);

export const createLampPacing = (): ILampPacing => {
  const smallest = LAMP_SIZES.length - 1;
  let step = smallest;
  let climbing = true;
  let warming = true;
  let late = 0;
  let hopeless = 0;
  let times: number[] = [];
  /** A frame's cost that does not grow with its size, from the smallest. */
  let fixed = READBACK_MS;
  /** The size last come down from for being late, and frames before it. */
  let blocked = -1;
  let resting = 0;
  let rest = FIRST_REST;
  const change = (next: number): TLampPace => {
    const pace = next > step ? 'smaller' : 'larger';
    step = next;
    late = 0;
    times = [];
    warming = true;
    return pace;
  };
  return {
    size: () => LAMP_SIZES[step],
    record: (elapsedMs) => {
      if (warming) {
        warming = false;
        return 'same';
      }
      if (step === smallest && elapsedMs > HOPELESS_FRAME_MS) {
        hopeless += 1;
        // Twice, so one stall of somebody else's is not the scene's.
        return hopeless >= 2 ? 'give-up' : 'same';
      }
      hopeless = 0;
      // Late frames count towards the quartile too: a size where every other
      // frame is late is not one with room to grow.
      times.push(elapsedMs);
      if (times.length > SETTLED_WINDOW) {
        times.shift();
      }
      if (resting > 0) {
        resting -= 1;
      }
      if (elapsedMs > LAMP_FRAME_MS) {
        late += 1;
        if (late >= LATE_RUN && step < smallest) {
          climbing = false;
          // The size this came down from waits before it is tried again,
          // longer each time it fails: an estimate that keeps being wrong
          // about a scene must not keep making the lamps late.
          blocked = step;
          resting = rest;
          rest = Math.min(MAX_REST, rest * 2);
          return change(step + 1);
        }
        return 'same';
      }
      late = 0;
      const window = climbing ? CLIMB_WINDOW : SETTLED_WINDOW;
      if (step === smallest && times.length >= window) {
        fixed = lowerQuartile(times.slice(-window));
      }
      if (
        step === 0 ||
        times.length < window ||
        (step - 1 === blocked && resting > 0)
      ) {
        return 'same';
      }
      // The next size up has four times the pixels. What does not grow with
      // them — the wait for the frame, the flash limiter's passes, whatever
      // else the GPU is doing — is what a frame at the smallest size costs;
      // counting it four times over held member's scenes at 96 by 54 for six
      // seconds. The rest, four times over, still in time with a quarter of
      // the frame to spare.
      const drawing = Math.max(0, upperQuartile(times.slice(-window)) - fixed);
      if (fixed + drawing * 4 < LAMP_FRAME_MS * ROOM_TO_GROW) {
        return change(step - 1);
      }
      climbing = false;
      return 'same';
    },
  };
};
