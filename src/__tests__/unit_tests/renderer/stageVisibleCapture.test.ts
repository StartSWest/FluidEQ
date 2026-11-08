/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "Attach the stage" takes exactly what the stage shows (Ivan, 2026-11-08:
 * "zoom and pan the scene so I can take pictures of visible area"): the part
 * of the scene's canvas on screen, at the canvas's own pixels.
 */

import captureVisibleStage from '../../../renderer/studio/stageVisibleCapture';

const drawn: unknown[][] = [];

beforeEach(() => {
  drawn.length = 0;
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        drawImage: (...args: unknown[]) => drawn.push(args),
      }) as unknown as CanvasRenderingContext2D,
  );
  jest
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation(function toBlob(
      this: HTMLCanvasElement,
      done: BlobCallback,
    ) {
      done({
        arrayBuffer: async () => new Uint8Array([this.width % 256]).buffer,
      } as unknown as Blob);
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** The stage's host with the scene's canvas in it, at `width` by `height`. */
const host = (width: number, height: number) => {
  const element = document.createElement('div');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  element.appendChild(canvas);
  return element;
};

it('cuts the part on screen out of a zoomed scene, at the canvas’s own pixels', async () => {
  // An 800 by 450 screen zoomed twice, moved to its middle; the scene drawn
  // at two canvas pixels to each of its 1600 by 900 CSS pixels.
  const source = host(3200, 1800);
  const image = await captureVisibleStage(
    source,
    { scale: 2, x: -400, y: -225 },
    800,
    450,
  );
  expect(image).toBeInstanceOf(Uint8Array);
  const [[from, sx, sy, sw, sh, , , ow, oh]] = drawn;
  expect(from).toBe(source.querySelector('canvas'));
  expect([sx, sy, sw, sh]).toEqual([800, 450, 1600, 900]);
  expect([ow, oh]).toEqual([1600, 900]);
});

it('takes the whole picture unzoomed, no wider than the cap, and nothing before a frame', async () => {
  await captureVisibleStage(
    host(3840, 2160),
    { scale: 1, x: 0, y: 0 },
    1920,
    1080,
  );
  const [[, sx, sy, sw, sh, , , ow, oh]] = drawn;
  // An unmoved view starts the cut at -0, which is the same place as 0.
  expect([sx, sy, sw, sh].map((value) => Number(value) + 0)).toEqual([
    0, 0, 3840, 2160,
  ]);
  expect([ow, oh]).toEqual([2560, 1440]);
  expect(
    await captureVisibleStage(
      document.createElement('div'),
      { scale: 1, x: 0, y: 0 },
      800,
      450,
    ),
  ).toBeUndefined();
});
