/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import createDotTexture from '../../../renderer/graph/world/worldDot';

// three's build is ES modules this Jest cannot load, and the dot needs only
// a texture that keeps the bytes it is given.
jest.mock('three', () => ({
  DataTexture: class DataTexture {
    image: { data: Uint8Array; width: number; height: number };

    constructor(data: Uint8Array, width: number, height: number) {
      this.image = { data, width, height };
    }
  },
  LinearFilter: 1006,
}));

interface IKeptTexture {
  image: { data: Uint8Array; width: number; height: number };
}

/**
 * Every point of a world is drawn as this dot. Its core and its glow added
 * up past 1 in the middle and the byte array wrapped 293 round to 37, so
 * every point was a ring round a dark hole.
 */
describe("a world point's dot", () => {
  /** Its opacity from the middle out to the edge, along the middle row. */
  const outward = (): number[] => {
    const { data, width, height } = (
      createDotTexture() as unknown as IKeptTexture
    ).image;
    const row = (height / 2) * width;
    const alphas: number[] = [];
    for (let x = width / 2; x < width; x += 1) {
      alphas.push(data[(row + x) * 4 + 3]);
    }
    return alphas;
  };

  it('is as bright as a point can be at its middle', () => {
    expect(outward()[0]).toBe(255);
  });

  it('never brightens on its way out to the edge', () => {
    const alphas = outward();
    for (let i = 1; i < alphas.length; i += 1) {
      expect(alphas[i]).toBeLessThanOrEqual(alphas[i - 1]);
    }
  });

  it('is gone at the edge', () => {
    const alphas = outward();
    expect(alphas[alphas.length - 1]).toBeLessThan(8);
  });
});
