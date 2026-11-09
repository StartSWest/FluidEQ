/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A picture is judged by the size its header says it decodes to, before
 * anything decodes it (`pictureBounds.ts`): a few-KB PNG saying 40000 by
 * 40000 is 6.4 GB as a bitmap, and decoding it in main took the app down.
 */

import {
  isDecodablePicture,
  pictureHeaderSize,
  PICTURE_BOUNDS,
  SHEET_BOUNDS,
} from 'common/pictureBounds';
import {
  bmpHeader,
  jpegHeader,
  pngHeader,
  webpHeader,
} from '../../utils/pictureHeaders';

describe('a picture header', () => {
  it('reads the decoded size of a PNG, a JPEG and a WebP', () => {
    expect(pictureHeaderSize(pngHeader(640, 480))).toEqual([640, 480]);
    expect(pictureHeaderSize(jpegHeader(1920, 1080))).toEqual([1920, 1080]);
    expect(pictureHeaderSize(webpHeader(300, 200))).toEqual([300, 200]);
  });

  it('refuses a bomb: a few dozen bytes saying 40000 by 40000', () => {
    const bomb = pngHeader(40000, 40000);
    expect(bomb.byteLength).toBeLessThan(64);
    expect(isDecodablePicture(bomb)).toBe(false);
    expect(isDecodablePicture(jpegHeader(40000, 40000))).toBe(false);
    expect(isDecodablePicture(webpHeader(16383, 16383))).toBe(false);
    // The control: an ordinary picture of each kind passes.
    expect(isDecodablePicture(pngHeader(4, 4))).toBe(true);
    expect(isDecodablePicture(jpegHeader(6000, 4000))).toBe(true);
    expect(isDecodablePicture(webpHeader(2048, 2048))).toBe(true);
  });

  it('holds a sheet to its own tighter bounds, and a photo to the wider', () => {
    // A 48-megapixel phone photo is a picture, and no sheet.
    expect(isDecodablePicture(jpegHeader(8000, 6000))).toBe(true);
    expect(isDecodablePicture(jpegHeader(8000, 6000), SHEET_BOUNDS)).toBe(
      false,
    );
    // A full 256-frame sheet of 256 px cells fits exactly; one row more does not.
    expect(isDecodablePicture(pngHeader(4096, 4096), SHEET_BOUNDS)).toBe(true);
    expect(isDecodablePicture(pngHeader(4096, 4097), SHEET_BOUNDS)).toBe(false);
    expect(isDecodablePicture(pngHeader(8193, 1), SHEET_BOUNDS)).toBe(false);
    expect(isDecodablePicture(pngHeader(PICTURE_BOUNDS.side + 1, 1))).toBe(
      false,
    );
  });

  it('refuses what it cannot read: another format, a cut header, nothing', () => {
    expect(isDecodablePicture(bmpHeader(64, 64))).toBe(false);
    expect(isDecodablePicture(pngHeader(64, 64).slice(0, 20))).toBe(false);
    expect(isDecodablePicture(new Uint8Array([1, 2, 3]))).toBe(false);
    expect(isDecodablePicture(new Uint8Array())).toBe(false);
    expect(isDecodablePicture(pngHeader(0, 64))).toBe(false);
  });
});
