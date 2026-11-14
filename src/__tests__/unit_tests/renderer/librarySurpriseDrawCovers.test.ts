/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { libraryMediaUrl } from 'common/library/mediaUrl';
import { loadDrawCover } from 'renderer/library/surpriseDraw/drawCovers';

/**
 * The draw's covers are asked for with CORS. The media scheme is another
 * origin than the window, and a picture loaded without it is tainted: WebGL
 * refused every one ("The ImageBitmap contains cross-origin data") and the
 * draw spun nothing but the dimmed shelf, seen in the Library harness.
 */

/** Each picture asked for, and its CORS mode at the moment it was asked. */
const asked: { src: string; crossOrigin: string | null }[] = [];
const srcDescriptor = Object.getOwnPropertyDescriptor(
  HTMLImageElement.prototype,
  'src',
);

beforeAll(() => {
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    set(this: HTMLImageElement, value: string) {
      asked.push({ src: value, crossOrigin: this.crossOrigin });
    },
    get: () => '',
  });
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: () => Promise.resolve(),
  });
  Object.defineProperty(window, 'createImageBitmap', {
    configurable: true,
    value: jest.fn(() => Promise.resolve({ close: () => undefined })),
  });
  // jsdom paints nothing; the generated tile only needs an answer.
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(() => null);
});

afterAll(() => {
  if (srcDescriptor) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', srcDescriptor);
  }
});

beforeEach(() => {
  asked.length = 0;
});

describe('the pictures the draw spins', () => {
  it('asks for a cover with CORS, before it is asked for at all', async () => {
    await loadDrawCover('feed01', 'Otra Vez');
    expect(asked).toEqual([
      { src: libraryMediaUrl('art', 'feed01'), crossOrigin: 'anonymous' },
    ]);
  });

  it('asks for nothing for a song with no cover, and paints its tile', async () => {
    const tile = await loadDrawCover(undefined, 'Otra Vez');
    expect(asked).toEqual([]);
    expect(tile).toBeInstanceOf(HTMLCanvasElement);
  });
});
