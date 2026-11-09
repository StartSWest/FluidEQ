/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { modelImageSize } from './worldModelImages';

/**
 * Whether a picture is one FluidEQ may decode at all, judged from the size
 * its own header says it decodes to, before anything decodes it.
 *
 * A decoder allocates what the header says, and a file's length bounds none
 * of it: a one-colour PNG of a few kilobytes can say 40000 by 40000, 6.4 GB
 * as a bitmap. A project is somebody's folder — a zip from a forum post, a
 * scene shared to look inside — and the Studio's AI looks at its pictures
 * in the main process (`look_at_animation`, `pack_artwork`), where one such
 * file took the whole app down with it. Every decode of a project's picture,
 * or of one that came through a chat, asks this first, in main
 * (`safePicture.ts`) and in the Studio's window (`decodePicture`).
 *
 * Only PNG, JPEG and WebP are pictures here: a decoder reads the bytes, not
 * the name, so a `wolf.png` holding a BMP or a GIF would still decode — an
 * RLE BMP is a bomb of its own — and a header this cannot read is refused.
 */

export interface IPictureBounds {
  side: number;
  pixels: number;
}

/**
 * Any picture: 256 MB as a bitmap, which holds a 48-megapixel phone photo
 * with room to spare, at the widest texture a graphics card is sure to take.
 */
export const PICTURE_BOUNDS: IPictureBounds = {
  side: 16384,
  pixels: 67_108_864,
};

/**
 * An animation's sheet, whose every pixel main measures
 * (`animationFrames.ts`): a 256-frame grid of 256 px cells is exactly this
 * many pixels, and a 32-frame strip of 256 px is this wide.
 */
export const SHEET_BOUNDS: IPictureBounds = {
  side: 8192,
  pixels: 16_777_216,
};

const PICTURE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Width and height as decoded, from the header, or null for no picture of these. */
export const pictureHeaderSize = (bytes: Uint8Array): [number, number] | null =>
  PICTURE_TYPES.map((type) => modelImageSize(bytes, type)).find(
    (size) => size !== null,
  ) ?? null;

/** Whether `bytes` are a PNG, JPEG or WebP that decodes within `bounds`. */
export const isDecodablePicture = (
  bytes: Uint8Array,
  bounds: IPictureBounds = PICTURE_BOUNDS,
): boolean => {
  const size = pictureHeaderSize(bytes);
  if (!size) {
    return false;
  }
  const [width, height] = size;
  return (
    width >= 1 &&
    height >= 1 &&
    width <= bounds.side &&
    height <= bounds.side &&
    width * height <= bounds.pixels
  );
};
