/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's window decodes a project's picture only once its header says
 * it fits (`decodePicture`, `pictureBounds.ts`): a bomb never reaches the
 * browser's decoder, so it cannot take the window's memory with it.
 */

import { decodePicture } from '../../../renderer/studio/scenePicture';
import { pngHeader } from '../../utils/pictureHeaders';

const bitmap = { width: 64, height: 64, close: () => undefined };
const createImageBitmap = jest.fn(async () => bitmap);

beforeAll(() => {
  Object.defineProperty(window, 'createImageBitmap', {
    configurable: true,
    value: createImageBitmap,
  });
});

beforeEach(() => createImageBitmap.mockClear());

describe("the Studio window's picture decode", () => {
  it('never hands a bomb to the browser', async () => {
    expect(await decodePicture(pngHeader(40000, 40000))).toBeUndefined();
    expect(await decodePicture(new Uint8Array([1, 2, 3]))).toBeUndefined();
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it('control: decodes an ordinary picture', async () => {
    expect(await decodePicture(pngHeader(64, 64))).toBe(bitmap);
    expect(createImageBitmap).toHaveBeenCalledTimes(1);
  });
});
