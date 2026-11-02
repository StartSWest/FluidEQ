/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A picture for the lamps made from the scene's own colours, for when the
 * scene itself cannot be drawn for them — no GPU context in the worker, a
 * shader that compiles on the graph's context and not on this one.
 *
 * Not a flat colour: the pack's swatch runs left to right across the grid and
 * rises as a spectrum, bass on the left, so the desk still reads as this
 * scene's palette moving with this music.
 */

const parseHex = (hex: string): [number, number, number] | undefined => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) {
    return undefined;
  }
  const value = Number.parseInt(match[1], 16);
  return [
    Math.floor(value / 65_536) % 256,
    Math.floor(value / 256) % 256,
    value % 256,
  ];
};

export const swatchColours = (swatch: readonly string[]) => {
  const colours = swatch
    .map(parseHex)
    .filter(
      (colour): colour is [number, number, number] => colour !== undefined,
    );
  // The app's accent when a pack carries no usable swatch.
  return colours.length > 0
    ? colours
    : [[0, 229, 207] as [number, number, number]];
};

export const fillSwatchGrid = (
  colours: readonly (readonly [number, number, number])[],
  spectrum: Uint8Array,
  width: number,
  height: number,
  into: Uint8Array,
): Uint8Array => {
  for (let x = 0; x < width; x += 1) {
    const along = width === 1 ? 0 : x / (width - 1);
    const position = along * (colours.length - 1);
    const lower = Math.floor(position);
    const upper = Math.min(colours.length - 1, lower + 1);
    const t = position - lower;
    const colour = [0, 1, 2].map(
      (channel) =>
        colours[lower][channel] * (1 - t) + colours[upper][channel] * t,
    );
    const texel =
      spectrum[
        Math.min(spectrum.length - 1, Math.round(along * (spectrum.length - 1)))
      ];
    const reach = (texel / 255) * height;
    for (let y = 0; y < height; y += 1) {
      const fromBottom = height - y - 0.5;
      // Lit up to the level, glowing faintly above it.
      const light = fromBottom <= reach ? 1 : 0.22;
      const at = (y * width + x) * 3;
      into[at] = Math.round(colour[0] * light);
      into[at + 1] = Math.round(colour[1] * light);
      into[at + 2] = Math.round(colour[2] * light);
    }
  }
  return into;
};
