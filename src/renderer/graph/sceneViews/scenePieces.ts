/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { clampUnit, peakBetween, type ISceneFrame } from './sceneFrame';

/**
 * The row of pieces a scene made of pieces stands on — a board's columns of
 * lamps, a row of glass, a bank of bars — laid out from the style editor's
 * Pieces and Gap, and the peak each piece holds for Lit peaks.
 *
 * Shared so every one of them answers the two settings the same way: Pieces
 * is how many across the plot, never more than fit at the scene's smallest
 * pitch; Gap is the share of each pitch left empty. And one peak hold, so a
 * held lamp and a floating cap rise and fall alike.
 */

export interface IPieceRow {
  count: number;
  /** From one piece's left edge to the next, in CSS pixels. */
  pitch: number;
  /** A piece's own width, after the gap. */
  body: number;
  /** Each piece's left edge, and the loudest reading under its pitch. */
  lefts: Float64Array;
  levels: Float64Array;
}

export const createPieceRow = (): IPieceRow => ({
  count: 0,
  pitch: 0,
  body: 0,
  lefts: new Float64Array(0),
  levels: new Float64Array(0),
});

/**
 * Lays the row out for this frame, reusing its buffers.
 *
 * `minPitch` is the smallest a piece may be and still read as one — a lamp,
 * a bar with a lit edge — so a narrow window gets fewer pieces of the same
 * size rather than the same count squashed into slivers.
 */
export const layPieces = (
  frame: ISceneFrame,
  row: IPieceRow,
  minPitch: number,
): IPieceRow => {
  const { plot, xs, levels, look } = frame;
  const width = Math.max(1, plot.right - plot.left);
  const fits = Math.max(4, Math.floor(width / minPitch));
  const count = Math.max(4, Math.min(Math.round(look.pieces), fits));
  if (row.count !== count) {
    row.count = count;
    row.lefts = new Float64Array(count);
    row.levels = new Float64Array(count);
  }
  row.pitch = width / count;
  row.body = Math.max(1, row.pitch * (1 - clampUnit(look.gap)));
  const inset = (row.pitch - row.body) / 2;
  for (let piece = 0; piece < count; piece += 1) {
    const from = plot.left + piece * row.pitch;
    row.lefts[piece] = from + inset;
    row.levels[piece] = clampUnit(
      peakBetween(xs, levels, from, from + row.pitch),
    );
  }
  return row;
};

/** A peak held for a moment over each piece, then let fall. */
export interface IPeakHold {
  held: Float64Array;
  waited: Float64Array;
}

export const createPeakHold = (): IPeakHold => ({
  held: new Float64Array(0),
  waited: new Float64Array(0),
});

/** How long a peak stays, and how fast it then falls, in plot fractions. */
const HOLD_MS = 420;
const FALL_PER_SECOND = 0.6;

/**
 * Advances every held peak by one frame: up at once to a new high, held,
 * then falling at a steady rate. Once per frame, not once per copy of a
 * mirrored drawing, or the fall runs twice as fast. Returns whether any is
 * still falling, so the graph keeps drawing until they land.
 */
export const holdPeaks = (
  hold: IPeakHold,
  levels: Float64Array,
  count: number,
  deltaMs: number,
): boolean => {
  if (hold.held.length !== count) {
    hold.held = new Float64Array(count);
    hold.waited = new Float64Array(count);
  }
  let falling = false;
  for (let piece = 0; piece < count; piece += 1) {
    if (levels[piece] >= hold.held[piece]) {
      hold.held[piece] = levels[piece];
      hold.waited[piece] = 0;
    } else {
      hold.waited[piece] += deltaMs;
      if (hold.waited[piece] > HOLD_MS) {
        hold.held[piece] = Math.max(
          levels[piece],
          hold.held[piece] - (FALL_PER_SECOND * deltaMs) / 1000,
        );
        falling = true;
      }
    }
  }
  return falling;
};
