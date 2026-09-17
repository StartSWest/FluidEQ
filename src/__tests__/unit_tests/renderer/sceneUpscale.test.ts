/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  easuConstants,
  RCAS_SHARPNESS_STOPS,
} from '../../../renderer/graph/sceneUpscale';

describe('the upscale pass constants', () => {
  /**
   * The reference's FsrEasuCon: output pixel to input texel scale, and the
   * offset that puts the output pixel's centre in texel space with texel `f`
   * at the floor.
   */
  it('maps output pixels onto input texels as the reference does', () => {
    const [scaleX, scaleY, offsetX, offsetY] = easuConstants(
      1920,
      1080,
      3840,
      2160,
    );
    expect(scaleX).toBe(0.5);
    expect(scaleY).toBe(0.5);
    expect(offsetX).toBe(-0.25);
    expect(offsetY).toBe(-0.25);
  });

  it('is the identity at native size', () => {
    expect(easuConstants(100, 50, 100, 50)).toEqual([1, 1, 0, 0]);
  });

  it('centres the output pixel at any ratio', () => {
    const [scaleX, , offsetX] = easuConstants(2560, 1440, 3840, 2160);
    // The centre of output pixel 0 (at 0.5) lands at 0.5 * 2/3 in input
    // pixels, which is texel space 0.5 * 2/3 - 0.5.
    expect(offsetX).toBeCloseTo(0.5 * scaleX - 0.5, 9);
  });

  it('sharpens below the maximum, so thin bright lines get no halo', () => {
    expect(RCAS_SHARPNESS_STOPS).toBeGreaterThan(0);
    expect(RCAS_SHARPNESS_STOPS).toBeLessThan(1);
  });
});
