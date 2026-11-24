/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Mic tab's three live pictures — the low cut, noise cancelling and
 * the gate — share: a canvas sized to its box at the screen's density, their
 * two axes, and the inks of the DSP pages they sit among (`dspInks.ts`), so
 * a voice is drawn in the colour the EQ page draws a spectrum and what a
 * stage took in the colour the Denoise page draws the hiss it took.
 */

import { readSurface, readSurfaceAlpha } from '../utils/theme';

/** The plot's box inside the canvas, in CSS pixels. */
export interface IMicPlot {
  width: number;
  height: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface IMicPlotPads {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The canvas made the size it is drawn at, cleared, with its transform set
 * to CSS pixels; `undefined` until it has been laid out.
 */
export const fitMicCanvas = (
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  pads: IMicPlotPads,
): IMicPlot | undefined => {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === 0 || height === 0) {
    return undefined;
  }
  const ratio = window.devicePixelRatio || 1;
  const backingWidth = Math.round(width * ratio);
  const backingHeight = Math.round(height * ratio);
  // Only when it changed: assigning a size clears the canvas.
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return {
    width,
    height,
    left: pads.left,
    top: pads.top,
    right: Math.max(pads.left + 1, width - pads.right),
    bottom: Math.max(pads.top + 1, height - pads.bottom),
  };
};

/** Where a frequency stands across a log axis from `lowHz` to `highHz`. */
export const xOfHz = (
  plot: IMicPlot,
  hz: number,
  lowHz: number,
  highHz: number,
): number =>
  plot.left +
  (Math.log(Math.min(highHz, Math.max(lowHz, hz)) / lowHz) /
    Math.log(highHz / lowHz)) *
    (plot.right - plot.left);

/** The frequency at a point across that axis. */
export const hzOfX = (
  plot: IMicPlot,
  x: number,
  lowHz: number,
  highHz: number,
): number =>
  lowHz *
  (highHz / lowHz) **
    Math.min(1, Math.max(0, (x - plot.left) / (plot.right - plot.left)));

/** Where a level stands down an axis from `topDb` to `floorDb`. */
export const yOfDb = (
  plot: IMicPlot,
  db: number,
  topDb: number,
  floorDb: number,
): number =>
  plot.top +
  ((topDb - Math.min(topDb, Math.max(floorDb, db))) / (topDb - floorDb)) *
    (plot.bottom - plot.top);

/** The level at a point down that axis. */
export const dbOfY = (
  plot: IMicPlot,
  y: number,
  topDb: number,
  floorDb: number,
): number =>
  topDb -
  Math.min(1, Math.max(0, (y - plot.top) / (plot.bottom - plot.top))) *
    (topDb - floorDb);

/**
 * What a stage took away, in both the Low cut's and Noise cancelling's
 * pictures: a fixed warm orange, as the mockups drew it, never a scene's
 * colour. Under a scene's tint every DSP ink can land on one colour (the
 * harness's did: accent, active, applied and spectrum all one teal), and
 * "taken" would then be the voice's own colour, told apart by its hatching
 * alone. A series that means something of its own keeps its colour, as the
 * Denoise page's amber floor does (`dspInks.ts`); `$mic-taken` in
 * `MicCards.scss` is the same orange.
 */
export const TAKEN_INK = '232, 106, 52';

/** The labels' face: the DSP graphs' own, at their size. */
export const MIC_PLOT_FONT = '10px system-ui, sans-serif';

/**
 * A label written over the picture with a thin halo of the card's own
 * colour under it, so it reads across a curve or the hatching it sits on:
 * the hum's name stood on the cut's curve and vanished into it.
 */
export const haloText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
): void => {
  const ink = context.fillStyle;
  context.lineJoin = 'round';
  context.lineWidth = 3;
  context.strokeStyle = readSurface('--surface-panel', '#10161c');
  context.strokeText(text, x, y);
  context.fillStyle = ink;
  context.fillText(text, x, y);
};

/**
 * The gate's own colour, `--dsp-contrast` (amber, or a scene's "on"
 * colour): its line on the voice picture in the header is drawn in it, so
 * the two lines read as the same gate.
 */
export const gateInk = (alpha: number): string =>
  readSurfaceAlpha('--dsp-contrast', alpha, `rgba(255, 176, 89, ${alpha})`);
