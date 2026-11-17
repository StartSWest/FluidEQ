/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The recorder's colours as bytes. Its pixels are written straight into an
 * `ImageData` (`waveformRecorder.ts`), so every colour it uses — the theme's
 * tokens, which arrive as hex or as `color-mix()`, and the trace's ramp — is
 * resolved once to red, green, blue and alpha by the browser itself, and the
 * ramp to a table of 256 steps. Resolved again only when one of the strings
 * changes: a theme, a mode, Rainbow on or off.
 */

export interface IRecorderPalette {
  /** The body's colours, from the centre line (0) to the strip's edge (1). */
  stops: readonly { offset: number; colour: string }[];
  /** The centre line. */
  unlit: string;
  /** Every column while the capture is paused. */
  paused: string;
  /** A railed sample's mark. */
  hot: string;
}

export interface IRecorderInk {
  /** 256 steps of the ramp, four bytes each. */
  ramp: Uint8ClampedArray;
  unlit: Uint8ClampedArray;
  paused: Uint8ClampedArray;
  hot: Uint8ClampedArray;
}

const RAMP_STEPS = 256;

export const paletteKey = (palette: IRecorderPalette): string =>
  `${palette.stops.map((stop) => `${stop.offset}:${stop.colour}`).join('|')}#${palette.unlit}#${palette.paused}#${palette.hot}`;

/**
 * The palette in bytes, painted by a scratch canvas and read back. Undefined
 * where there is no 2D context to paint with (a test's DOM).
 */
export const resolveRecorderInk = (
  palette: IRecorderPalette,
): IRecorderInk | undefined => {
  const canvas = document.createElement('canvas');
  canvas.width = RAMP_STEPS;
  canvas.height = 4;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return undefined;
  }
  const ramp = context.createLinearGradient(0, 0, RAMP_STEPS, 0);
  palette.stops.forEach((stop) => ramp.addColorStop(stop.offset, stop.colour));
  context.fillStyle = ramp;
  context.fillRect(0, 0, RAMP_STEPS, 1);
  const singles = [palette.unlit, palette.paused, palette.hot];
  singles.forEach((colour, index) => {
    context.fillStyle = colour;
    context.fillRect(0, index + 1, 1, 1);
  });
  const pixels = context.getImageData(0, 0, RAMP_STEPS, 4).data;
  const single = (row: number) =>
    pixels.slice(row * RAMP_STEPS * 4, row * RAMP_STEPS * 4 + 4);
  return {
    ramp: pixels.slice(0, RAMP_STEPS * 4),
    unlit: single(1),
    paused: single(2),
    hot: single(3),
  };
};
