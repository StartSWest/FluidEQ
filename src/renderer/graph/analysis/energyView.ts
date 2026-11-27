/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readInk } from '../../utils/theme';
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
import {
  FOOT_WORD_HEIGHT,
  footWordFont,
  footWordLine,
  paintKeyedWord,
} from './footWords';

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

/**
 * Where `count` bands divide: the named five, or equal slices — kept per
 * count, since both the reading and the words ask on every frame.
 */
const spreadByCount = new Map<number, readonly number[]>();
const edgesFor = (count: number): readonly number[] => {
  if (count === NAMES.length) {
    return EDGES;
  }
  const known = spreadByCount.get(count);
  if (known) {
    return known;
  }
  const edges = spreadEdges(count);
  spreadByCount.set(count, edges);
  return edges;
};

/** A band the five words cannot name, by its centre: `63`, `1.2k`, `16k`. */
const centreLabel = (edges: readonly number[], index: number): string => {
  const hz = Math.sqrt(edges[index] * edges[index + 1]);
  if (hz < 1000) {
    return `${Math.round(hz)}`;
  }
  const kilo = hz / 1000;
  return `${kilo < 10 ? Number(kilo.toFixed(1)) : Math.round(kilo)}k`;
};

/**
 * What each of `count` columns is called: the five words, or each slice's
 * centre. Every column used to print the axis's first edge, "10", whatever
 * it held. Kept per count, like the edges.
 */
const labelsByCount = new Map<number, readonly string[]>();
export const energyBandLabels = (count: number): readonly string[] => {
  if (count === NAMES.length) {
    return NAMES;
  }
  const known = labelsByCount.get(count);
  if (known) {
    return known;
  }
  const edges = edgesFor(count);
  const labels = Array.from({ length: count }, (_unused, index) =>
    centreLabel(edges, index),
  );
  labelsByCount.set(count, labels);
  return labels;
};

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

/** The figure over each column, in CSS pixels: its size and its lift. */
const FIGURE_PX = 11;

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
  const labels = energyBandLabels(bands.length);
  // The band names on the measuring views' word row, over the frequency
  // names rather than across them (`footWords.ts`).
  const line = footWordLine(band);
  // A word goes only where it fits its column: on a narrow plot (the look
  // picker's tile) the names ran into one another as one line of letters,
  // and the figures over five columns into a smear.
  const fits = (text: string, width: number) =>
    context.measureText(text).width <= width;
  context.save();
  context.textAlign = 'center';
  for (let index = 0; index < bands.length; index += 1) {
    const { left, width } = front.columnAt(index);
    const middle = left + width / 2;
    context.font = footWordFont(700, 10);
    context.textBaseline = line.baseline;
    // Keyed on the window's floor as the note names are (`paintKeyedWord`):
    // bare, at four fifths of the ink, they were grey letters on a pale
    // blue column on the white window, hard to find once lifted off the
    // frequency names they used to lean on.
    context.globalAlpha = band.opacity;
    if (fits(labels[index], width)) {
      paintKeyedWord(context, labels[index], middle, line.y, readInk(0.82));
    }
    const head = placeLevel(band, Math.max(bands[index], hold[index]));
    context.font = `600 ${FIGURE_PX}px system-ui, sans-serif`;
    context.textBaseline = band.flipped ? 'top' : 'bottom';
    context.globalAlpha = band.opacity * 0.7;
    // Over the column's head, clear of its hold mark, or not at all: a
    // column near the top of its scale printed its figure off the plot, cut
    // in half, and pushed back inside it the figure sat on the hold mark.
    // And never on the column's name: a quiet column's head stands in the
    // word row, and its figure is lifted clear of the name instead.
    const at = band.flipped
      ? Math.max(head + FIGURE_PX, line.y + FOOT_WORD_HEIGHT + 4)
      : Math.min(head - FIGURE_PX, line.y - FOOT_WORD_HEIGHT - 4);
    const room = band.flipped
      ? at + FIGURE_PX <= band.bottom
      : at - FIGURE_PX >= band.top;
    const figure = asDecibels(hold[index]);
    if (room && fits(figure, width)) {
      context.fillText(figure, middle, at);
    }
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
