/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The scopes' trails fade toward TRANSPARENT, never toward a colour: faded
 * toward the card's colour, an 8-bit canvas settled a few steps short of it
 * and kept the dial's ghost behind the trace for good (Ivan, 2026-09-22: "I
 * can see the meter behind"). And the canvas is asked for at float16, the
 * precision at which such a fade actually finishes.
 */

import { fadeTrail, fadingContext } from '../../../renderer/utils/fadingCanvas';

describe('a fading scope canvas', () => {
  it('takes the trail away toward transparent, and leaves the drawing mode as it was', () => {
    const seen: { operation: string; fill: unknown }[] = [];
    const drawing = {
      globalCompositeOperation: 'source-over',
      fillStyle: '#000' as unknown,
      fillRect: () => {
        seen.push({
          operation: drawing.globalCompositeOperation,
          fill: drawing.fillStyle,
        });
      },
    };
    const context = drawing as unknown as CanvasRenderingContext2D;

    fadeTrail(context, 100, 40, 0.16);

    expect(seen).toEqual([
      { operation: 'destination-out', fill: 'rgba(0, 0, 0, 0.16)' },
    ]);
    // What the scope draws next is drawn over, as before the fade.
    expect(context.globalCompositeOperation).toBe('source-over');
  });

  it('asks for the high-precision canvas as the first context', () => {
    const getContext = jest.fn(() => null);
    const canvas = { getContext } as unknown as HTMLCanvasElement;
    fadingContext(canvas);
    expect(getContext).toHaveBeenCalledWith('2d', {
      alpha: true,
      colorType: 'float16',
    });
  });
});
