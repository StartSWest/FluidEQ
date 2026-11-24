/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { displayTickMs, isFrameDue } from '../utils/framePace';
import type { ILiveTraceDriver } from './LiveTraceCanvas';

/**
 * Each tile's pace: thirty drawings a second. Ivan, 2026-11-24: "make sure
 * they are very light, we don't want to block the user's PC loading or
 * showing the animated graphs". At sixty, sixteen tiles took 241 ms of
 * script a second in the harness (a quarter of a core, for drawings 140 px
 * wide); a preview this size is still read as moving at thirty. The window's
 * own graph keeps the display's rate - the thirty Ivan took out of it on
 * 2026-09-27 was the look itself, at full size.
 */
const TILE_PACE_MS = 1000 / 30;

/**
 * The share of one core the tiles may spend drawing, all of them together,
 * measured on the page's own clock: 80 ms of every second. A budget per
 * animation frame was not one - a display or a headless page giving 150
 * frames a second spent it 150 times - so it is earned with the time that
 * passes and spent by what each drawing measured. When it runs out the
 * tiles still due wait, the one that waited first drawing first: on a
 * machine where a drawing costs more the tiles draw less often, instead of
 * the menu taking the window, the music and the graph behind it. A tile's
 * very first drawing is never held back, so no plate stands empty for want
 * of a turn.
 */
const CORE_SHARE = 0.08;

/**
 * The most that can be saved up and spent in one animation frame: after a
 * quiet moment the tiles draw at once, never as one long frame.
 */
const LONGEST_SPEND_MS = 4;

/**
 * The one animation loop behind every live tile of the look picker's
 * standard looks (`LookStyleGrid`). Each tile's drawing hands its frames
 * over (`LiveTraceCanvas`'s `onDriver`) and this draws them in one
 * animation frame, each at `TILE_PACE_MS` and all within `CORE_SHARE`:
 * a loop per tile would be forty loops, each asking the display for its own
 * frames. The music is not read here at all - every tile draws the frame
 * the sound published (`lookTileSound.tsx`), read once for all of them.
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

interface ITile {
  driver: ILiveTraceDriver;
  /** When it last drew, on the animation frames' clock; never, undefined. */
  drawnAt: number | undefined;
}

export const createLookTileLoop = (): ILookTileLoop => {
  // In the order they wait: a tile that drew goes to the back.
  let tiles: ITile[] = [];
  let handle: number | undefined;
  let lastTickAt: number | undefined;
  let tickMs = 1000 / 60;
  /** What the tiles may still spend, in ms; under zero, owed. */
  let saved = LONGEST_SPEND_MS;

  const stop = () => {
    if (handle !== undefined) {
      cancelAnimationFrame(handle);
      handle = undefined;
    }
    lastTickAt = undefined;
    // The first frame after a start draws a frame's step, not the time
    // since whatever stopped the loop.
    tiles.forEach((tile) => {
      tile.drawnAt = undefined;
    });
  };

  const tick = (now: number) => {
    handle = requestAnimationFrame(tick);
    if (lastTickAt !== undefined) {
      saved = Math.min(
        LONGEST_SPEND_MS,
        saved + Math.max(0, now - lastTickAt) * CORE_SHARE,
      );
    }
    tickMs = displayTickMs(now, lastTickAt, tickMs);
    lastTickAt = now;
    const drawn: ITile[] = [];
    const waiting: ITile[] = [];
    tiles.forEach((tile) => {
      const first = tile.drawnAt === undefined;
      const elapsed = first ? tickMs : Math.max(0, now - (tile.drawnAt ?? now));
      const due = first || isFrameDue(elapsed, TILE_PACE_MS, tickMs);
      if (due && (first || saved > 0)) {
        tile.drawnAt = now;
        const startedAt = performance.now();
        tile.driver.draw(elapsed);
        saved -= performance.now() - startedAt;
        drawn.push(tile);
      } else {
        waiting.push(tile);
      }
    });
    tiles = [...waiting, ...drawn];
  };

  const start = () => {
    if (handle === undefined && tiles.length > 0 && !document.hidden) {
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
      if (tiles.length === 0) {
        document.addEventListener('visibilitychange', onVisibility);
      }
      const tile: ITile = { driver, drawnAt: undefined };
      tiles = [...tiles, tile];
      start();
      return () => {
        const before = tiles.length;
        tiles = tiles.filter((each) => each !== tile);
        if (tiles.length < before && tiles.length === 0) {
          release();
        }
      };
    },
    dispose: () => {
      tiles = [];
      release();
    },
  };
};
