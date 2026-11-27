/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * What a filled form is filled WITH, beyond its colour.
 *
 * A flat fill says only "this is loud". The analysis views carry a lot of
 * filled area, and a pattern inside it does two things a flat wash cannot:
 * it separates a fill from the fill behind it — the before and after of an
 * EQ, the gap between a peak and an average — without spending another
 * colour, and it gives the drawing a material rather than an alpha.
 *
 * Named by what they look like rather than by how they are drawn, because
 * the name is what somebody reads in the style editor.
 */
export type TFillTexture =
  | 'none'
  | 'hatch'
  | 'crosshatch'
  | 'rules'
  | 'pinstripe'
  | 'dots'
  | 'grid'
  | 'weave'
  | 'scales'
  | 'chevron'
  | 'static'
  | 'image';

/** In the order the style editor offers them: plain first, the picture last. */
export const FILL_TEXTURES: TFillTexture[] = [
  'none',
  'hatch',
  'crosshatch',
  'rules',
  'pinstripe',
  'dots',
  'grid',
  'weave',
  'scales',
  'chevron',
  'static',
  'image',
];

export const isFillTexture = (value: unknown): value is TFillTexture =>
  typeof value === 'string' && FILL_TEXTURES.includes(value as TFillTexture);

/**
 * How a picture lies in the figure (Ivan, 2026-11-26: "allow different
 * picture repeat sizes so the user can choose the whole picture or tiled").
 *
 * `tile` repeats it across the plot at `textureSize` pixels tall, which is
 * how every look drew a picture before the choice existed; `cover` lays it
 * over the whole plot once, keeping its shape and cutting what overhangs, as
 * a wallpaper set to fill does.
 */
export type TTextureFit = 'tile' | 'cover';

export const TEXTURE_FITS: readonly TTextureFit[] = ['cover', 'tile'];

export const isTextureFit = (value: unknown): value is TTextureFit =>
  typeof value === 'string' && TEXTURE_FITS.includes(value as TTextureFit);

/**
 * The height a tiled picture repeats at, in CSS pixels.
 *
 * Pixels rather than a share of the plot, because the patterns beside it are
 * a fixed 16 pixels at every size too, and because the 192 every picture was
 * drawn at before this choice is then the default exactly — a look saved
 * before it opens tiled at the size it always had. 32 is about the smallest
 * a photograph still reads at; 640 is past the docked graph's whole height.
 */
export const MIN_TEXTURE_SIZE = 32;
export const MAX_TEXTURE_SIZE = 640;

/**
 * The tile every picture was stored and drawn at before the fit choice: a
 * square of this side, and still the default tile height.
 */
export const TEXTURE_TILE = 192;

/**
 * How large a stored picture may be.
 *
 * A custom look lives in the browser's own storage with every other look, and
 * that store is a few megabytes for everything the app keeps there; this is
 * the ceiling that keeps one look from filling it. It is also what every
 * version before the fit choice accepts (`isTextureImage`), so a picture
 * stored under it opens in an older FluidEQ too — tiled, at its own size.
 */
export const MAX_TEXTURE_BYTES = 120 * 1024;

/**
 * The longest side a picture is kept at. Laid over the whole plot it is
 * stretched across a window two thousand pixels wide, and at 1280 it stays
 * sharp there at the strength a picture is printed (`PICTURE_ALPHA`); the
 * byte ceiling above brings it down further when it has to.
 */
export const TEXTURE_PICTURE_SIDE = 1280;

/** Whether a stored picture is one this app wrote: a data URI, nothing else. */
export const isTextureImage = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) &&
  value.length <= MAX_TEXTURE_BYTES;
