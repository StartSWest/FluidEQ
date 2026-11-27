/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type TFillTexture,
  type TTextureFit,
  TEXTURE_TILE,
} from '../../common/graphTextures';
import {
  type ITextureArea,
  type ITexturePlacement,
  announceTextureReady,
  placePicture,
} from './texturePictures';
import { TILE, drawTile, makeCanvas } from './fillTextureTiles';

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

interface ITileKey {
  texture: TFillTexture;
  scale: number;
}

const keyOf = ({ texture, scale }: ITileKey) => `${texture}|${scale}`;

/**
 * One tile of a named pattern at a display scale, drawn once and kept: the
 * canvas it is drawn on, the page's pattern made from it, and the copy the
 * engine is handed (`texturePlacement`), each made the first time asked.
 */
interface ITile {
  canvas: HTMLCanvasElement;
  pattern?: CanvasPattern | null;
  bitmap?: ImageBitmap | 'loading';
}

const tiles = new Map<string, ITile | null>();

/**
 * Where each pattern lies in the window's CSS pixels: what `printTexture`
 * maps into a figure's own space for one fill and puts back after it.
 */
const patternPlaces = new WeakMap<CanvasPattern, DOMMatrix>();

const placeOn = (pattern: CanvasPattern, place: DOMMatrix): void => {
  patternPlaces.set(pattern, place);
  pattern.setTransform(place);
};

const tileOf = (texture: TFillTexture, scale: number): ITile | null => {
  const key = keyOf({ texture, scale });
  const held = tiles.get(key);
  if (held !== undefined) {
    return held;
  }
  const side = Math.max(2, Math.round(TILE * scale));
  const canvas = makeCanvas(side);
  const tileContext = canvas.getContext('2d');
  let tile: ITile | null = null;
  if (tileContext) {
    drawTile(tileContext, texture, side);
    tile = { canvas };
  }
  tiles.set(key, tile);
  return tile;
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
  const tile = tileOf(texture, scale);
  if (!tile) {
    return undefined;
  }
  if (tile.pattern === undefined) {
    tile.pattern = context.createPattern(tile.canvas, 'repeat');
    if (tile.pattern) {
      placeOn(tile.pattern, new DOMMatrix([1 / scale, 0, 0, 1 / scale, 0, 0]));
    }
  }
  return tile.pattern ?? undefined;
};

/**
 * The page's pattern for each redrawn picture, made once from its bitmap.
 * Keyed by the bitmap itself, so a pattern goes when its picture does.
 */
const placedPatterns = new WeakMap<ImageBitmap, CanvasPattern | null>();

/**
 * A placed picture as a pattern, mapped from its device pixels onto the CSS
 * pixels it lies over: one to one when the redraw is the size asked for, and
 * stretched only while a stand-in covers a resize (`placePicture`).
 */
const placedPattern = (
  context: CanvasRenderingContext2D,
  placement: ITexturePlacement,
): CanvasPattern | undefined => {
  const { bitmap } = placement;
  let pattern = placedPatterns.get(bitmap);
  if (pattern === undefined) {
    pattern = context.createPattern(
      bitmap,
      placement.repeat ? 'repeat' : 'no-repeat',
    );
    placedPatterns.set(bitmap, pattern);
  }
  if (pattern) {
    placeOn(
      pattern,
      new DOMMatrix([
        placement.width / bitmap.width,
        0,
        0,
        placement.height / bitmap.height,
        placement.x,
        placement.y,
      ]),
    );
  }
  return pattern ?? undefined;
};

/**
 * Prints `pattern` inside `figure` by filling the figure itself, while the
 * texture still lies where `windowSpace` puts it.
 *
 * The figure is in whatever space the context is in now — a wave drawn
 * under its height slider's scale, a scene's own — and the texture belongs
 * in the window's, or its tiles stretch into rectangles. It used to get
 * there by clipping to the figure and filling the whole plot in the window's
 * space: a clip mask of the figure built every frame and every pixel of the
 * plot painted through it, a second pass as large as the plot for what is
 * often a few bars. Here the pattern's own matrix is moved into the figure's
 * space for the one fill and put back after it, so only the figure's pixels
 * are painted and no mask is built. A figure squashed flat has no inverse
 * and nothing to print in.
 */
export const printTexture = (
  context: CanvasRenderingContext2D,
  figure: Path2D,
  pattern: CanvasPattern,
  windowSpace: DOMMatrix,
): void => {
  const place = patternPlaces.get(pattern);
  const toFigure = context.getTransform().inverse();
  const invertible = [
    toFigure.a,
    toFigure.b,
    toFigure.c,
    toFigure.d,
    toFigure.e,
    toFigure.f,
  ].every(Number.isFinite);
  if (!place || !invertible) {
    return;
  }
  pattern.setTransform(toFigure.multiply(windowSpace).multiply(place));
  context.fillStyle = pattern;
  context.fill(figure);
  pattern.setTransform(place);
};

export interface ITexturePaint {
  texture: TFillTexture;
  /** The stored picture, when the texture is a dropped one. */
  image?: string;
  /** The display's device ratio, so a hairline stays a hairline. */
  scale: number;
  /** How a picture lies: once over `area`, or tiled `size` pixels tall. */
  fit: TTextureFit;
  size: number;
  /** The plot, in the CSS pixels the texture is printed in. */
  area: ITextureArea;
}

const tileScale = (scale: number) => Math.max(1, Math.min(4, scale));

/**
 * The pattern to lay over a filled figure, or nothing if there is none.
 *
 * The caller clips to the figure and fills the plot with this, or fills the
 * figure with it where the two share a space — never a pattern tied to the
 * figure's own box, or a bar moving by a pixel would drag its whole texture
 * with it. A canvas pattern lies in the space it is painted in, not in the
 * shape's.
 */
export const fillTexturePattern = (
  context: CanvasRenderingContext2D,
  paint: ITexturePaint,
): CanvasPattern | undefined => {
  const { texture, image, scale, fit, size, area } = paint;
  if (texture === 'none') {
    return undefined;
  }
  if (texture === 'image') {
    const placement = image
      ? placePicture({ image, fit, size, scale, area })
      : undefined;
    return placement ? placedPattern(context, placement) : undefined;
  }
  return tilePattern(context, texture, tileScale(scale));
};

/**
 * The texture as the engine prints it (`engineLooks/lookTexture.ts`): the
 * same device pixels the page's pattern is made of, and where they lie. A
 * pattern's tile is turned into a bitmap the first time it is asked for, and
 * nothing is returned until it is.
 */
export const texturePlacement = (
  paint: ITexturePaint,
): ITexturePlacement | undefined => {
  const { texture, image, scale, fit, size, area } = paint;
  if (texture === 'none') {
    return undefined;
  }
  if (texture === 'image') {
    return image ? placePicture({ image, fit, size, scale, area }) : undefined;
  }
  const ratio = tileScale(scale);
  const tile = tileOf(texture, ratio);
  if (!tile) {
    return undefined;
  }
  if (tile.bitmap === undefined) {
    tile.bitmap = 'loading';
    createImageBitmap(tile.canvas, { premultiplyAlpha: 'premultiply' })
      .then((bitmap) => {
        tile.bitmap = bitmap;
        announceTextureReady();
        return undefined;
      })
      .catch(() => {
        tile.bitmap = undefined;
      });
  }
  if (tile.bitmap === 'loading') {
    return undefined;
  }
  return {
    key: `tile|${keyOf({ texture, scale: ratio })}`,
    bitmap: tile.bitmap,
    x: 0,
    y: 0,
    width: tile.canvas.width / ratio,
    height: tile.canvas.height / ratio,
    repeat: true,
  };
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
  previews.clear();
};

export { TEXTURE_TILE };
