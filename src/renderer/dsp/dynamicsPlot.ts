/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where a band's curve is drawn: a square of level in against level out,
 * -80 to 0 dBFS on both, so unity is the diagonal and every slope reads as
 * its ratio. The lift's floor (-75) and the lowest lift threshold (-80) are
 * both inside it.
 */
export const PLOT_LOW_DB = -80;

/** The axis labels' column on the left. */
const GUTTER = 28;
/** The gain meter beside the square, and the gap before it. */
const METER = 10;
const METER_GAP = 9;
const RIGHT = 3;
const TOP = 10;
/** The axis labels' row under the square. */
const BOTTOM = 22;
/** Under this a square is too small to place five points on. */
const SMALLEST = 96;

export interface IDynamicsPlot {
  /** The drawing's own box, CSS pixels. */
  width: number;
  height: number;
  left: number;
  top: number;
  /** The square's side. */
  size: number;
  meterX: number;
  meterWidth: number;
  x: (db: number) => number;
  y: (db: number) => number;
  /** The level a point in the drawing stands for, the inverse of `x`/`y`. */
  inAt: (px: number) => number;
  outAt: (py: number) => number;
}

/**
 * The geometry of a curve given the width it may take, the square never
 * past `largest`: a narrow card's one curve is the card's width, and a
 * square that wide would push the values and the timing off the screen.
 */
export const dynamicsPlot = (
  available: number,
  largest: number,
): IDynamicsPlot => {
  const size = Math.round(
    Math.max(
      SMALLEST,
      Math.min(largest, available - GUTTER - METER - METER_GAP - RIGHT),
    ),
  );
  const span = -PLOT_LOW_DB;
  return {
    width: GUTTER + size + METER_GAP + METER + RIGHT,
    height: TOP + size + BOTTOM,
    left: GUTTER,
    top: TOP,
    size,
    meterX: GUTTER + size + METER_GAP,
    meterWidth: METER,
    x: (db) => GUTTER + ((db - PLOT_LOW_DB) / span) * size,
    y: (db) => TOP + (1 - (db - PLOT_LOW_DB) / span) * size,
    inAt: (px) => PLOT_LOW_DB + ((px - GUTTER) / size) * span,
    outAt: (py) => PLOT_LOW_DB + (1 - (py - TOP) / size) * span,
  };
};

/**
 * Where a point is drawn: on its place, or on the square's edge for one past
 * the floor (a gentle lift's top can stand under -80 dBFS), still in reach.
 */
export const onPlot = (
  plot: IDynamicsPlot,
  inDb: number,
  outDb: number,
): { x: number; y: number } => ({
  x: plot.x(Math.max(inDb, PLOT_LOW_DB)),
  y: plot.y(Math.max(outDb, PLOT_LOW_DB)),
});

/** The gain meter's reach either side of nothing done, dB. */
export const METER_SPAN_DB = 12;

/** Where a gain stands on the meter beside the square. */
export const meterY = (plot: IDynamicsPlot, gainDb: number) =>
  plot.top +
  plot.size / 2 -
  (Math.max(-METER_SPAN_DB, Math.min(METER_SPAN_DB, gainDb)) / METER_SPAN_DB) *
    (plot.size / 2);
