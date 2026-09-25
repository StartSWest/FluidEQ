/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A picture dropped on a look is decoded once and kept — but not every
 * picture ever dropped: each was held for the session, decoded and keyed by
 * its whole data URI.
 */

import {
  fillTexturePattern,
  resetFillTextures,
} from 'renderer/graph/fillTextures';

const RealImage = window.Image;
/** Every picture decoded, as `new Image()` in `fillTextures` makes one. */
const decoded = jest.fn(() => document.createElement('img'));
const decodedSources = () =>
  decoded.mock.results.map(({ value }) =>
    value instanceof HTMLImageElement ? value.getAttribute('src') : undefined,
  );

const context = {
  createPattern: () => null,
} as unknown as CanvasRenderingContext2D;

const picture = (index: number) =>
  `data:image/png;base64,${String(index).padStart(4, '0')}AAAA`;

const draw = (index: number) =>
  fillTexturePattern(context, {
    texture: 'image',
    image: picture(index),
    scale: 1,
  });

beforeEach(() => {
  resetFillTextures();
  decoded.mockClear();
  Object.defineProperty(window, 'Image', {
    configurable: true,
    value: decoded,
  });
});

afterEach(() => {
  Object.defineProperty(window, 'Image', {
    configurable: true,
    value: RealImage,
  });
});

it('decodes a picture again only once it has gone unused behind many others', () => {
  for (let index = 0; index <= 16; index += 1) {
    draw(index);
  }
  expect(decoded).toHaveBeenCalledTimes(17);
  // The control: pictures drawn a moment ago are still held.
  draw(16);
  draw(2);
  expect(decoded).toHaveBeenCalledTimes(17);
  // The first, drawn longest ago, was let go.
  draw(0);
  expect(decoded).toHaveBeenCalledTimes(18);
  expect(decodedSources()[17]).toBe(picture(0));
});
