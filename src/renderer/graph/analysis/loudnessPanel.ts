/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  clamp01,
  rampRgba,
  type IAnalysisFrame,
  type IAnalysisReading,
} from './analysisFrame';
import { levelOfDb } from './stereoReading';

/**
 * Where the stereo panel's instruments stand, and how each one is drawn.
 *
 * Its own file because the drawing is four instruments rather than a figure,
 * and a view file that held the geometry, the dial, the scale, the meters and
 * the readouts would be the one file on this page nobody could find anything
 * in.
 *
 * The layout is a meter bridge, not a chart: the dial on the left where the
 * eye lands first, the two bars and their numbers filling the width beside
 * it, the correlation scale under the dial where it is read together with the
 * cloud it describes. The first version put a small dial in the middle of a
 * wide plot with a meter pinned to each far edge, and the sides were empty
 * while nothing was big enough to read (Ivan, 2026-09-23: "make ui better
 * that ui sucks").
 *
 * Every instrument is painted in two halves — its shapes, and its words —
 * because the words are always the page canvas's, while the shapes are the
 * engine's wherever the engine draws the view (`engineLooks/loudnessLook.ts`,
 * which reads its numbers from here).
 */

export const TEXT_INK = 'rgba(255, 255, 255, 0.72)';
export const FAINT_INK = 'rgba(255, 255, 255, 0.26)';
const LABEL_INK = 'rgba(255, 255, 255, 0.92)';

/** The decibel marks the bars are ticked at. */
export const BAR_TICKS = [0, -6, -12, -20, -30, -45, -60] as const;

/** Where the dial's own rings sit, as a share of its radius. */
export const DIAL_RINGS = [0.33, 0.66, 1] as const;

/** The correlation marks along the scale. */
export const SCALE_MARKS = [-1, -0.5, 0, 0.5, 1] as const;

/** The dial's well: from a faint light at the middle to nothing at the rim. */
export const DIAL_WELL: readonly (readonly [at: number, ink: string])[] = [
  [0, 'rgba(255, 255, 255, 0.09)'],
  [0.7, 'rgba(0, 0, 0, 0.26)'],
  [1, 'rgba(0, 0, 0, 0)'],
];
export const DIAL_RING_INK = { ramp: 0.5, alpha: 0.4 } as const;
export const DIAL_ARM_INK = 'rgba(255, 255, 255, 0.4)';
export const DIAL_ARM_DASH: readonly [on: number, off: number] = [3, 4];
export const DIAL_UPRIGHT_INK = 'rgba(255, 255, 255, 0.3)';

/**
 * The trace's three passes, widest first: a glow, a body and a hot core,
 * each's ramp position, alpha and width.
 */
export const TRACE_PASSES: readonly {
  ramp: number;
  alpha: number;
  width: number;
}[] = [
  { ramp: 0.9, alpha: 0.16, width: 7 },
  { ramp: 0.9, alpha: 0.4, width: 2.6 },
  { ramp: 0.3, alpha: 0.95, width: 1 },
];

/**
 * Enough points that a sine draws a clean line, few enough that the path is
 * one object rather than a thousand: about twelve hundred is the knee.
 */
export const TRACE_POINTS = 1200;

export const SCALE_TRACK_INK = 'rgba(255, 255, 255, 0.08)';
export const SCALE_TROUBLE_INK = 'rgba(255, 96, 112, 0.3)';
export const SCALE_BRACKET_INK = 'rgba(255, 255, 255, 0.22)';
export const BAR_TRACK_INK = { alpha: 0.22, ink: 'rgba(255, 255, 255, 0.4)' };
export const BAR_MARK_ALPHA = 0.9;
export const BAR_TICK_ALPHA = 0.8;
export const WIDTH_FILL = { ramp: 0.85, alpha: 0.95 } as const;

export interface IPanel {
  /** The goniometer. */
  dialX: number;
  dialY: number;
  radius: number;
  /** The correlation scale under it. */
  scaleLeft: number;
  scaleWidth: number;
  scaleTop: number;
  scaleHeight: number;
  /** The level bars and the width bar beside the dial. */
  barLeft: number;
  barWidth: number;
  barHeight: number;
  rows: readonly number[];
  /** Room kept at the right of a bar for its number. */
  readoutWidth: number;
}

/** Nothing is drawn in a box too small to hold a legible instrument. */
export const layoutPanel = (
  reading: Pick<IAnalysisReading, 'plot' | 'band'>,
): IPanel | undefined => {
  const { plot, band } = reading;
  const width = plot.right - plot.left;
  const depth = band.bottom - band.top;
  if (width < 260 || depth < 120) {
    return undefined;
  }
  const pad = 18;
  // The dial takes a square of the band's depth, less the room the scale
  // under it needs; the bars take whatever is left across.
  const scaleRoom = 26;
  const radius = Math.min(
    (depth - pad * 2 - scaleRoom) / 2,
    (width - pad * 2) * 0.22,
  );
  const dialX = plot.left + pad + radius;
  const dialY = band.top + pad + radius;
  const barLeft = dialX + radius + pad * 1.6;
  const readoutWidth = 52;
  const barWidth = Math.max(60, plot.right - pad - barLeft - readoutWidth);
  /**
   * The three bars are centred on the dial rather than started at the top of
   * the band: pinned to the top they floated above a wide empty half, and
   * the panel read as two unrelated things rather than as one instrument
   * with its levels beside it.
   */
  const rowGap = Math.min(30, (depth - pad * 2) / 3.4);
  const barHeight = Math.max(9, Math.min(15, rowGap * 0.45));
  const first = dialY - rowGap - barHeight / 2;
  return {
    dialX,
    dialY,
    radius,
    scaleLeft: dialX - radius,
    scaleWidth: radius * 2,
    scaleTop: dialY + radius + 10,
    scaleHeight: 7,
    barLeft,
    barWidth,
    barHeight,
    rows: [first, first + rowGap, first + rowGap * 2.1],
    readoutWidth,
  };
};

/** Where a correlation stands along the scale. */
export const scaleX = (panel: IPanel, value: number): number =>
  panel.scaleLeft + ((value + 1) / 2) * panel.scaleWidth;

/** Where the dial's two channel arms reach, from its middle. */
export const armReach = (panel: IPanel): number => panel.radius * Math.SQRT1_2;

/** The dial's well, its rings and its two channel arms. */
export const paintDial = (frame: IAnalysisFrame, panel: IPanel): void => {
  const { context, colours, band } = frame;
  const { dialX, dialY, radius } = panel;
  context.globalAlpha = band.opacity;

  // A soft well behind the trace, so the dial reads as a recessed instrument
  // rather than as a circle drawn on the graph.
  const well = context.createRadialGradient(
    dialX,
    dialY,
    0,
    dialX,
    dialY,
    radius,
  );
  DIAL_WELL.forEach(([at, ink]) => well.addColorStop(at, ink));
  context.fillStyle = well;
  context.beginPath();
  context.arc(dialX, dialY, radius, 0, Math.PI * 2);
  context.fill();

  const rings = new Path2D();
  DIAL_RINGS.forEach((share) => {
    rings.moveTo(dialX + radius * share, dialY);
    rings.arc(dialX, dialY, radius * share, 0, Math.PI * 2);
  });
  context.strokeStyle = rampRgba(
    colours,
    DIAL_RING_INK.ramp,
    DIAL_RING_INK.alpha,
  );
  context.lineWidth = 1;
  context.stroke(rings);

  /**
   * The two diagonals a goniometer is read against: one channel per arm, at
   * forty-five degrees, with the vertical between them where a centred
   * signal stands. Dashed, because they are a rule rather than a reading and
   * must never be mistaken for the trace.
   */
  const reach = armReach(panel);
  const arms = new Path2D();
  arms.moveTo(dialX - reach, dialY + reach);
  arms.lineTo(dialX + reach, dialY - reach);
  arms.moveTo(dialX + reach, dialY + reach);
  arms.lineTo(dialX - reach, dialY - reach);
  context.setLineDash([...DIAL_ARM_DASH]);
  context.strokeStyle = DIAL_ARM_INK;
  context.stroke(arms);
  context.setLineDash([]);
  const upright = new Path2D();
  upright.moveTo(dialX, dialY - radius);
  upright.lineTo(dialX, dialY + radius);
  context.strokeStyle = DIAL_UPRIGHT_INK;
  context.stroke(upright);
  context.globalAlpha = 1;
};

/** The two channels' letters at the ends of their arms. */
export const paintDialWords = (frame: IAnalysisFrame, panel: IPanel): void => {
  const { context, band, channelLabels } = frame;
  const { dialX, dialY } = panel;
  const reach = armReach(panel);
  context.globalAlpha = band.opacity;
  context.font = '600 10px system-ui, sans-serif';
  context.textBaseline = 'middle';
  context.fillStyle = TEXT_INK;
  context.textAlign = 'right';
  context.fillText(channelLabels[0], dialX - reach - 4, dialY - reach - 2);
  context.textAlign = 'left';
  context.fillText(channelLabels[1], dialX + reach + 4, dialY - reach - 2);
  context.globalAlpha = 1;
};

/**
 * The cloud's points, handed to `at` one after another from the first.
 *
 * SCALED BY ITS OWN PEAK. Drawn at the samples' true amplitude the trace is a
 * speck in the middle of the dial on anything but a full-scale signal — which
 * is every record — and what a goniometer is read for is the SHAPE, not the
 * level: the two meters beside it already say how loud. Every studio one
 * normalises for exactly this reason.
 *
 * With no samples, the straight vertical a single channel genuinely draws
 * here, as tall as `level`.
 */
export const tracePoints = (
  panel: IPanel,
  scope: readonly [Float32Array, Float32Array] | undefined,
  level: number,
  at: (x: number, y: number) => void,
): void => {
  const { dialX, dialY, radius } = panel;
  if (!scope) {
    const up = radius * 0.94 * clamp01(level * 1.6);
    at(dialX, dialY - up);
    at(dialX, dialY + up);
    return;
  }
  const count = Math.min(scope[0].length, scope[1].length);
  let loudest = 0;
  for (let index = 0; index < count; index += 1) {
    const size = Math.abs(scope[0][index]) + Math.abs(scope[1][index]);
    if (size > loudest) {
      loudest = size;
    }
  }
  // A floor, so silence does not magnify its own noise into a full dial.
  const scale = loudest > 0.004 ? (radius * 0.94) / loudest : 0;
  const step = Math.max(1, Math.floor(count / TRACE_POINTS));
  for (let index = 0; index < count; index += step) {
    const l = scope[0][index];
    const r = scope[1][index];
    at(dialX + (l - r) * scale, dialY - (l + r) * scale);
  }
};

/** The cloud, in three passes: a glow, a body and a hot core. */
export const paintTrace = (
  frame: IAnalysisFrame,
  panel: IPanel,
  scope: readonly [Float32Array, Float32Array] | undefined,
  level: number,
): void => {
  const { context, colours, band } = frame;
  const trace = new Path2D();
  let started = false;
  tracePoints(panel, scope, level, (x, y) => {
    if (started) {
      trace.lineTo(x, y);
    } else {
      trace.moveTo(x, y);
      started = true;
    }
  });
  context.lineJoin = 'round';
  context.lineCap = 'round';
  TRACE_PASSES.forEach(({ ramp, alpha, width }) => {
    context.strokeStyle = rampRgba(colours, ramp, 1);
    context.globalAlpha = band.opacity * alpha;
    context.lineWidth = width;
    context.stroke(trace);
  });
  context.globalAlpha = 1;
};

/**
 * The correlation scale: a track whose left half is marked as trouble, a
 * bracket over where the needle has been lately, the needle, and the marks.
 */
export const paintCorrelation = (
  frame: IAnalysisFrame,
  panel: IPanel,
  at: number,
  from: number,
  to: number,
): void => {
  const { context, band } = frame;
  const { scaleLeft, scaleWidth, scaleTop, scaleHeight } = panel;
  context.globalAlpha = band.opacity;
  context.fillStyle = SCALE_TRACK_INK;
  context.beginPath();
  context.roundRect(
    scaleLeft,
    scaleTop,
    scaleWidth,
    scaleHeight,
    scaleHeight / 2,
  );
  context.fill();
  // Left of centre is where a mix cancels on a mono speaker, so it is marked
  // out rather than left to be remembered as a sign.
  context.fillStyle = SCALE_TROUBLE_INK;
  context.beginPath();
  context.roundRect(
    scaleLeft,
    scaleTop,
    scaleX(panel, 0) - scaleLeft,
    scaleHeight,
    scaleHeight / 2,
  );
  context.fill();
  // Where the needle has been lately, so a passage that dipped out of phase
  // leaves something behind to notice.
  context.fillStyle = SCALE_BRACKET_INK;
  context.fillRect(
    scaleX(panel, from),
    scaleTop,
    Math.max(1, scaleX(panel, to) - scaleX(panel, from)),
    scaleHeight,
  );

  context.strokeStyle = FAINT_INK;
  context.lineWidth = 1;
  const marks = new Path2D();
  SCALE_MARKS.forEach((value) => {
    const x = scaleX(panel, value);
    marks.moveTo(x, scaleTop + scaleHeight + 1);
    marks.lineTo(x, scaleTop + scaleHeight + 4);
  });
  context.stroke(marks);

  const needle = scaleX(panel, at);
  context.fillStyle = '#fff';
  context.beginPath();
  context.roundRect(needle - 1.5, scaleTop - 2, 3, scaleHeight + 4, 1.5);
  context.fill();
  context.globalAlpha = 1;
};

/** The scale's numbers, under its ends and its middle. */
export const paintCorrelationWords = (
  frame: IAnalysisFrame,
  panel: IPanel,
): void => {
  const { context, band } = frame;
  const { scaleLeft, scaleWidth, scaleTop, scaleHeight } = panel;
  context.globalAlpha = band.opacity;
  context.font = '600 9px system-ui, sans-serif';
  context.textBaseline = 'top';
  context.fillStyle = TEXT_INK;
  context.textAlign = 'left';
  context.fillText('−1', scaleLeft, scaleTop + scaleHeight + 5);
  context.textAlign = 'center';
  context.fillText('0', scaleX(panel, 0), scaleTop + scaleHeight + 5);
  context.textAlign = 'right';
  context.fillText('+1', scaleLeft + scaleWidth, scaleTop + scaleHeight + 5);
  context.globalAlpha = 1;
};

/** A level bar with its peak mark, ticked with the decibel scale. */
export const paintBar = (
  frame: IAnalysisFrame,
  panel: IPanel,
  row: number,
  level: number,
  mark: number,
  stops: readonly string[],
): void => {
  const { context, band, tuning } = frame;
  const { barLeft, barWidth, barHeight } = panel;
  const top = panel.rows[row];
  context.globalAlpha = band.opacity * BAR_TRACK_INK.alpha;
  context.fillStyle = BAR_TRACK_INK.ink;
  context.beginPath();
  context.roundRect(barLeft, top, barWidth, barHeight, barHeight / 2);
  context.fill();

  const paint = context.createLinearGradient(barLeft, 0, barLeft + barWidth, 0);
  for (let stop = 0; stop <= 8; stop += 1) {
    paint.addColorStop(stop / 8, rampRgba(stops, stop / 8, 1));
  }
  context.globalAlpha = band.opacity * tuning.fillOpacity;
  context.fillStyle = paint;
  context.beginPath();
  context.roundRect(
    barLeft,
    top,
    Math.max(barHeight, barWidth * clamp01(level)),
    barHeight,
    barHeight / 2,
  );
  context.fill();

  if (mark > 0.004) {
    context.globalAlpha = band.opacity * BAR_MARK_ALPHA;
    context.fillStyle = '#fff';
    context.fillRect(barLeft + barWidth * clamp01(mark) - 1, top, 2, barHeight);
  }

  // The scale, ticked under the bar so the two rows share one ruler.
  context.globalAlpha = band.opacity * BAR_TICK_ALPHA;
  context.strokeStyle = FAINT_INK;
  const ticks = new Path2D();
  BAR_TICKS.forEach((db) => {
    const x = barLeft + barWidth * levelOfDb(db);
    ticks.moveTo(x, top + barHeight + 1);
    ticks.lineTo(x, top + barHeight + 3);
  });
  context.lineWidth = 1;
  context.stroke(ticks);
  context.globalAlpha = 1;
};

/** A bar's letter, and its number in decibels in the room kept for it. */
export const paintBarWords = (
  frame: IAnalysisFrame,
  panel: IPanel,
  row: number,
  label: string,
  mark: number,
): void => {
  const { context, band } = frame;
  const { barLeft, barWidth, barHeight } = panel;
  const top = panel.rows[row];
  context.globalAlpha = band.opacity;
  context.font = '700 10px system-ui, sans-serif';
  context.textBaseline = 'middle';
  context.textAlign = 'right';
  context.fillStyle = LABEL_INK;
  context.fillText(label, barLeft - 7, top + barHeight / 2);
  // The number: the reading somebody writes down.
  context.globalAlpha = band.opacity * BAR_TICK_ALPHA;
  context.font = '600 11px system-ui, sans-serif';
  context.textAlign = 'left';
  context.fillStyle = TEXT_INK;
  const db = mark <= 0 ? -Infinity : (mark - 1) * 80;
  context.fillText(
    Number.isFinite(db) ? `${db.toFixed(1)} dB` : '— dB',
    barLeft + barWidth + 8,
    top + barHeight / 2,
  );
  context.globalAlpha = 1;
};

/** The width bar: how much of the sound is in the difference. */
export const paintWidth = (
  frame: IAnalysisFrame,
  panel: IPanel,
  width: number,
): void => {
  const { context, band, colours } = frame;
  const { barLeft, barWidth, barHeight } = panel;
  const top = panel.rows[2];
  context.globalAlpha = band.opacity * BAR_TRACK_INK.alpha;
  context.fillStyle = BAR_TRACK_INK.ink;
  context.beginPath();
  context.roundRect(barLeft, top, barWidth, barHeight * 0.6, barHeight * 0.3);
  context.fill();
  context.globalAlpha = band.opacity * WIDTH_FILL.alpha;
  context.fillStyle = rampRgba(colours, WIDTH_FILL.ramp, 1);
  context.beginPath();
  context.roundRect(
    barLeft,
    top,
    Math.max(barHeight * 0.6, barWidth * clamp01(width)),
    barHeight * 0.6,
    barHeight * 0.3,
  );
  context.fill();
  context.globalAlpha = 1;
};

/** The width bar's symbol and its share written out. */
export const paintWidthWords = (
  frame: IAnalysisFrame,
  panel: IPanel,
  label: string,
  width: number,
): void => {
  const { context, band } = frame;
  const { barLeft, barWidth, barHeight } = panel;
  const top = panel.rows[2];
  context.globalAlpha = band.opacity;
  context.font = '700 10px system-ui, sans-serif';
  context.textBaseline = 'middle';
  context.textAlign = 'right';
  context.fillStyle = LABEL_INK;
  context.fillText(label, barLeft - 7, top + barHeight / 2);
  context.globalAlpha = band.opacity * WIDTH_FILL.alpha;
  context.font = '600 11px system-ui, sans-serif';
  context.textAlign = 'left';
  context.fillStyle = TEXT_INK;
  context.fillText(
    `${Math.round(clamp01(width) * 100)}%`,
    barLeft + barWidth + 8,
    top + barHeight * 0.3,
  );
  context.globalAlpha = 1;
};
