/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A chosen picture keeps its own shape, sharp enough to lie over a whole
 * plot, and still fits the look store: it used to be cut to its centre
 * square at 192 pixels, which a whole-picture fit blew up tenfold.
 */

import { MAX_TEXTURE_BYTES, TEXTURE_PICTURE_SIDE } from 'common/graphTextures';
import { TextureError, tileFromFile } from 'renderer/graph/textureUpload';

/** The canvases each encode was asked of, with their size and the quality. */
const encodes: { width: number; height: number; quality?: number }[] = [];
/** How long each encode comes out, by the canvas width it was asked at. */
let lengthAt: (width: number, quality?: number) => number = () => 1000;

beforeAll(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        drawImage: () => undefined,
        imageSmoothingQuality: 'low',
      }) as unknown as CanvasRenderingContext2D,
  );
  jest
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockImplementation(function encode(
      this: HTMLCanvasElement,
      type?: string,
      quality?: unknown,
    ) {
      const q = typeof quality === 'number' ? quality : undefined;
      encodes.push({ width: this.width, height: this.height, quality: q });
      return `data:${type ?? 'image/png'};base64,${'A'.repeat(
        lengthAt(this.width, q),
      )}`;
    });
});

const choose = (width: number, height: number) => {
  Object.assign(globalThis, {
    createImageBitmap: () =>
      Promise.resolve({ width, height, close: jest.fn() }),
  });
  return tileFromFile(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }));
};

beforeEach(() => {
  encodes.length = 0;
  lengthAt = () => 1000;
});

it('keeps a photograph at its own shape, at most 1280 across', async () => {
  await choose(4000, 3000);
  expect(encodes[0]).toMatchObject({
    width: TEXTURE_PICTURE_SIDE,
    height: 960,
  });
  // The first encode that fits is taken; nothing more is encoded.
  expect(encodes).toHaveLength(1);
});

it('never enlarges a small picture', async () => {
  await choose(300, 200);
  expect(encodes[0]).toMatchObject({ width: 300, height: 200 });
});

it('tries lower qualities and then smaller sides before giving up', async () => {
  // Only a picture 720 across at the second quality fits.
  lengthAt = (width, quality) =>
    width <= 720 && quality === 0.7 ? 1000 : MAX_TEXTURE_BYTES;
  const uri = await choose(4000, 2000);
  expect(uri.length).toBeLessThanOrEqual(MAX_TEXTURE_BYTES);
  const last = encodes[encodes.length - 1];
  expect(last).toMatchObject({ width: 720, height: 360, quality: 0.7 });
  // Every quality and the PNG at 1280 and 960 came first.
  expect(encodes.filter((e) => e.width === 1280)).toHaveLength(5);
  expect(encodes.filter((e) => e.width === 960)).toHaveLength(5);
});

it('says when nothing fits', async () => {
  lengthAt = () => MAX_TEXTURE_BYTES + 1;
  await expect(choose(4000, 3000)).rejects.toEqual(
    expect.objectContaining({ reason: 'tooBig' }),
  );
  expect(new TextureError('tooBig').reason).toBe('tooBig');
});
