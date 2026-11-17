/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { toLinear } from '../utils/oklab';

/**
 * Which ink the words standing on a scene wear — the EQ head's, and each of
 * the graph's figures: near-white with a soft dark shadow over most
 * pictures, the floor's dark with a soft light shadow over a bright one
 * (Ivan, 2026-11-17: "can Fluid also detect when the scene is very bright
 * and put them the other way round, black and white"; then the dB figures
 * too). Decided for each from the mean relative luminance of the picture
 * behind it, read on the scene's own frames (`sceneProbe.ts`).
 */
export type TSceneInk = 'light' | 'dark';

/**
 * The part of the scene's canvas to read: fractions of its width and height,
 * from its top-left corner — left, top, right, bottom.
 */
export type TSceneProbeRect = readonly [number, number, number, number];

/**
 * Where words turn to dark ink, and where they turn back: mean relative
 * luminance of the picture behind them, 0 for black and 1 for white.
 *
 * The head's resting words are the primary ink at 82% and the figures the
 * muted ink, both about 0.8 luminance where they lie, and the dark ink is
 * the floor (about 0.01), so the two read equally well by WCAG contrast over
 * a picture at 0.18. Light ink keeps the
 * strip well past that because its shadow draws an edge of its own, so the
 * turn is set where light ink has truly run out: at 0.45 (a pale sky, about
 * #9ab6d4) the light words are at 1.7:1 and the dark ones at 8:1. Back below
 * 0.34 (a mid sky, about #86a0bd), where light ink is at 2.2:1 again with its
 * shadow under it. The coordinator's first guess, 0.62 and 0.5, left the
 * words light up to a sky of #bcd2e8 — 1.3:1, the weak words that were
 * reported. The 0.11 between the two is a band, so a sky pulsing with the
 * beat, already smoothed below, stays on one side of it.
 */
export const SCENE_INK_DARK_ABOVE = 0.45;
export const SCENE_INK_LIGHT_BELOW = 0.34;

/**
 * How much of each new reading the followed level takes: a reading comes
 * every few frames, so a flash on one frame or a cloud crossing the strip
 * moves the level by a quarter of its size, and a whole change of picture —
 * a new scene, the camera turned to the sky — lands in a handful of readings.
 */
export const SCENE_INK_SMOOTHING = 0.25;

/**
 * The mean relative luminance of `rgba`, bytes in sRGB as WebGL reads them.
 * Each pixel is taken to linear light before it is averaged, because the eye
 * judges a strip by the light it sends, not by its byte values: a strip half
 * white and half black is 0.5, not the 0.21 of its average byte.
 */
export const meanRelativeLuminance = (rgba: Uint8Array): number => {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) {
    return 0;
  }
  let sum = 0;
  for (let at = 0; at < pixels * 4; at += 4) {
    sum +=
      0.2126 * toLinear(rgba[at] / 255) +
      0.7152 * toLinear(rgba[at + 1] / 255) +
      0.0722 * toLinear(rgba[at + 2] / 255);
  }
  return sum / pixels;
};

export interface ISceneInkFollower {
  /** A new reading of the strip; answers the ink it now calls for. */
  hear(luminance: number): TSceneInk;
  /** Forget the picture: the next reading is taken as it is. */
  reset(): void;
}

/** Follows the strip's readings and turns the ink only past the band. */
export const createSceneInkFollower = (): ISceneInkFollower => {
  let level: number | undefined;
  let ink: TSceneInk = 'light';
  return {
    hear: (luminance) => {
      if (!Number.isFinite(luminance)) {
        return ink;
      }
      level =
        level === undefined
          ? luminance
          : level + (luminance - level) * SCENE_INK_SMOOTHING;
      if (ink === 'light' && level > SCENE_INK_DARK_ABOVE) {
        ink = 'dark';
      } else if (ink === 'dark' && level < SCENE_INK_LIGHT_BELOW) {
        ink = 'light';
      }
      return ink;
    },
    reset: () => {
      level = undefined;
      ink = 'light';
    },
  };
};
