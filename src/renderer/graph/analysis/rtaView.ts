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
  rampRgba,
  scratch,
  type IAnalysisFrame,
  type IAnalysisState,
} from './analysisFrame';
import { asMate, paintLegend } from './channelInk';
import { paintTexture, piecePaint, spectrumInk } from './spectrumPaint';

/**
 * The real-time analyser: one bar per fractional-octave band, with a cap.
 *
 * The bands are equal slices of the plot's LOG axis, which is what makes them
 * fractional octaves — thirty-four of them across the plot's eleven and a
 * third octaves is the standard third-octave set, and Pieces walks it from
 * whole octaves up to twelfth-octave without another control.
 *
 * Each band's reading is the POWER mean of the points inside it, never the
 * loudest of them. A band is a share of the energy, and taking its peak would
 * report a narrow tone as if it filled the whole band — which on a display
 * people set room curves by is a lie with consequences.
 *
 * The cap is the part that makes it an RTA rather than a bar chart: it jumps
 * to every peak, hangs, and then falls at a steady rate, so the eye can read
 * a passage's shape from one glance a second after it happened.
 *
 * With Left & right chosen every band becomes a PAIR of half-width bars
 * standing side by side, left then right, each with its own cap — which is
 * how a stereo RTA is drawn and the only arrangement in which a band that is
 * louder on one side can be seen at a glance.
 */

const HOLD_HANG_MS = 1100;

/** Plot depths per second: about six decibels, the rate an RTA cap falls. */
const HOLD_FALL = 0.075;

/** How tall a cap is drawn, in pixels. */
const CAP_HEIGHT = 2.5;

/** How far above its band a cap floats, in pixels. */
const CAP_LIFT = 3;

/**
 * Each band's reading, as the power mean of the points it covers.
 *
 * The readings are a fraction of the plot's depth, so they come back to
 * decibels first (that is what `ANALYSIS_RANGE_DB` is for), are summed as
 * power, and go back to the fraction — averaging the fractions directly is
 * averaging decibels, which reports a band holding one loud tone and three
 * silent points as if it were a quarter as loud as it is.
 */
const readBands = (
  levels: Float64Array,
  bands: Float64Array,
  points: number,
): void => {
  const count = bands.length;
  for (let band = 0; band < count; band += 1) {
    const from = Math.floor((band * points) / count);
    const to = Math.max(from + 1, Math.floor(((band + 1) * points) / count));
    let power = 0;
    for (let index = from; index < to; index += 1) {
      const level = levels[index];
      power += level <= 0 ? 0 : 10 ** (((level - 1) * ANALYSIS_RANGE_DB) / 10);
    }
    const mean = power / (to - from);
    bands[band] =
      mean <= 0 ? 0 : clamp01(1 + Math.log10(mean) / (ANALYSIS_RANGE_DB / 10));
  }
};

interface IColumn {
  /** Where this bar starts and how wide it is, in CSS pixels. */
  left: number;
  width: number;
}

/** One channel's row of bars and caps, as two paths. */
const buildRow = (
  frame: IAnalysisFrame,
  bands: Float64Array,
  hold: Float64Array,
  columnAt: (index: number) => IColumn,
): { bodies: Path2D; caps: Path2D } => {
  const { band } = frame;
  const foot = band.flipped ? band.top : band.bottom;
  const bodies = new Path2D();
  const caps = new Path2D();
  for (let index = 0; index < bands.length; index += 1) {
    const { left, width } = columnAt(index);
    const head = placeLevel(band, bands[index]);
    if (Math.abs(head - foot) > 0.5) {
      bodies.rect(left, Math.min(head, foot), width, Math.abs(head - foot));
    }
    const mark = hold[index];
    if (mark > 0.004) {
      const row = placeLevel(band, mark);
      caps.rect(
        left,
        band.flipped ? row + CAP_LIFT : row - CAP_LIFT - CAP_HEIGHT,
        width,
        CAP_HEIGHT,
      );
    }
  }
  return { bodies, caps };
};

/** Paint one channel's row in its own colours. */
const paintRow = (
  frame: IAnalysisFrame,
  row: { bodies: Path2D; caps: Path2D },
  bands: Float64Array,
  loudest: number,
  strength: number,
): void => {
  const { context, tuning, band } = frame;
  context.globalAlpha = band.opacity * strength;
  if (tuning.filled) {
    /**
     * One gradient for the whole row rather than one per bar: the ramps this
     * graph offers run along the plot's own axes (position across it, level
     * up it), so a per-bar gradient would restart the ramp inside every bar
     * and the row would read as thirty-four copies of the same colour.
     */
    context.fillStyle = piecePaint(
      frame,
      frame.colours,
      loudest,
      tuning.fillOpacity,
    );
    context.fill(row.bodies);
    paintTexture(frame, row.bodies, tuning.fillOpacity * strength);
  } else {
    context.lineWidth = frame.edge.width;
    context.strokeStyle = spectrumInk(frame, bands);
    context.stroke(row.bodies);
  }

  // The caps in white rather than the look's colour, because their job is to
  // be found and nothing else on the plot is white.
  context.globalAlpha = band.opacity * strength * 0.78;
  context.fillStyle = '#fff';
  context.fill(row.caps);
  context.globalAlpha = 1;
};

const drawRtaView = (frame: IAnalysisFrame, state: IAnalysisState): boolean => {
  const { tuning, levels, plot, split, deltaMs } = frame;
  const count = Math.max(4, Math.min(160, Math.round(tuning.columns)));
  const span = (plot.right - plot.left) / count;
  const gap = span * clamp01(tuning.gap);

  if (split) {
    const [leftBands, leftHold, leftMs, rightBands, rightHold, rightMs] =
      scratch(state, count, 6);
    readBands(split[0], leftBands, split[0].length);
    readBands(split[1], rightBands, split[1].length);
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
    // Two half-width bars per band with a hairline between them: narrower
    // than a single bar, and still the same total width, so turning Pieces
    // or Gap moves the pair exactly as it moves one.
    const pair = Math.max(1, (span - gap) / 2 - 0.5);
    const columnAt = (side: number) => (index: number) => ({
      left: plot.left + index * span + gap / 2 + side * (pair + 1),
      width: pair,
    });
    paintRow(
      asMate(frame),
      buildRow(frame, rightBands, rightHold, columnAt(1)),
      rightBands,
      loudest,
      0.92,
    );
    paintRow(
      frame,
      buildRow(frame, leftBands, leftHold, columnAt(0)),
      leftBands,
      loudest,
      1,
    );
    return loudest > STILL_ENOUGH;
  }

  const [bands, hold, holdMs] = scratch(state, count, 3);
  readBands(levels, bands, levels.length);
  const loudest = advanceHold(
    hold,
    holdMs,
    bands,
    deltaMs,
    HOLD_HANG_MS,
    HOLD_FALL,
  );
  const width = Math.max(1, span - gap);
  paintRow(
    frame,
    buildRow(frame, bands, hold, (index) => ({
      left: plot.left + index * span + gap / 2,
      width,
    })),
    bands,
    loudest,
    1,
  );
  paintLegend(frame, [
    { label: frame.legend.live, ink: rampRgba(frame.colours, 0.75, 1) },
    { label: frame.legend.peak, ink: 'rgba(255, 255, 255, 0.95)' },
  ]);
  return loudest > STILL_ENOUGH;
};

export default drawRtaView;
