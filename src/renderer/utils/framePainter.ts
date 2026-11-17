/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { displayTickMs, isFrameDue, WINDOW_DRAWING_PACE_MS } from './framePace';

export interface IFramePainter {
  /** Paint in the next frame that is due; any number of asks is one paint. */
  request: () => void;
  /** Forget a paint that was asked for and has not happened. */
  cancel: () => void;
}

/**
 * One paint per frame, however many things ask for one, held to the window's
 * drawing pace (`WINDOW_DRAWING_PACE_MS`). The first ask after a rest paints
 * on the very next frame.
 *
 * For a canvas painted from many places at once: a pointer move, the render
 * it causes, a tick of the playhead and a resize can all land between two
 * frames, and painted on each the same picture went to the graphics process
 * three or four times over.
 */
export const createFramePainter = (paint: () => void): IFramePainter => {
  let frame: number | undefined;
  let lastPaintAt: number | undefined;
  let lastTickAt: number | undefined;
  let tickMs = 1000 / 60;
  const run = (now: number) => {
    frame = undefined;
    tickMs = displayTickMs(now, lastTickAt, tickMs);
    lastTickAt = now;
    if (
      lastPaintAt !== undefined &&
      !isFrameDue(now - lastPaintAt, WINDOW_DRAWING_PACE_MS, tickMs)
    ) {
      frame = requestAnimationFrame(run);
      return;
    }
    lastPaintAt = now;
    paint();
  };
  return {
    request: () => {
      if (frame === undefined) {
        frame = requestAnimationFrame(run);
      }
    },
    cancel: () => {
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
        frame = undefined;
      }
    },
  };
};
