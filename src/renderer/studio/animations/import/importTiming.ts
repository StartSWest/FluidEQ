/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_ANIMATION_FRAMES } from 'common/studioAnimation';

/**
 * A scene's animation plays every frame for the same time. Frames that
 * each say how long they are shown (a GIF's delays, Aseprite's durations)
 * are played at one speed by showing a long frame on more than one cell:
 * the speed is the one the shortest frame needs, and each frame takes as
 * many cells as its time fills at it. Too many cells for one sheet, and the
 * speed comes down until they fit.
 */

/** Without a timing of its own, a frame is shown this long. */
export const DEFAULT_FRAME_MS = 1000 / 12;
/**
 * Browsers play a GIF frame of less than 20 ms at 100 ms, and every GIF
 * made for them was timed against that; read any other way such a GIF
 * races.
 */
const SHORTEST_PLAYED_MS = 20;
const SLOW_FRAME_MS = 100;
const MOST_FPS = 60;

export interface IImportTiming {
  fps: number;
  /** The source frames, in the order and number of cells they fill. */
  cells: number[];
}

/** How long each frame is played, as a browser would play it. */
const played = (duration: number | undefined, fallback: number) => {
  if (duration === undefined || !Number.isFinite(duration)) {
    return fallback;
  }
  return duration < SHORTEST_PLAYED_MS ? SLOW_FRAME_MS : duration;
};

/**
 * The speed and cells for frames shown `durations` milliseconds each (an
 * entry undefined: `fallback`), `order` giving the frames as played; at
 * most `most` cells. Undefined when there are no frames, or more than
 * `most` even at one cell each.
 */
export const importTiming = (
  order: readonly number[],
  durations: ReadonlyArray<number | undefined>,
  fallback = DEFAULT_FRAME_MS,
  most = MAX_ANIMATION_FRAMES,
): IImportTiming | undefined => {
  if (order.length === 0 || order.length > most) {
    return undefined;
  }
  const times = order.map((index) => played(durations[index], fallback));
  const shortest = Math.min(...times);
  let fps = Math.min(MOST_FPS, Math.max(1, Math.round(1000 / shortest)));
  // Each pass lowers the speed by the share the cells overran (a whole
  // number under the last, so it ends). Still too many at 1 fps - frames of
  // seconds each - and every frame takes one cell: the order kept, the
  // long holds shortened, rather than nothing imported.
  for (;;) {
    const step = 1000 / fps;
    const cells = order.flatMap((index, at) =>
      Array<number>(Math.max(1, Math.round(times[at] / step))).fill(index),
    );
    if (cells.length <= most) {
      return { fps, cells };
    }
    if (fps === 1) {
      return { fps, cells: [...order] };
    }
    fps = Math.max(1, Math.floor((fps * most) / cells.length));
  }
};
