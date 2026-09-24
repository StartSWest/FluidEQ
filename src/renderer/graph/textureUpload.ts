/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_TEXTURE_BYTES, TEXTURE_TILE } from '../../common/graphTextures';

/**
 * A picture somebody chose, turned into a tile a look can carry.
 *
 * Three things happen to it and each one has to: the centre square is taken,
 * because a tile repeats and a rectangle would repeat as a rectangle; it is
 * redrawn at `TEXTURE_TILE`, because nothing beyond that is visible once the
 * tile is a couple of centimetres across; and it is encoded down until it
 * fits `MAX_TEXTURE_BYTES`, because every look shares one browser store with
 * every other look and a photograph dropped in whole would fill it.
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

const QUALITIES = [0.82, 0.7, 0.55, 0.4, 0.28];

const decode = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new TextureError('unreadable'));
    };
    image.src = url;
  });

export const tileFromFile = async (file: File): Promise<string> => {
  const image = await decode(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  if (!side) {
    throw new TextureError('unreadable');
  }
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_TILE;
  canvas.height = TEXTURE_TILE;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new TextureError('unreadable');
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    TEXTURE_TILE,
    TEXTURE_TILE,
  );
  // WebP first at every quality, then PNG — a flat graphic can come out
  // smaller as PNG than as a lossy WebP, and a screenshot of a pattern is
  // exactly the kind of picture somebody drops here.
  const candidates = [
    ...QUALITIES.map((quality) => canvas.toDataURL('image/webp', quality)),
    canvas.toDataURL('image/png'),
  ];
  const fitting = candidates.find(
    (uri) => uri.startsWith('data:image/') && uri.length <= MAX_TEXTURE_BYTES,
  );
  if (!fitting) {
    throw new TextureError('tooBig');
  }
  return fitting;
};

export default tileFromFile;
