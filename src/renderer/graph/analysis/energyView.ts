/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  ANALYSIS_RANGE_DB,
  STILL_ENOUGH,
  advanceHold,
  clamp01,
  placeLevel,
  scratch,
  type IAnalysisFrame,
  type IAnalysisState,
} from './analysisFrame';
import { asMate, paintChannelLegend } from './channelInk';
import { readNamedBands } from './octaveBands';
import { paintTexture, piecePaint, spectrumInk } from './spectrumPaint';

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

const HOLD_HANG_MS = 900;

/** Plot depths per second: a meter's fall, quick enough to follow a song. */
const HOLD_FALL = 0.11;

const CAP_HEIGHT = 3;

/** Equal slices of the log axis, for a count the five words cannot name. */
const spreadEdges = (count: number): number[] => {
  const low = Math.log10(EDGES[0]);
  const high = Math.log10(EDGES[EDGES.length - 1]);
  return Array.from(
    { length: count + 1 },
    (_unused, index) => 10 ** (low + ((high - low) * index) / count),
  );
};

/** A band's reading as the decibels the right-hand scale would name. */
const asDecibels = (level: number) =>
  level <= 0 ? '—' : `${((level - 1) * ANALYSIS_RANGE_DB).toFixed(0)}`;

const paintColumns = (
  frame: IAnalysisFrame,
  bands: Float64Array,
  hold: Float64Array,
  columnAt: (index: number) => { left: number; width: number },
  loudest: number,
  strength: number,
  labelled: boolean,
): void => {
  const { context, band, tuning } = frame;
  const foot = band.flipped ? band.top : band.bottom;
  const bodies = new Path2D();
  const caps = new Path2D();
  for (let index = 0; index < bands.length; index += 1) {
    const { left, width } = columnAt(index);
    const head = placeLevel(band, bands[index]);
    if (Math.abs(head - foot) > 1) {
      bodies.roundRect(
        left,
        Math.min(head, foot),
        width,
        Math.abs(head - foot),
        Math.min(6, width / 3),
      );
    }
    if (hold[index] > 0.004) {
      const row = placeLevel(band, hold[index]);
      caps.rect(
        left,
        band.flipped ? row + 4 : row - 4 - CAP_HEIGHT,
        width,
        CAP_HEIGHT,
      );
    }
  }

  context.globalAlpha = band.opacity * strength;
  if (tuning.filled) {
    context.fillStyle = piecePaint(
      frame,
      frame.colours,
      loudest,
      tuning.fillOpacity,
    );
    context.fill(bodies);
    paintTexture(frame, bodies, tuning.fillOpacity * strength);
  } else {
    context.lineWidth = frame.edge.width;
    context.strokeStyle = spectrumInk(frame, bands);
    context.stroke(bodies);
  }
  context.globalAlpha = band.opacity * strength * 0.85;
  context.fillStyle = '#fff';
  context.fill(caps);

  if (!labelled) {
    context.globalAlpha = 1;
    return;
  }
  /**
   * The name under each column and its number over it. Only on the front
   * channel: printed twice for a split they would sit on top of each other,
   * and the legend already says which figure is which.
   */
  const named = bands.length === NAMES.length;
  context.save();
  context.textAlign = 'center';
  const inward = band.flipped ? 1 : -1;
  for (let index = 0; index < bands.length; index += 1) {
    const { left, width } = columnAt(index);
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
  const { tuning, levels, axis, plot, split, deltaMs } = frame;
  const count = Math.max(3, Math.min(24, Math.round(tuning.columns)));
  const edges = count === NAMES.length ? [...EDGES] : spreadEdges(count);
  const span = (plot.right - plot.left) / count;
  const gap = Math.max(4, span * clamp01(tuning.gap));

  if (split) {
    const [leftBands, leftHold, leftMs, rightBands, rightHold, rightMs] =
      scratch(state, count, 6);
    readNamedBands(split[0], axis, edges, leftBands);
    readNamedBands(split[1], axis, edges, rightBands);
    const loudest = Math.max(
      advanceHold(
        leftHold,
        leftMs,
        leftBands,
        deltaMs,
        HOLD_HANG_MS,
        HOLD_FALL,
      ),
      advanceHold(
        rightHold,
        rightMs,
        rightBands,
        deltaMs,
        HOLD_HANG_MS,
        HOLD_FALL,
      ),
    );
    const pair = Math.max(2, (span - gap) / 2 - 1);
    const columnAt = (side: number) => (index: number) => ({
      left: plot.left + index * span + gap / 2 + side * (pair + 2),
      width: pair,
    });
    paintColumns(
      asMate(frame),
      rightBands,
      rightHold,
      columnAt(1),
      loudest,
      0.92,
      false,
    );
    paintColumns(frame, leftBands, leftHold, columnAt(0), loudest, 1, true);
    paintChannelLegend(frame, frame.channelLabels);
    return loudest > STILL_ENOUGH;
  }

  const [bands, hold, holdMs] = scratch(state, count, 3);
  readNamedBands(levels, axis, edges, bands);
  const loudest = advanceHold(
    hold,
    holdMs,
    bands,
    deltaMs,
    HOLD_HANG_MS,
    HOLD_FALL,
  );
  const width = Math.max(2, span - gap);
  paintColumns(
    frame,
    bands,
    hold,
    (index) => ({ left: plot.left + index * span + gap / 2, width }),
    loudest,
    1,
    true,
  );
  return loudest > STILL_ENOUGH;
};

export default drawEnergyView;
