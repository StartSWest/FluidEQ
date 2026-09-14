/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneFrame } from './sceneGl';

/**
 * A frame this long is the scene holding the GPU, not a slow one: the ladder
 * steps a scene down long before a frame costs half a second, and Windows
 * resets the driver at two. A context lost right after one is the scene's
 * doing — and only then is it: sleep, a driver update and another program's
 * crash lose every context on the machine, whatever each was drawing.
 */
export const BLAMED_FRAME_MS = 500;

/**
 * Keeps every draw of a scene its own job on the GPU, and gives the scene up
 * when a job takes too long for its size.
 *
 * Windows resets the display — every program's, not only FluidEQ's — when one
 * job holds the GPU for two seconds, and a member's scene can be written to be
 * that heavy. Frames sent without waiting reach the GPU as one job, so each
 * draw here is followed by `finish`, which waits for it (a one-pixel read), and
 * is timed. The first frame climbs a ladder of sizes at its own instant before
 * it is drawn in full: a scene built to hold the GPU holds it for a sliver of
 * the time at a tiny size first, and is given up on there.
 *
 * Plain callbacks rather than a context, so the rule can be tested without a
 * GPU. The lamps pace their draws by size instead (`lampPacing.ts`): they
 * have a smaller picture to fall back on, where a still has only its one size.
 */

export interface IDrawWatchOptions {
  draw(frame: ISceneFrame, width: number, height: number): void;
  /** Waits for the GPU to finish what was drawn. */
  finish(): void;
  isLost(): boolean;
  now(): number;
  /** The GPU time one pixel may take, in milliseconds. */
  msPerPixel: number;
  /** Sizes the first frame is drawn at first, smallest first. */
  ladder: readonly (readonly [number, number])[];
}

/** Draws `frame`, through `draw` when given; false once the scene is given up. */
export type TDrawWatch = (
  frame: ISceneFrame,
  width: number,
  height: number,
  draw?: () => void,
) => boolean;

/** Waiting for one pixel to come back costs about a millisecond on its own. */
export const READBACK_MS = 4;
/**
 * The very first, tiniest draw carries the driver's own one-time warm-up of
 * the program, which has nothing to do with how heavy the scene is.
 */
export const FIRST_DRAW_MS = 250;
/**
 * A draw this many times past its allowance is given up on at once; one just
 * past it gets one more chance, since another context in the window may have
 * been using the GPU at that moment.
 */
export const FAR_PAST = 4;

const timedDraw = (
  { finish, now }: Pick<IDrawWatchOptions, 'finish' | 'now'>,
  run: () => void,
) => {
  const started = now();
  run();
  finish();
  return now() - started;
};

const allowanceOf = (msPerPixel: number, width: number, height: number) =>
  width * height * msPerPixel + READBACK_MS;

/**
 * Draws `frame`'s instant up the ladder, smallest first; false at the first
 * step the scene is far too slow for, before anything larger is drawn.
 *
 * A step over its limit is drawn once more before it counts. The first draws
 * of a program just linked carry the driver's one-time work on it — at each
 * size, not only the first. Measured on Alpine in the lamps' worker, the same
 * ladder with this rule's limits, that alone was 50 to 114 ms at sizes whose
 * limit is 18: Alpine was given up one load in three, and drew its frames in
 * 6 ms on the loads it was not. The warm-up does not come twice; a scene heavy
 * enough to matter is as slow the second time.
 */
const climbLadder = (
  options: IDrawWatchOptions,
  frame: ISceneFrame,
): boolean => {
  const { draw, isLost, msPerPixel, ladder } = options;
  // The frame's own instant, with no time passing: a scene's easing
  // advances by elapsed time, and these draws must not move it.
  const still = { ...frame, deltaMs: 0 };
  return !ladder.some(([stepWidth, stepHeight], step) => {
    const allowance = allowanceOf(msPerPixel, stepWidth, stepHeight) * FAR_PAST;
    const limit = step === 0 ? Math.max(FIRST_DRAW_MS, allowance) : allowance;
    const over = () =>
      timedDraw(options, () => draw(still, stepWidth, stepHeight)) > limit;
    return isLost() || (over() && (isLost() || over()));
  });
};

export const createDrawWatch = (options: IDrawWatchOptions): TDrawWatch => {
  const { draw, isLost, msPerPixel } = options;
  let climbed = false;
  let late = false;
  let givenUp = false;
  /** Sizes a real frame has been drawn at, whose warm-up is behind them. */
  const warmed = new Set<string>();
  const giveUp = () => {
    givenUp = true;
    return false;
  };
  return (frame, width, height, drawFrame) => {
    if (givenUp) {
      return false;
    }
    if (!climbed) {
      climbed = true;
      if (!climbLadder(options, frame)) {
        return giveUp();
      }
    }
    const elapsed = timedDraw(
      options,
      drawFrame ?? (() => draw(frame, width, height)),
    );
    const allowed = allowanceOf(msPerPixel, width, height);
    const size = `${width}x${height}`;
    const firstAtSize = !warmed.has(size);
    warmed.add(size);
    // The first frame at a size carries its warm-up (see `climbLadder`): far
    // past its allowance it is one late frame, not the end — unless it held
    // the GPU as long as a scene that resets it does.
    const farPast = firstAtSize
      ? elapsed > BLAMED_FRAME_MS
      : elapsed > allowed * FAR_PAST;
    if (isLost() || farPast) {
      return giveUp();
    }
    if (elapsed > allowed) {
      if (late) {
        return giveUp();
      }
      late = true;
    } else {
      late = false;
    }
    return true;
  };
};
