/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ITextureArea } from './texturePictures';
import type { ITexturePose } from './textureMotion';

/** One copy of a texture: where it lies, in CSS pixels, and if it repeats. */
export interface ICopyPlace {
  x: number;
  y: number;
  width: number;
  height: number;
  repeat: boolean;
}

/**
 * How much larger a picture over the whole plot is drawn at each side while
 * it moves: the margin it sways in. Redrawn once at that size
 * (`coverAreaOf`), so once the motion has eased in it is printed one to one
 * like a still one, never resampled every frame.
 */
export const COVER_SWAY = 0.02;

/** The plot a picture over it is redrawn for: grown into its margin while it moves. */
export const coverAreaOf = (
  area: ITextureArea,
  pose: ITexturePose | undefined,
): ITextureArea => {
  if (!pose) {
    return area;
  }
  const across = (area.right - area.left) * COVER_SWAY;
  const down = (area.bottom - area.top) * COVER_SWAY;
  return {
    left: area.left - across,
    right: area.right + across,
    top: area.top - down,
    bottom: area.bottom + down,
  };
};

const wrapped = (at: number, period: number) =>
  period > 0 ? at - Math.floor(at / period) * period : at;

/** To the nearest whole device pixel, `pixel` CSS pixels wide. */
const snapped = (at: number, pixel: number) => Math.round(at / pixel) * pixel;

/** CSS pixels a device pixel covers, at a display's ratio. */
export const pixelAt = (scale: number) => 1 / Math.max(0.5, scale);

/**
 * Where one copy of a texture lies once the music has moved it
 * (`textureMotion.ts`): the one rule the page's pattern and the engine's
 * rectangle are both laid by, so the two print the texture in the same
 * place.
 *
 * In whole device pixels (`pixel` CSS pixels each). Between them, both
 * painters filter the tile, and every hairline went soft and sharp again as
 * it travelled; on whole pixels a stroke stays the stroke it is still, and
 * the page and the engine print it pixel for pixel alike. At the speeds a
 * texture moves, a step of one device pixel is under a frame or two apart.
 *
 * A tile that repeats is carried by the pose and put back by whole copies of
 * itself, which changes nothing drawn and keeps the numbers small, as the
 * engine's float uniforms need: a texture that drifted for an hour is
 * thousands of pixels from where it began. A picture over the whole plot
 * (`copy`, redrawn grown into its margin by `coverAreaOf`) is shown as much
 * of that margin as the pose's `reach` has eased into, its travel folded
 * into a sway inside it: no edge of it ever comes into the plot, and at rest
 * it covers the plot exactly.
 */
export const movedPlacement = (
  copy: ICopyPlace,
  pose: ITexturePose,
  pixel: number,
): ICopyPlace => {
  if (copy.repeat) {
    return {
      x: snapped(wrapped(copy.x + pose.x, copy.width), pixel),
      y: snapped(wrapped(copy.y + pose.y, copy.height), pixel),
      width: copy.width,
      height: copy.height,
      repeat: true,
    };
  }
  const grown = 1 + 2 * COVER_SWAY;
  const plotWidth = copy.width / grown;
  const plotHeight = copy.height / grown;
  const plotX = copy.x + COVER_SWAY * plotWidth;
  const plotY = copy.y + COVER_SWAY * plotHeight;
  const margin = COVER_SWAY * pose.reach;
  const width = plotWidth * (1 + 2 * margin);
  const height = plotHeight * (1 + 2 * margin);
  // One radian of sway for every reach of travel, whatever the margin: the
  // sway's pace is the travel's, and only its extent eases in.
  const reachX = Math.max(1, plotWidth * COVER_SWAY);
  const reachY = Math.max(1, plotHeight * COVER_SWAY);
  const swayX = plotX - plotWidth * margin * (1 - Math.sin(pose.x / reachX));
  const swayY = plotY - plotHeight * margin * (1 - Math.sin(pose.y / reachY));
  // Snapped, then held where it still covers the plot: a pixel's rounding
  // must never open a sliver of the floor at an edge.
  const within = (at: number, low: number, high: number) =>
    Math.min(high, Math.max(low, at));
  return {
    x: within(snapped(swayX, pixel), plotX + plotWidth - width, plotX),
    y: within(snapped(swayY, pixel), plotY + plotHeight - height, plotY),
    width,
    height,
    repeat: false,
  };
};

/**
 * A repeating tile's pattern matrix, once moved: its `side` device pixels
 * mapped onto the CSS pixels the moved copy covers, at the display's
 * `scale` (`movedPlacement`). Still, the same matrix is `1 / scale` at the
 * origin, which the page keeps building exactly as it always did.
 */
export const movedTileTransform = (
  side: number,
  scale: number,
  pose: ITexturePose,
): number[] => {
  const moved = movedPlacement(
    { x: 0, y: 0, width: side / scale, height: side / scale, repeat: true },
    pose,
    pixelAt(scale),
  );
  return [moved.width / side, 0, 0, moved.height / side, moved.x, moved.y];
};
