/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { displayTickMs, isFrameDue } from '../utils/framePace';
import type { ILiveTraceDriver } from './LiveTraceCanvas';

/**
 * The tiles' pace: every frame of a 60 Hz display, and no more. Not the
 * graph's 165 Hz (`WINDOW_DRAWING_PACE_MS`): a browser with no display
 * limit ran this loop at 240 frames a second, and sixteen tiles drawn that
 * often took a whole core for drawings 140 px wide, where a step finer than
 * a 60 Hz frame is nothing an eye follows. Not the thirty a second either,
 * which Ivan took out of the window on 2026-09-27 as visibly stepped.
 */
const TILE_PACE_MS = 1000 / 60;

/**
 * The one animation loop behind every live tile of the look picker's
 * standard looks (`LookStyleGrid`). Each tile's drawing hands its frames
 * over (`LiveTraceCanvas`'s `onDriver`) and this draws them all in one
 * animation frame, at `TILE_PACE_MS`: a loop per tile would be forty
 * loops, each asking the display for its own frames. The music is not read
 * here at all - every tile draws the frame the sound published
 * (`lookTileSound.tsx`), read once for all of them.
 *
 * It runs only while a tile is registered - a tile registers while it is in
 * the picker's scroller and its look is live - and never while the window
 * is hidden: an animation frame is not given to a hidden page, and the
 * first one after it is drawn as one frame's step, not the whole absence.
 */
export interface ILookTileLoop {
  /** Draws `driver` with the others until the returned function is called. */
  add: (driver: ILiveTraceDriver) => () => void;
  /** Stops for good: the grid is gone. */
  dispose: () => void;
}

export const createLookTileLoop = (): ILookTileLoop => {
  const drivers = new Set<ILiveTraceDriver>();
  let handle: number | undefined;
  let lastDrawAt: number | undefined;
  let lastTickAt: number | undefined;
  let tickMs = 1000 / 60;

  const stop = () => {
    if (handle !== undefined) {
      cancelAnimationFrame(handle);
      handle = undefined;
    }
    lastDrawAt = undefined;
    lastTickAt = undefined;
  };

  const tick = (now: number) => {
    handle = requestAnimationFrame(tick);
    tickMs = displayTickMs(now, lastTickAt, tickMs);
    lastTickAt = now;
    if (lastDrawAt === undefined) {
      // The first frame after a start draws a frame's step, not the time
      // since whatever stopped the loop.
      lastDrawAt = now - tickMs;
    }
    const elapsed = Math.max(0, now - lastDrawAt);
    if (!isFrameDue(elapsed, TILE_PACE_MS, tickMs)) {
      return;
    }
    lastDrawAt = now;
    drivers.forEach((driver) => driver.draw(elapsed));
  };

  const start = () => {
    if (handle === undefined && drivers.size > 0 && !document.hidden) {
      handle = requestAnimationFrame(tick);
    }
  };

  const onVisibility = () => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  };
  // Listened to only while there is something to draw.
  const release = () => {
    document.removeEventListener('visibilitychange', onVisibility);
    stop();
  };

  return {
    add: (driver) => {
      if (drivers.size === 0) {
        document.addEventListener('visibilitychange', onVisibility);
      }
      drivers.add(driver);
      start();
      return () => {
        if (drivers.delete(driver) && drivers.size === 0) {
          release();
        }
      };
    },
    dispose: () => {
      drivers.clear();
      release();
    },
  };
};
