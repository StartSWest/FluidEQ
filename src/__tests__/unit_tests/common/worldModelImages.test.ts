/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { WORLD_LIMITS } from '../../../common/sceneWorld';
import { readModelCost } from '../../../common/worldModelCheck';
import {
  glb,
  jpegHeader,
  meshModel,
  pngHeader,
  webpExtendedHeader,
  webpLosslessHeader,
  type IEmbeddedImage,
} from '../../utils/glbFixture';

/**
 * A model's images are held to the size their own headers say they decode
 * to: a decoder allocates what the header says, and a megabyte of PNG of one
 * colour is a gigabyte decoded. Each format is read where its decoder reads
 * it, and each size is checked against the number of pixels it should come
 * to, so a header read from the wrong bytes cannot pass for a small image.
 */

const pixelsOf = (...images: IEmbeddedImage[]) =>
  readModelCost(glb(meshModel({ images })))?.pixels ?? null;

const png = (width: number, height: number): IEmbeddedImage => ({
  bytes: pngHeader(width, height),
  mimeType: 'image/png',
});

describe('the images a model embeds', () => {
  it('counts a 64 by 32 PNG as 2048 pixels', () => {
    expect(pixelsOf(png(64, 32))).toBe(2048);
  });

  it('refuses a PNG whose header says it is wider or taller than a side may be', () => {
    const side = WORLD_LIMITS.modelImageSide;
    expect(pixelsOf(png(side, 1))).toBe(side);
    expect(pixelsOf(png(side + 1, 1))).toBeNull();
    expect(pixelsOf(png(1, side + 1))).toBeNull();
  });

  it('refuses a PNG that says it is empty', () => {
    expect(pixelsOf(png(0, 32))).toBeNull();
  });

  it('reads a JPEG’s size from its first frame header, past the segment before it', () => {
    expect(
      pixelsOf({ bytes: jpegHeader(300, 200), mimeType: 'image/jpeg' }),
    ).toBe(60000);
  });

  it('refuses a JPEG whose scan starts before any frame header, never reading one after it', () => {
    // Start of image, an empty start-of-scan, then the frame header (from
    // byte 20 of the ordinary one): past a scan, bytes are image data.
    const scanFirst = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xda,
      0x00,
      0x02,
      ...jpegHeader(300, 200).subarray(20),
    ]);
    expect(pixelsOf({ bytes: scanFirst, mimeType: 'image/jpeg' })).toBeNull();
  });

  it('reads an extended WebP’s canvas from all 24 bits of each side', () => {
    expect(
      pixelsOf({ bytes: webpExtendedHeader(640, 480), mimeType: 'image/webp' }),
    ).toBe(307200);
    // 65,636 wide: read from its low 16 bits alone, 100.
    expect(
      pixelsOf({
        bytes: webpExtendedHeader(65636, 1),
        mimeType: 'image/webp',
      }),
    ).toBeNull();
  });

  it('reads a lossless WebP’s two 14-bit sides', () => {
    expect(
      pixelsOf({ bytes: webpLosslessHeader(100, 50), mimeType: 'image/webp' }),
    ).toBe(5000);
  });

  it('adds up every image a model carries', () => {
    expect(
      pixelsOf(png(64, 32), {
        bytes: webpLosslessHeader(100, 50),
        mimeType: 'image/webp',
      }),
    ).toBe(7048);
  });

  it.each([
    ['a PNG called a JPEG', pngHeader(64, 32), 'image/jpeg'],
    ['a JPEG called a PNG', jpegHeader(300, 200), 'image/png'],
    ['a PNG called a WebP', pngHeader(64, 32), 'image/webp'],
    ['a PNG called a GIF', pngHeader(64, 32), 'image/gif'],
  ])(
    'refuses %s: bytes that are not what their type says',
    (_what, bytes, mimeType) => {
      expect(pixelsOf({ bytes, mimeType })).toBeNull();
    },
  );

  it('refuses images that decode past the pixels a model may hold, together', () => {
    const side = WORLD_LIMITS.modelImageSide;
    const rows = WORLD_LIMITS.modelImagePixels / side;
    expect(Number.isInteger(rows) && rows <= side).toBe(true);
    expect(pixelsOf(png(side, rows))).toBe(WORLD_LIMITS.modelImagePixels);
    expect(pixelsOf(png(side, rows), png(1, 1))).toBeNull();
  });

  it('refuses an image that is not in the file', () => {
    const model = meshModel({ images: [png(64, 32)] });
    expect(readModelCost(glb(model))?.pixels).toBe(2048);
    expect(
      readModelCost(
        glb({
          ...model,
          json: { ...model.json, images: [{ mimeType: 'image/png' }] },
        }),
      ),
    ).toBeNull();
  });
});
