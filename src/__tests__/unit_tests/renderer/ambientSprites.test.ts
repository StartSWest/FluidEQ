/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What each ambient shape is actually drawn from. The sprites are made once
 * and reused, so a shape that draws nothing is a shape that never appears in
 * anybody's window, quietly.
 */

import { ambientSprite } from '../../../renderer/ambient/ambientSprites';

interface IRecorded {
  fills: number;
  strokes: number;
  rects: number;
  gradients: number;
  arcs: number;
}

const recorded: IRecorded = {
  fills: 0,
  strokes: 0,
  rects: 0,
  gradients: 0,
  arcs: 0,
};

const context = {
  translate: jest.fn(),
  scale: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  rotate: jest.fn(),
  beginPath: jest.fn(),
  closePath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(() => {
    recorded.strokes += 1;
  }),
  arc: jest.fn(() => {
    recorded.arcs += 1;
  }),
  fill: jest.fn(() => {
    recorded.fills += 1;
  }),
  fillRect: jest.fn(() => {
    recorded.rects += 1;
  }),
  createRadialGradient: jest.fn(() => {
    recorded.gradients += 1;
    return { addColorStop: jest.fn() };
  }),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'butt',
  globalAlpha: 1,
  shadowColor: '',
  shadowBlur: 0,
};

class FakeOffscreenCanvas {
  width: number;

  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  // eslint-disable-next-line class-methods-use-this
  getContext() {
    return context;
  }
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'OffscreenCanvas', {
    value: FakeOffscreenCanvas,
    configurable: true,
  });
});

beforeEach(() => {
  recorded.fills = 0;
  recorded.strokes = 0;
  recorded.rects = 0;
  recorded.gradients = 0;
  recorded.arcs = 0;
});

describe('a cut stone', () => {
  it('is drawn as lines - its outline and its facets - over a faint wash', () => {
    // Two stroked paths (the side-on outline, then the girdle and the facet
    // edges), one faint fill inside them, and the cross of light that says
    // stone rather than tile at the sizes these drift at. Filled solid
    // instead, they sat on the window's panels as blobs.
    const sprite = ambientSprite({
      shape: 'gem',
      colour: '#c9a7ff',
      size: 24,
      ratio: 2,
    });
    expect(sprite).toBeDefined();
    expect(recorded.strokes).toBe(2);
    expect(recorded.fills).toBeLessThanOrEqual(2);
    expect(recorded.rects).toBe(2);
    expect(recorded.gradients).toBeGreaterThanOrEqual(1);
  });

  it('is made once for a size and colour, and answered from then on', () => {
    const first = ambientSprite({
      shape: 'gem',
      colour: '#ffffff',
      size: 16,
      ratio: 1,
    });
    recorded.strokes = 0;
    const again = ambientSprite({
      shape: 'gem',
      colour: '#ffffff',
      size: 16,
      ratio: 1,
    });
    expect(again).toBe(first);
    expect(recorded.strokes).toBe(0);
  });
});
