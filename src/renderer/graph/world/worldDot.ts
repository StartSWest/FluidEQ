/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DataTexture, LinearFilter } from 'three';

const DOT_SIZE = 64;

/**
 * A soft round dot, brightest in the middle: what every point of a world is
 * drawn as. A bright core with a soft glow round it, gone before the edge.
 *
 * The two parts add up past 1 inside about a tenth of the radius (1.15 at
 * the very middle), and a byte array wraps rather than clamps: 293 was
 * stored as 37, so every point was drawn as a ring round a dark hole. The
 * sum is held to the byte's range.
 */
const createDotTexture = (): DataTexture => {
  const data = new Uint8Array(DOT_SIZE * DOT_SIZE * 4);
  for (let y = 0; y < DOT_SIZE; y += 1) {
    for (let x = 0; x < DOT_SIZE; x += 1) {
      const dx = (x + 0.5) / DOT_SIZE - 0.5;
      const dy = (y + 0.5) / DOT_SIZE - 0.5;
      const r = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
      const falloff = Math.exp(-r * r * 6) * (1 - r * r) + (1 - r) ** 3 * 0.15;
      const at = (y * DOT_SIZE + x) * 4;
      data[at] = 255;
      data[at + 1] = 255;
      data[at + 2] = 255;
      data[at + 3] = Math.round(Math.min(1, falloff) * 255);
    }
  }
  const texture = new DataTexture(data, DOT_SIZE, DOT_SIZE);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
};

export default createDotTexture;
