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
 * How large a picture may be once it has been made into a tile.
 *
 * A custom look lives in the browser's own storage with every other look, and
 * that store is a few megabytes for everything the app keeps there. A tile is
 * repeated across the fill, so nothing is gained by holding more of it than a
 * couple of hundred pixels square: the editor redraws whatever is dropped on
 * it at `TEXTURE_TILE` and encodes it, and this is the ceiling that keeps one
 * look from filling the store.
 */
export const TEXTURE_TILE = 192;
export const MAX_TEXTURE_BYTES = 120 * 1024;

/** Whether a stored picture is one this app wrote: a data URI, nothing else. */
export const isTextureImage = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) &&
  value.length <= MAX_TEXTURE_BYTES;
