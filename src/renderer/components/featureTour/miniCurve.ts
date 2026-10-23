/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * EQ curves for the tour's drawings: a few bands summed on a log axis from
 * 20 Hz to 20 kHz, shaped as a graph draws them — a bell's width set by its
 * Q, a shelf's half its gain at its corner. Close enough to read as the real
 * thing at the size a slide draws it; the app's own graph does the exact
 * response.
 */

export type TMiniBand =
  | { kind: 'bell'; hz: number; db: number; q: number }
  | { kind: 'lowShelf' | 'highShelf'; hz: number; db: number };

export interface IMiniPlot {
  width: number;
  height: number;
  /** Decibels from the middle to either edge. */
  range: number;
}

const LOW = Math.log10(20);
const SPAN = Math.log10(20000) - LOW;

export const xOfHz = (hz: number, { width }: IMiniPlot) =>
  ((Math.log10(hz) - LOW) / SPAN) * width;

export const yOfDb = (db: number, { height, range }: IMiniPlot) =>
  height / 2 - (db / range) * (height / 2);

const bandAt = (band: TMiniBand, hz: number) => {
  const octaves = Math.log2(hz / band.hz);
  if (band.kind === 'bell') {
    // A bell's half-gain width, in octaves, is about 1.4 / Q.
    const sigma = 0.6 / band.q;
    return band.db * Math.exp(-(octaves * octaves) / (2 * sigma * sigma));
  }
  const ratio = (hz / band.hz) ** 2;
  return band.kind === 'lowShelf'
    ? band.db / (1 + ratio)
    : (band.db * ratio) / (1 + ratio);
};

export const gainAt = (bands: readonly TMiniBand[], hz: number) =>
  bands.reduce((sum, band) => sum + bandAt(band, hz), 0);

const STEPS = 72;

/** The curve as an SVG path across the plot's whole width. */
export const curvePath = (bands: readonly TMiniBand[], plot: IMiniPlot) =>
  Array.from({ length: STEPS + 1 }, (_, step) => {
    const hz = 10 ** (LOW + (SPAN * step) / STEPS);
    const x = xOfHz(hz, plot).toFixed(2);
    const y = yOfDb(gainAt(bands, hz), plot).toFixed(2);
    return `${step === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

/** The same curve closed down to the middle line, for a filled area. */
export const curveArea = (bands: readonly TMiniBand[], plot: IMiniPlot) =>
  `${curvePath(bands, plot)} L${plot.width},${plot.height / 2} L0,${
    plot.height / 2
  } Z`;
