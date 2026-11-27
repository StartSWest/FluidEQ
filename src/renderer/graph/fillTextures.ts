/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILookTuning } from '../../common/customLooks';
import {
  type TFillTexture,
  type TTextureFit,
  TEXTURE_TILE,
} from '../../common/graphTextures';
import { recallRecent, rememberRecent } from '../utils/recentMap';
import {
  type ITextureArea,
  type ITexturePlacement,
  announceTextureReady,
  placePicture,
} from './texturePictures';
import { isLightWindow } from '../utils/windowSide';
import { TILE, type TTileInk, drawTile, makeCanvas } from './fillTextureTiles';
import type { ITexturePose } from './textureMotion';
import {
  coverAreaOf,
  movedPlacement,
  movedTileTransform,
  pixelAt,
} from './movedTexture';

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
  /** The tile's side in CSS pixels (`patternSize`). */
  size: number;
  ink: TTileInk;
}

/**
 * The pattern at a display ratio and in an ink, whatever its size: what a
 * size stands in for.
 */
const familyOf = ({ texture, scale, ink }: ITileKey) =>
  `${texture}|${scale}|${ink}`;

const keyOf = (key: ITileKey) => `${familyOf(key)}|${key.size}`;

/**
 * One tile of a named pattern at a display scale and a size, drawn once and
 * kept: the canvas it is drawn on, the page's pattern made from it, and the
 * copy the engine is handed (`texturePlacement`), each made the first time
 * asked.
 */
interface ITile {
  canvas: HTMLCanvasElement;
  pattern?: CanvasPattern | null;
  bitmap?: ImageBitmap | 'loading';
}

/**
 * The tiles drawn, the most recently printed kept. Every size the slider
 * passes through on a drag is a tile of its own, so an unbounded map was a
 * slow leak of one canvas and one bitmap per step; 48 is several times what
 * one window prints at once — the graph, the editor's preview and a gallery
 * of looks, each pattern at its own size — and at the largest size on a 2x
 * display all of them are 25 MB.
 */
const tiles = new Map<string, ITile | null>();
const KEPT_TILES = 48;

/**
 * The newest tile of each pattern whose bitmap the engine can print, by
 * `familyOf`: what stands in, stretched to the new size, while the size
 * slider's next tile is made, so the engine's figure does not flash plain at
 * every step of a drag — what a picture's last redraw does for its own size.
 */
const lastReadyTiles = new Map<string, { key: string; bitmap: ImageBitmap }>();

/**
 * Where each pattern lies in the window's CSS pixels: what `printTexture`
 * maps into a figure's own space for one fill and puts back after it.
 */
const patternPlaces = new WeakMap<CanvasPattern, DOMMatrix>();

const placeOn = (pattern: CanvasPattern, place: DOMMatrix): void => {
  patternPlaces.set(pattern, place);
  pattern.setTransform(place);
};

/**
 * A pattern's tile, drawn at the device pixels it covers: its size times the
 * display's ratio. Grown by the size slider it is drawn again at that size,
 * never a small tile magnified, so a grown stroke is as sharp as a first one.
 */
const tileOf = (key: ITileKey): ITile | null => {
  const name = keyOf(key);
  const held = recallRecent(tiles, name);
  if (held !== undefined) {
    return held;
  }
  const side = Math.max(2, Math.round(key.size * key.scale));
  const canvas = makeCanvas(side);
  const tileContext = canvas.getContext('2d');
  let tile: ITile | null = null;
  if (tileContext) {
    drawTile(tileContext, key.texture, side, key.size / TILE, key.ink);
    tile = { canvas };
  }
  rememberRecent(tiles, name, tile, KEPT_TILES);
  return tile;
};

/**
 * The pattern for a named texture at a display scale and a size, built once
 * and kept.
 *
 * `setTransform` is what maps the device-resolution tile back onto CSS
 * pixels: the context is already scaled by the display's ratio, so without it
 * a 2x tile would be painted at twice the size instead of twice the detail.
 */
const tilePattern = (
  context: CanvasRenderingContext2D,
  key: ITileKey,
  pose?: ITexturePose,
): CanvasPattern | undefined => {
  const { scale } = key;
  const tile = tileOf(key);
  if (!tile) {
    return undefined;
  }
  if (tile.pattern === undefined) {
    tile.pattern = context.createPattern(tile.canvas, 'repeat');
  }
  const { pattern } = tile;
  if (!pattern) {
    return undefined;
  }
  // Laid for every print, still or moved: one pattern serves every drawing
  // of this tile in the window, and the graph's may be moving while the
  // editor's preview of the same tile is not.
  placeOn(
    pattern,
    new DOMMatrix(
      pose
        ? movedTileTransform(tile.canvas.width, scale, pose)
        : [1 / scale, 0, 0, 1 / scale, 0, 0],
    ),
  );
  return pattern;
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
  motion?: { pose: ITexturePose; pixel: number },
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
    const place = motion
      ? movedPlacement(placement, motion.pose, motion.pixel)
      : placement;
    placeOn(
      pattern,
      new DOMMatrix([
        place.width / bitmap.width,
        0,
        0,
        place.height / bitmap.height,
        place.x,
        place.y,
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
  /** How a picture lies: once over `area`, or tiled. A pattern always tiles. */
  fit: TTextureFit;
  /** The tile in CSS pixels: a tiled picture's height, a pattern's side. */
  size: number;
  /** The plot, in the CSS pixels the texture is printed in. */
  area: ITextureArea;
  /** The colour a pattern is printed in (`patternInk`). */
  ink: TTileInk;
  /**
   * Where the music has moved it this frame (`textureMotion.ts`); absent
   * while the look's texture lies still, which prints exactly as it did
   * before the texture could move.
   */
  pose?: ITexturePose;
}

/**
 * The colour a pattern prints in on this window: white on a dark one, black
 * on a light one.
 *
 * In `overlay` a white tile can only lighten (over a channel above half it
 * leaves full white) and a black one only darken, each by the same share of
 * the way to its own end. White was the only ink there was, so on the white
 * window the pattern lightened a fill already near white and vanished; black
 * there is the exact mirror of what white does on a dark window, and reads
 * as strongly.
 */
export const patternInkOn = (lightWindow: boolean): TTileInk =>
  lightWindow ? 'black' : 'white';

export const patternInk = (): TTileInk => patternInkOn(isLightWindow());

/**
 * A look's texture as the page and the engine both print it: the one place
 * that says which of the look's two sizes this texture is drawn at, so no
 * painter can take the picture's 192 for a pattern.
 */
export const lookTexturePaint = (
  tuning: Pick<
    ILookTuning,
    'texture' | 'textureImage' | 'textureFit' | 'textureSize' | 'patternSize'
  >,
  scale: number,
  area: ITextureArea,
  pose?: ITexturePose,
): ITexturePaint => ({
  texture: tuning.texture,
  image: tuning.textureImage,
  scale,
  fit: tuning.textureFit,
  size: tuning.texture === 'image' ? tuning.textureSize : tuning.patternSize,
  area,
  ink: patternInk(),
  ...(pose ? { pose } : {}),
});

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
  const { texture, image, scale, fit, size, area, ink, pose } = paint;
  if (texture === 'none') {
    return undefined;
  }
  if (texture === 'image') {
    const placement = image
      ? placePicture({ image, fit, size, scale, area: coverAreaOf(area, pose) })
      : undefined;
    return placement
      ? placedPattern(
          context,
          placement,
          pose ? { pose, pixel: pixelAt(scale) } : undefined,
        )
      : undefined;
  }
  return tilePattern(
    context,
    { texture, scale: tileScale(scale), size, ink },
    pose,
  );
};

/** Where the engine's copy of the texture lies while it lies still. */
const stillPlacement = (
  paint: ITexturePaint,
): ITexturePlacement | undefined => {
  const { texture, image, scale, fit, size, area, pose } = paint;
  if (texture === 'none') {
    return undefined;
  }
  if (texture === 'image') {
    return image
      ? placePicture({ image, fit, size, scale, area: coverAreaOf(area, pose) })
      : undefined;
  }
  const key: ITileKey = {
    texture,
    scale: tileScale(scale),
    size,
    ink: 'white',
  };
  const tile = tileOf(key);
  if (!tile) {
    return undefined;
  }
  const name = `tile|${keyOf(key)}`;
  const family = familyOf(key);
  if (tile.bitmap === undefined) {
    tile.bitmap = 'loading';
    createImageBitmap(tile.canvas, { premultiplyAlpha: 'premultiply' })
      .then((bitmap) => {
        tile.bitmap = bitmap;
        lastReadyTiles.set(family, { key: name, bitmap });
        announceTextureReady();
        return undefined;
      })
      .catch(() => {
        tile.bitmap = undefined;
      });
  }
  const shown =
    tile.bitmap === 'loading'
      ? lastReadyTiles.get(family)
      : { key: name, bitmap: tile.bitmap };
  if (!shown) {
    return undefined;
  }
  // Where the page's pattern lies too (`tilePattern`): the tile's device
  // pixels one to one, so the two print the same stroke at the same place.
  return {
    key: shown.key,
    bitmap: shown.bitmap,
    x: 0,
    y: 0,
    width: tile.canvas.width / key.scale,
    height: tile.canvas.height / key.scale,
    repeat: true,
  };
};

/**
 * The texture as the engine prints it (`engineLooks/lookTexture.ts`): the
 * same device pixels the page's pattern is made of, and where they lie —
 * moved by the music, where it moves, by the page's own rule
 * (`movedPlacement`). A pattern's tile is turned into a bitmap the first
 * time it is asked for; until it is, the same pattern's last bitmap at
 * another size stands in, stretched to this one, and nothing is returned
 * only when there is none.
 *
 * Always the white tile: the engine reads only a tile's coverage and is told
 * the ink beside it (`IEngineLookTexture.ink`), so switching the window's side
 * sends it no new bitmap.
 */
export const texturePlacement = (
  paint: ITexturePaint,
): ITexturePlacement | undefined => {
  const still = stillPlacement(paint);
  return still && paint.pose
    ? { ...still, ...movedPlacement(still, paint.pose, pixelAt(paint.scale)) }
    : still;
};

/**
 * How strongly a pattern prints on the fill it sits in.
 *
 * Painted in `overlay`, in white on a dark window and black on a light one
 * (`patternInk`), so the tile reads on whatever fill the look has without
 * carrying a colour of its own. A dropped picture goes on flat instead:
 * somebody who chose a picture chose its colours.
 */
export const TEXTURE_ALPHA = 0.32;
export const PICTURE_ALPHA = 0.5;

/**
 * How strongly this texture prints before the fill's own opacity, on the
 * page and the engine alike: its kind's strength, glinting with the music
 * where it moves (`ITexturePose.strength`).
 */
export const textureAlphaOf = (
  paint: Pick<ITexturePaint, 'texture' | 'pose'>,
): number => {
  const alpha = paint.texture === 'image' ? PICTURE_ALPHA : TEXTURE_ALPHA;
  return paint.pose ? alpha * paint.pose.strength : alpha;
};

/**
 * One tile as a picture, for the style editor's own buttons.
 *
 * The editor shows each pattern behind its name rather than beside it: a row
 * of twelve words says nothing about what any of them looks like, and a swatch
 * wide enough to read would push the row onto three lines.
 */
const previews = new Map<string, string>();

/**
 * In `ink`, the window's (`patternInk`): a white swatch on a pale button was
 * as invisible as a white pattern on a pale fill.
 */
export const texturePreviewUrl = (
  texture: TFillTexture,
  ink: TTileInk,
): string => {
  if (texture === 'none' || texture === 'image') {
    return '';
  }
  const name = `${texture}|${ink}`;
  const held = previews.get(name);
  if (held !== undefined) {
    return held;
  }
  const side = TILE * 2;
  const canvas = makeCanvas(side);
  const context = canvas.getContext('2d');
  let url = '';
  if (context) {
    drawTile(context, texture, side, 1, ink);
    url = canvas.toDataURL('image/png');
  }
  previews.set(name, url);
  return url;
};

/** Clears the cached tiles. For tests, which build a fresh canvas each run. */
export const resetFillTextures = (): void => {
  tiles.clear();
  lastReadyTiles.clear();
  previews.clear();
};

export { TEXTURE_TILE };
