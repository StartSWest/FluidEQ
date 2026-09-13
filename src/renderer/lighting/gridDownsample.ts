/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A drawn scene, reduced to the grid the lamps sample.
 *
 * Each grid cell is a block of rendered pixels averaged with every pixel
 * weighted by the square of its brightness, plus a little so a black block
 * stays black rather than dividing by nothing. A plain average was tried in
 * the mockup: a lit window is one pixel in sixteen of its block, so the
 * skyline's neon came out as the sky's dark blue with a tint.
 *
 * `pixels` is what `readPixels` returns — RGBA, the BOTTOM row first, alpha
 * premultiplied (the scene context's own setting), which over black is simply
 * the RGB. The grid is written top row first, as the lamps read it.
 */
export const downsampleToGrid = (
  pixels: Uint8Array,
  pixelWidth: number,
  pixelHeight: number,
  gridWidth: number,
  gridHeight: number,
  into: Uint8Array,
): Uint8Array => {
  const blockX = pixelWidth / gridWidth;
  const blockY = pixelHeight / gridHeight;
  for (let gy = 0; gy < gridHeight; gy += 1) {
    const top = Math.floor(gy * blockY);
    const bottom = Math.max(top + 1, Math.floor((gy + 1) * blockY));
    for (let gx = 0; gx < gridWidth; gx += 1) {
      const left = Math.floor(gx * blockX);
      const right = Math.max(left + 1, Math.floor((gx + 1) * blockX));
      let r = 0;
      let g = 0;
      let b = 0;
      let total = 0;
      for (let py = top; py < bottom; py += 1) {
        // Flipped: grid row 0 is the picture's top, pixel row 0 its bottom.
        const row = (pixelHeight - 1 - py) * pixelWidth;
        for (let px = left; px < right; px += 1) {
          const at = (row + px) * 4;
          const pr = pixels[at];
          const pg = pixels[at + 1];
          const pb = pixels[at + 2];
          const luma = (54 * pr + 183 * pg + 19 * pb) / 65025;
          const weight = luma * luma + 0.0004;
          r += pr * weight;
          g += pg * weight;
          b += pb * weight;
          total += weight;
        }
      }
      const cell = (gy * gridWidth + gx) * 3;
      into[cell] = Math.round(r / total);
      into[cell + 1] = Math.round(g / total);
      into[cell + 2] = Math.round(b / total);
    }
  }
  return into;
};
