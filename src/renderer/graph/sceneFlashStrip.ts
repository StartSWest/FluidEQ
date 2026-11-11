/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The frames around the worst moment of a review's measurement
 * (`sceneFlashMeasure.ts`), kept as they are drawn so the admin sees what
 * flashed without waiting for it on the live stage: two before it, the worst
 * frame itself and two after.
 *
 * Kept in buffers made once, never a copy of every frame: a minute at thirty
 * frames a second is eighteen hundred frames of half a megabyte.
 */

/** Frames kept either side of the worst one. */
const AROUND = 2;

export interface IFilmstrip {
  /** The kept frames, oldest first: fewer near the start or end of the run. */
  frames: Uint8Array[];
  /** Which of them is the worst moment. */
  worst: number;
}

export const createFilmstripKeeper = (frameBytes: number) => {
  // The last frames drawn, the newest at `ringAt - 1`.
  const ring = Array.from({ length: AROUND }, () => new Uint8Array(frameBytes));
  let ringFilled = 0;
  let ringAt = 0;
  const kept = Array.from(
    { length: AROUND * 2 + 1 },
    () => new Uint8Array(frameBytes),
  );
  let keptCount = 0;
  let worst = 0;
  let worstArea = -1;
  let after = 0;

  return {
    /** A frame just drawn, and how much of it flashes. */
    push: (pixels: Uint8Array, area: number) => {
      if (area > worstArea) {
        worstArea = area;
        keptCount = 0;
        for (let back = ringFilled; back > 0; back -= 1) {
          kept[keptCount].set(ring[(ringAt - back + AROUND * 2) % AROUND]);
          keptCount += 1;
        }
        worst = keptCount;
        kept[keptCount].set(pixels);
        keptCount += 1;
        after = AROUND;
      } else if (after > 0) {
        kept[keptCount].set(pixels);
        keptCount += 1;
        after -= 1;
      }
      ring[ringAt].set(pixels);
      ringAt = (ringAt + 1) % AROUND;
      ringFilled = Math.min(AROUND, ringFilled + 1);
    },
    strip: (): IFilmstrip => ({
      frames: kept.slice(0, keptCount),
      worst,
    }),
  };
};

/** `rgba` read back by WebGL, bottom row first, turned the right way up. */
export const flipRows = (
  rgba: Uint8Array,
  width: number,
  height: number,
): Uint8ClampedArray<ArrayBuffer> => {
  const stride = width * 4;
  const out = new Uint8ClampedArray(rgba.length);
  for (let y = 0; y < height; y += 1) {
    out.set(
      rgba.subarray(y * stride, (y + 1) * stride),
      (height - 1 - y) * stride,
    );
  }
  return out;
};
