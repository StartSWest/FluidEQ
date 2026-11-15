/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A computed CSS colour as sRGB channels from 0 to 1, for a canvas or a
 * WebGL scene that has to wear the theme's colours.
 *
 * Chromium hands a computed colour back as `rgb()`/`rgba()`, or, where the
 * theme mixes it, as `color(srgb …)`; neither needs the theme's own
 * notation understood here. Anything else answers nothing, and the caller
 * keeps its own fallback.
 */
const cssColourChannels = (
  value: string,
): [number, number, number] | undefined => {
  const rgb = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(value);
  if (rgb) {
    return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
  }
  const srgb = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value);
  if (srgb) {
    return [Number(srgb[1]), Number(srgb[2]), Number(srgb[3])];
  }
  return undefined;
};

export default cssColourChannels;
