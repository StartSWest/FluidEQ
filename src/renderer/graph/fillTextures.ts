/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type TFillTexture,
  TEXTURE_TILE,
  isTextureImage,
} from '../../common/graphTextures';

/**
 * The pattern that goes inside a filled figure.
 *
 * Two things decide how this is drawn, and both were learned on the ECG
 * paper. It is built in DEVICE pixels and mapped back down, so a hairline
 * stays a hairline on a 200% display instead of being resampled from a
 * 96 dpi tile; and it is painted on the glass — screen space, outside any
 * scene transform — so a cell stays square whatever the height slider is
 * doing to the figure. Ruled inside the figure's own space, every tile
 * became a rectangle below full height and the horizontal strokes came out
 * thicker than the vertical ones.
 */

/** The side of a tile in CSS pixels. Small enough to read as a material. */
const TILE = 16;

interface ITileKey {
  texture: TFillTexture;
  scale: number;
}

const keyOf = ({ texture, scale }: ITileKey) => `${texture}|${scale}`;

const tiles = new Map<string, CanvasPattern | undefined>();

/**
 * Pictures somebody dropped on the style editor, by their data URI.
 *
 * Decoding is asynchronous and a frame cannot wait for it, so the first draw
 * that asks for a picture starts the decode and paints flat; the frame after
 * the decode finishes finds it here. No timer is involved — the draw loop is
 * already running at display rate, and the image's own load event is the
 * signal.
 */
const pictures = new Map<string, HTMLImageElement | 'loading' | 'failed'>();

const makeCanvas = (side: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  return canvas;
};

/**
 * One tile of a named pattern, drawn white on nothing.
 *
 * White rather than the figure's colour because the tile is cached across
 * every look on screen and tinted at paint time through `globalAlpha` and the
 * composite operation — building one tile per colour would mean a new canvas
 * every time a gradient moved.
 */
const drawTile = (
  context: CanvasRenderingContext2D,
  texture: TFillTexture,
  side: number,
): void => {
  const unit = side / TILE;
  context.strokeStyle = '#ffffff';
  context.fillStyle = '#ffffff';
  context.lineCap = 'butt';

  const diagonals = (step: number, back: boolean) => {
    context.lineWidth = Math.max(1, unit);
    context.beginPath();
    for (let offset = -side; offset <= side * 2; offset += step * unit) {
      if (back) {
        context.moveTo(offset, 0);
        context.lineTo(offset - side, side);
      } else {
        context.moveTo(offset, 0);
        context.lineTo(offset + side, side);
      }
    }
    context.stroke();
  };

  switch (texture) {
    case 'hatch':
      diagonals(6, false);
      break;
    case 'crosshatch':
      diagonals(8, false);
      diagonals(8, true);
      break;
    case 'rules':
      context.lineWidth = Math.max(1, unit);
      context.beginPath();
      for (let y = unit * 0.5; y < side; y += unit * 4) {
        context.moveTo(0, y);
        context.lineTo(side, y);
      }
      context.stroke();
      break;
    case 'pinstripe':
      context.lineWidth = Math.max(1, unit);
      context.beginPath();
      for (let x = unit * 0.5; x < side; x += unit * 4) {
        context.moveTo(x, 0);
        context.lineTo(x, side);
      }
      context.stroke();
      break;
    case 'dots': {
      const radius = unit * 1.1;
      for (let y = unit * 2; y < side; y += unit * 8) {
        for (let x = unit * 2; x < side; x += unit * 8) {
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
      }
      // The half-offset row is what stops a dot field reading as a grid.
      for (let y = unit * 6; y < side; y += unit * 8) {
        for (let x = unit * 6; x < side; x += unit * 8) {
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
      }
      break;
    }
    case 'grid':
      context.lineWidth = Math.max(1, unit);
      context.beginPath();
      for (let step = unit * 0.5; step < side; step += unit * 4) {
        context.moveTo(0, step);
        context.lineTo(side, step);
        context.moveTo(step, 0);
        context.lineTo(step, side);
      }
      context.stroke();
      break;
    case 'weave': {
      /**
       * Basket weave: quadrants of parallel runs turned through a right
       * angle from their neighbours, which is what the eye reads as
       * over-and-under.
       *
       * Two crossed bars was the first attempt and it did not weave. Tiled
       * across a fill the bars lined up into a staircase, which drew as a
       * second copy of the chevron three buttons along.
       */
      const half = side / 2;
      context.lineWidth = Math.max(1, unit);
      const runs = (originX: number, originY: number, vertical: boolean) => {
        context.beginPath();
        for (let step = unit * 1.5; step < half; step += unit * 2.5) {
          if (vertical) {
            context.moveTo(originX + step, originY + unit * 0.5);
            context.lineTo(originX + step, originY + half - unit * 0.5);
          } else {
            context.moveTo(originX + unit * 0.5, originY + step);
            context.lineTo(originX + half - unit * 0.5, originY + step);
          }
        }
        context.stroke();
      };
      runs(0, 0, false);
      runs(half, 0, true);
      runs(0, half, true);
      runs(half, half, false);
      break;
    }
    case 'scales': {
      // Overlapping arcs, the row below offset by half a scale. Half the
      // tile across: at a quarter it tiled into a net rather than scales,
      // and was indistinguishable from the chevron beside it.
      context.lineWidth = Math.max(1, unit * 1.1);
      const radius = unit * 8;
      context.beginPath();
      for (let y = 0; y <= side; y += radius * 2) {
        for (let x = 0; x <= side + radius; x += radius * 2) {
          context.moveTo(x - radius, y);
          context.arc(x, y, radius, Math.PI, 0, true);
        }
        for (let x = radius; x <= side + radius; x += radius * 2) {
          context.moveTo(x - radius, y + radius);
          context.arc(x, y + radius, radius, Math.PI, 0, true);
        }
      }
      context.stroke();
      break;
    }
    case 'chevron': {
      context.lineWidth = Math.max(1, unit * 1.4);
      context.lineJoin = 'miter';
      const step = unit * 8;
      context.beginPath();
      for (let y = -step; y < side + step; y += step) {
        for (let x = 0; x <= side; x += step) {
          context.moveTo(x, y + step * 0.5);
          context.lineTo(x + step * 0.5, y);
          context.lineTo(x + step, y + step * 0.5);
        }
      }
      context.stroke();
      break;
    }
    case 'static': {
      /**
       * Film grain, not random noise.
       *
       * The pattern repeats across the whole fill, so a tile whose speckle
       * came from `Math.random` would show the eye the same clump over and
       * over — the seeded walk below spreads them evenly enough that the
       * repeat does not announce itself.
       */
      // Modulo rather than the usual `>>> 0`: the product stays under 2^53,
      // so the arithmetic is exact and the tile is the same on every run.
      let seed = 0x2f6e2b1;
      const next = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967295;
      };
      // A twentieth of the tile carries a speck. At a hundredth the grain
      // was invisible at every size it is actually seen at, which is not a
      // texture but an expensive way of drawing nothing.
      const count = Math.round(side * side * 0.05);
      for (let index = 0; index < count; index += 1) {
        const x = next() * side;
        const y = next() * side;
        context.globalAlpha = 0.45 + next() * 0.55;
        context.fillRect(x, y, unit, unit);
      }
      context.globalAlpha = 1;
      break;
    }
    default:
      break;
  }
};

/**
 * The pattern for a named texture at a display scale, built once and kept.
 *
 * `setTransform` is what maps the device-resolution tile back onto CSS
 * pixels: the context is already scaled by the display's ratio, so without it
 * a 2x tile would be painted at twice the size instead of twice the detail.
 */
const tilePattern = (
  context: CanvasRenderingContext2D,
  texture: TFillTexture,
  scale: number,
): CanvasPattern | undefined => {
  const key = keyOf({ texture, scale });
  const cached = tiles.get(key);
  if (cached !== undefined || tiles.has(key)) {
    return cached;
  }
  const side = Math.max(2, Math.round(TILE * scale));
  const canvas = makeCanvas(side);
  const tileContext = canvas.getContext('2d');
  let pattern: CanvasPattern | undefined;
  if (tileContext) {
    drawTile(tileContext, texture, side);
    pattern = context.createPattern(canvas, 'repeat') ?? undefined;
    pattern?.setTransform(new DOMMatrix([1 / scale, 0, 0, 1 / scale, 0, 0]));
  }
  tiles.set(key, pattern);
  return pattern;
};

/**
 * A dropped picture as a repeating pattern, once it has decoded.
 *
 * Returns nothing on the frames before that, and the figure is simply
 * painted flat until it is ready.
 */
const picturePattern = (
  context: CanvasRenderingContext2D,
  source: string,
): CanvasPattern | undefined => {
  const held = pictures.get(source);
  if (held === 'failed' || held === 'loading') {
    return undefined;
  }
  if (held === undefined) {
    if (!isTextureImage(source)) {
      pictures.set(source, 'failed');
      return undefined;
    }
    pictures.set(source, 'loading');
    const image = new Image();
    image.onload = () => pictures.set(source, image);
    image.onerror = () => pictures.set(source, 'failed');
    image.src = source;
    return undefined;
  }
  return context.createPattern(held, 'repeat') ?? undefined;
};

export interface ITexturePaint {
  texture: TFillTexture;
  /** The stored picture, when the texture is a dropped one. */
  image?: string;
  /** The display's device ratio, so a hairline stays a hairline. */
  scale: number;
}

/**
 * The pattern to lay over a filled figure, or nothing if there is none.
 *
 * The caller clips to the figure and fills the plot with this — never the
 * other way round. Filling the pattern into the figure's own path would tie
 * the tile's origin to the figure, and a bar moving by a pixel would drag its
 * whole texture with it.
 */
export const fillTexturePattern = (
  context: CanvasRenderingContext2D,
  { texture, image, scale }: ITexturePaint,
): CanvasPattern | undefined => {
  if (texture === 'none') {
    return undefined;
  }
  if (texture === 'image') {
    return image ? picturePattern(context, image) : undefined;
  }
  return tilePattern(context, texture, Math.max(1, Math.min(4, scale)));
};

/**
 * How strongly a pattern prints on the fill it sits in.
 *
 * Painted in `overlay` the tile both darkens and lightens what is under it,
 * so one tile reads on a pale fill and on a dark one without carrying a
 * colour of its own. A dropped picture goes on flat instead: somebody who
 * chose a picture chose its colours.
 */
export const TEXTURE_ALPHA = 0.32;
export const PICTURE_ALPHA = 0.5;

/**
 * One tile as a picture, for the style editor's own buttons.
 *
 * The editor shows each pattern behind its name rather than beside it: a row
 * of twelve words says nothing about what any of them looks like, and a swatch
 * wide enough to read would push the row onto three lines.
 */
const previews = new Map<TFillTexture, string>();

export const texturePreviewUrl = (texture: TFillTexture): string => {
  if (texture === 'none' || texture === 'image') {
    return '';
  }
  const held = previews.get(texture);
  if (held !== undefined) {
    return held;
  }
  const side = TILE * 2;
  const canvas = makeCanvas(side);
  const context = canvas.getContext('2d');
  let url = '';
  if (context) {
    drawTile(context, texture, side);
    url = canvas.toDataURL('image/png');
  }
  previews.set(texture, url);
  return url;
};

/** Clears the cached tiles. For tests, which build a fresh canvas each run. */
export const resetFillTextures = (): void => {
  tiles.clear();
  pictures.clear();
  previews.clear();
};

export { TEXTURE_TILE };
