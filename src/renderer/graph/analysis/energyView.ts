/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  ANALYSIS_RANGE_DB,
  placeLevel,
  type IAnalysisFrame,
  type IAnalysisState,
} from './analysisFrame';
import {
  advanceBars,
  barRowsOf,
  barsMoving,
  paintBarRows,
  type IBarView,
} from './barRows';
import { readNamedBands } from './octaveBands';

/**
 * Energy bands: the whole record as five meters.
 *
 * The one view here you can read from the other side of the room, and the
 * one that answers the question people actually ask — "is there too much
 * bass" — without anybody having to learn to read a spectrum. Five columns,
 * each the power in a named range, each with its name, its number in
 * decibels and a peak that hangs.
 *
 * QUICK. A band meter is read the way every meter is read: it snaps to the
 * hit and lets go slowly enough to see. The five ranges are the ones a
 * listener already has words for, which is the whole design — a display
 * whose bands are 250-500-1k-2k tells a technician something and a listener
 * nothing.
 *
 * Pieces cuts the same span into more or fewer columns, and past five they
 * are named by their range instead: there are only five words.
 */

/**
 * Where the named bands divide, in hertz.
 *
 * Sub below 60, bass to 250, mid to 2k, presence to 6k, air above. Chosen
 * by what the words mean rather than by an equal share of the octaves: the
 * bass takes two octaves and the mid takes three, because that is where the
 * sound people call "mid" actually lives.
 */
const EDGES = [10, 60, 250, 2000, 6000, 25_000] as const;

/** What each one is called. Five words, and no more than five. */
const NAMES = ['SUB', 'BASS', 'MID', 'PRES', 'AIR'] as const;

/** Equal slices of the log axis, for a count the five words cannot name. */
const spreadEdges = (count: number): number[] => {
  const low = Math.log10(EDGES[0]);
  const high = Math.log10(EDGES[EDGES.length - 1]);
  return Array.from(
    { length: count + 1 },
    (_unused, index) => 10 ** (low + ((high - low) * index) / count),
  );
};

/** Where `count` bands divide: the named five, or equal slices. */
const edgesFor = (count: number): readonly number[] =>
  count === NAMES.length ? EDGES : spreadEdges(count);

export const ENERGY_BARS: IBarView = {
  count: (pieces) => Math.max(3, Math.min(24, pieces)),
  read: (levels, axis, bands) =>
    readNamedBands(levels, axis, edgesFor(bands.length), bands),
  hangMs: 900,
  /** Plot depths per second: a meter's fall, quick enough to follow a song. */
  fall: 0.11,
  minGap: 4,
  minWidth: 2,
  pairInset: 1,
  capHeight: 3,
  capLift: 4,
  capAlpha: 0.85,
  shortest: 1,
  radius: (width) => Math.min(6, width / 3),
};

/** A band's reading as the decibels the right-hand scale would name. */
const asDecibels = (level: number) =>
  level <= 0 ? '—' : `${((level - 1) * ANALYSIS_RANGE_DB).toFixed(0)}`;

/**
 * The name under each column and its number over it, over whatever drew the
 * columns. Only on the front channel: printed twice for a split they would
 * sit on top of each other, and the key already says which figure is which.
 */
export const paintEnergyWords = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): void => {
  const { context, band } = frame;
  const rows = barRowsOf(frame, state, ENERGY_BARS);
  const front = rows[rows.length - 1];
  const { bands, hold } = front;
  const named = bands.length === NAMES.length;
  const foot = band.flipped ? band.top : band.bottom;
  const inward = band.flipped ? 1 : -1;
  context.save();
  context.textAlign = 'center';
  for (let index = 0; index < bands.length; index += 1) {
    const { left, width } = front.columnAt(index);
    const middle = left + width / 2;
    context.font = '700 10px system-ui, sans-serif';
    context.textBaseline = band.flipped ? 'top' : 'bottom';
    context.globalAlpha = band.opacity * 0.85;
    context.fillStyle = 'rgba(255, 255, 255, 0.82)';
    context.fillText(
      named ? NAMES[index] : `${Math.round(EDGES[0])}`,
      middle,
      foot + inward * 4,
    );
    const head = placeLevel(band, Math.max(bands[index], hold[index]));
    context.font = '600 11px system-ui, sans-serif';
    context.textBaseline = band.flipped ? 'top' : 'bottom';
    context.globalAlpha = band.opacity * 0.7;
    context.fillText(asDecibels(hold[index]), middle, head + inward * 11);
  }
  context.restore();
  context.globalAlpha = 1;
};

const drawEnergyView = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): boolean => {
  const bars = advanceBars(frame, state, ENERGY_BARS);
  paintBarRows(frame, bars, ENERGY_BARS);
  return barsMoving(bars);
};

export default drawEnergyView;
