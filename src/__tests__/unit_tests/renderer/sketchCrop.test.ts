/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The sketch's crop box (`sketchCrop.ts`; Ivan, 2026-11-08: "zoom and crop
 * attached chat images"): drawn either way, moved and stretched without
 * leaving the picture, and kept in whole pixels.
 */

import {
  cropAfter,
  cropPixels,
  cropUsable,
  LEAST_CROP,
} from '../../../renderer/studio/chat/sketchCrop';

const size = { width: 1600, height: 900 };

describe('the crop box', () => {
  it('is drawn between the press and the pointer, whichever way the drag went', () => {
    expect(
      cropAfter('new', undefined, { x: 500, y: 400 }, { x: 100, y: 50 }, size),
    ).toEqual({
      x: 100,
      y: 50,
      width: 400,
      height: 350,
    });
  });

  it('stops at the picture’s edges', () => {
    expect(
      cropAfter(
        'new',
        undefined,
        { x: 1500, y: 800 },
        { x: 2000, y: -40 },
        size,
      ),
    ).toEqual({
      x: 1500,
      y: 0,
      width: 100,
      height: 800,
    });
  });

  it('moves whole, and never past an edge', () => {
    const box = { x: 100, y: 100, width: 400, height: 300 };
    expect(
      cropAfter('move', box, { x: 200, y: 200 }, { x: 260, y: 150 }, size),
    ).toEqual({
      ...box,
      x: 160,
      y: 50,
    });
    expect(
      cropAfter('move', box, { x: 200, y: 200 }, { x: 5000, y: 5000 }, size),
    ).toEqual({
      ...box,
      x: 1200,
      y: 600,
    });
  });

  it('stretches by one corner with the one across held, and turns over past it', () => {
    const box = { x: 100, y: 100, width: 400, height: 300 };
    // The bottom right corner (500, 400) holds while the top left moves.
    expect(
      cropAfter('nw', box, { x: 100, y: 100 }, { x: 50, y: 20 }, size),
    ).toEqual({
      x: 50,
      y: 20,
      width: 450,
      height: 380,
    });
    // Dragged past the held corner: the box turns over rather than inside out.
    expect(
      cropAfter('nw', box, { x: 100, y: 100 }, { x: 600, y: 500 }, size),
    ).toEqual({
      x: 500,
      y: 400,
      width: 100,
      height: 100,
    });
    expect(
      cropAfter('se', box, { x: 500, y: 400 }, { x: 700, y: 450 }, size),
    ).toEqual({
      x: 100,
      y: 100,
      width: 600,
      height: 350,
    });
  });

  it('is worth keeping only past the least size, and keeps whole pixels inside the picture', () => {
    expect(cropUsable(undefined)).toBe(false);
    expect(cropUsable({ x: 0, y: 0, width: LEAST_CROP - 1, height: 400 })).toBe(
      false,
    );
    expect(
      cropUsable({ x: 0, y: 0, width: LEAST_CROP, height: LEAST_CROP }),
    ).toBe(true);
    expect(
      cropPixels({ x: 10.4, y: 20.6, width: 300.5, height: 2000 }, size),
    ).toEqual({
      x: 10,
      y: 21,
      width: 301,
      height: 879,
    });
  });
});
