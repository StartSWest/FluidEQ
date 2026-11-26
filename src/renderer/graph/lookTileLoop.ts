/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { displayTickMs } from '../utils/framePace';
import type { ILiveTraceDriver } from './LiveTraceCanvas';

/**
 * The animation loop behind the look picker's live standard look
 * (`LookStyleGrid`): the tile's drawing hands its frames over
 * (`LiveTraceCanvas`'s `onDriver`) and this draws them on every animation
 * frame the display gives, at its full rate (Ivan, 2026-11-26: "only the
 * selected one, and at full unlimited fps"). Only the one tile the pointer
 * or the keyboard is on is live (`onePlaying.ts`), so there is one drawing
 * here at a time; it used to be every tile in view, each held to twelve a
 * second under a shared budget, and that pace and budget went with them.
 * The music is not read here at all: the tile draws the frame the sound
 * published (`lookTileSound.tsx`).
 *
 * It runs only while a drawing is registered, and never while the window is
 * hidden: an animation frame is not given to a hidden page, and the first
 * one after it is drawn as one frame's step, not the whole absence.
 */
export interface ILookTileLoop {
  /** Draws `driver` on every frame until the returned function is called. */
  add: (driver: ILiveTraceDriver) => () => void;
  /** Stops for good: the grid is gone. */
  dispose: () => void;
}

export const createLookTileLoop = (): ILookTileLoop => {
  let drivers: readonly ILiveTraceDriver[] = [];
  let handle: number | undefined;
  let lastTickAt: number | undefined;
  let tickMs = 1000 / 60;

  const stop = () => {
    if (handle !== undefined) {
      cancelAnimationFrame(handle);
      handle = undefined;
    }
    // The first frame after a start draws a frame's step, not the time
    // since whatever stopped the loop.
    lastTickAt = undefined;
  };

  const tick = (now: number) => {
    handle = requestAnimationFrame(tick);
    // The display's own frame, never a jump past the longest a display
    // takes (`displayTickMs`): one late frame is not a skip in the drawing.
    tickMs = displayTickMs(now, lastTickAt, tickMs);
    lastTickAt = now;
    drivers.forEach((driver) => driver.draw(tickMs));
  };

  const start = () => {
    if (handle === undefined && drivers.length > 0 && !document.hidden) {
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
      if (drivers.length === 0) {
        document.addEventListener('visibilitychange', onVisibility);
      }
      drivers = [...drivers, driver];
      start();
      return () => {
        const before = drivers.length;
        drivers = drivers.filter((each) => each !== driver);
        if (before > 0 && drivers.length === 0) {
          release();
        }
      };
    },
    dispose: () => {
      drivers = [];
      release();
    },
  };
};
