/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  MAX_TEXTURE_BYTES,
  TEXTURE_PICTURE_SIDE,
} from '../../common/graphTextures';

/**
 * A picture somebody chose, turned into one a look can carry.
 *
 * It keeps its own shape. It used to be cut to its centre square and kept at
 * 192 pixels, because it was only ever repeated as a small tile; laid over the
 * whole plot (`textureFit: 'cover'`) a square that small was blown up tenfold
 * across a window two thousand pixels wide and cut to a strip of itself. Now
 * it is redrawn at most `TEXTURE_PICTURE_SIDE` across and encoded down until
 * it fits `MAX_TEXTURE_BYTES` — smaller sides are tried before giving up,
 * because every look shares one browser store with every other look and a
 * photograph dropped in whole would fill it.
 */
export type TTextureFailure = 'unreadable' | 'tooBig';

export class TextureError extends Error {
  readonly reason: TTextureFailure;

  constructor(reason: TTextureFailure) {
    super(reason);
    this.name = 'TextureError';
    this.reason = reason;
  }
}

const QUALITIES = [0.82, 0.7, 0.55, 0.4];

/**
 * The longest sides tried, largest first: a detailed photograph that will not
 * fit at 1280 still keeps more of itself at 960 than at a lower quality.
 */
const SIDES = [TEXTURE_PICTURE_SIDE, 960, 720, 512, 384];

const decode = (file: File): Promise<ImageBitmap> =>
  createImageBitmap(file).catch(() => {
    throw new TextureError('unreadable');
  });

/** The picture redrawn so its longest side is at most `side`. */
const redraw = (picture: ImageBitmap, side: number): HTMLCanvasElement => {
  const scale = Math.min(1, side / Math.max(picture.width, picture.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(picture.width * scale));
  canvas.height = Math.max(1, Math.round(picture.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    throw new TextureError('unreadable');
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(picture, 0, 0, canvas.width, canvas.height);
  return canvas;
};

export const tileFromFile = async (file: File): Promise<string> => {
  const picture = await decode(file);
  try {
    if (!picture.width || !picture.height) {
      throw new TextureError('unreadable');
    }
    const longest = Math.max(picture.width, picture.height);
    // A picture smaller than a side is not redrawn at it twice over.
    const sides = SIDES.filter((side, index) => index === 0 || side < longest);
    // At each side, WebP at every quality and then PNG — a flat graphic can
    // come out smaller as PNG than as a lossy WebP, and a screenshot of a
    // pattern is exactly the kind of picture somebody drops here. Encoded
    // one at a time and the first that fits taken: at 1280 pixels an encode
    // is tens of milliseconds, and the first usually fits. Each side is
    // redrawn once, when its first encode is asked for.
    const encodings = sides.flatMap((side) => {
      let canvas: HTMLCanvasElement | undefined;
      const drawn = () => {
        canvas ??= redraw(picture, side);
        return canvas;
      };
      return [
        ...QUALITIES.map(
          (quality) => () => drawn().toDataURL('image/webp', quality),
        ),
        () => drawn().toDataURL('image/png'),
      ];
    });
    let fitting: string | undefined;
    encodings.some((encode) => {
      const uri = encode();
      if (uri.startsWith('data:image/') && uri.length <= MAX_TEXTURE_BYTES) {
        fitting = uri;
      }
      return fitting !== undefined;
    });
    if (fitting === undefined) {
      throw new TextureError('tooBig');
    }
    return fitting;
  } finally {
    picture.close();
  }
};

export default tileFromFile;
