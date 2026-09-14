/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The ambient layer's frame keeps every visualizer's box clear of its shapes,
 * out to whole device pixels, however the boxes lie.
 */

import { paintAmbient } from '../../../renderer/ambient/ambientPaint';

const recordingContext = () => {
  const cleared: Array<[number, number, number, number]> = [];
  const context = {
    setTransform: jest.fn(),
    clearRect: jest.fn((x: number, y: number, w: number, h: number) => {
      cleared.push([x, y, w, h]);
    }),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    scale: jest.fn(),
    drawImage: jest.fn(),
    globalAlpha: 1,
  };
  return { context, cleared };
};

const paint = (
  boxes: Array<{ left: number; top: number; width: number; height: number }>,
  ratio: number,
) => {
  const { context, cleared } = recordingContext();
  paintAmbient({
    context: context as unknown as CanvasRenderingContext2D,
    elements: [],
    placed: [],
    pictures: new Map(),
    ratio,
    width: 1000,
    height: 800,
    fade: 1,
    boxes,
  });
  // The first clear is the whole canvas, before anything is drawn.
  return cleared.slice(1);
};

it('wipes every visualizer’s box after drawing, overlapping or not', () => {
  expect(
    paint(
      [
        { left: 10, top: 20, width: 300, height: 100 },
        { left: 200, top: 50, width: 300, height: 100 },
      ],
      1,
    ),
  ).toEqual([
    [10, 20, 300, 100],
    [200, 50, 300, 100],
  ]);
});

it('wipes out to whole device pixels, so a box a fraction of a pixel wide keeps no sliver', () => {
  // 733.33 on the right, at a pixel ratio of 1.5: device pixels 150 to 1100.
  expect(
    paint([{ left: 100, top: 10.2, width: 633.33, height: 50 }], 1.5),
  ).toEqual([[150, 15, 950, 76]]);
});

it('wipes nothing more when no visualizer is on screen', () => {
  expect(paint([], 1)).toEqual([]);
});
