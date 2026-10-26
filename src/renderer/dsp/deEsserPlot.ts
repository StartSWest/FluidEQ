/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TDeEsserMode } from '../../common/dsp/deEsser';
import { sampleCutCurve } from './deEsserCurve';

/**
 * The De-esser's two pictures, drawn onto one canvas: what it did over the
 * last four seconds, and the treble as it is now. Pure drawing — the card's
 * graph owns the history and the loop, and hands this the box to draw in.
 */

/** Where each picture stands inside the canvas, in CSS pixels. */
export interface IPlotBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The inks, as `r, g, b` for the canvas to add its alpha to. */
export interface IDeEsserInks {
  voice: string;
  notVoice: string;
  cut: string;
  /** A CSS colour: the page's faint text, which the axes are written in. */
  text: string;
}

/** What the history strip holds, oldest first through `at`. */
export interface IHistory {
  /** How far the loudest band stood over where it starts, dB; NaN for none. */
  standout: Float32Array;
  /** The deepest cut, dB, never positive. */
  cut: Float32Array;
  /** 1 where the stage took the sound for a voice. */
  voice: Uint8Array;
  /** 1 where the stage was running. */
  live: Uint8Array;
  /** Ring index to display order. */
  at: (index: number) => number;
}

/** The treble now, band by band, as the engine reported it and held. */
export interface ITrebleNow {
  hz: readonly number[];
  levelDb: readonly number[];
  thresholdDb: readonly number[];
  cutDb: readonly number[];
  /** Where the deepest cut was, Hz; 0 with none. */
  sHz: number;
  /** How visible the S line is, 0 to 1: it fades rather than switches. */
  sAlpha: number;
}

export const GRAPH_FONT =
  '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Ubuntu, Cantarell, "Noto Sans", "DejaVu Sans", sans-serif';

/**
 * The strip's two lanes. The standout lane spans 18 dB either side of where
 * the stage starts, which is the deepest it may cut: a sound standing that
 * far over its threshold is cut by all of it.
 */
const STANDOUT_SPAN_DB = 18;
const CUT_SHARE = 0.34;
const LANE_GAP = 10;

/** The treble picture's axes: 2 to 20 kHz, and band levels in dBFS. */
const TREBLE_LOW_HZ = 2000;
const TREBLE_HIGH_HZ = 20000;
const LEVEL_TOP_DB = -6;
const LEVEL_BOTTOM_DB = -90;
const FREQUENCY_GRID = [3000, 5000, 10000, 15000];

const line = (
  context: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) => {
  context.beginPath();
  context.moveTo(x0, y0);
  context.lineTo(x1, y1);
  context.stroke();
};

/**
 * The last four seconds: how far the treble stood over where the stage
 * starts, below, and the cut it got, hanging above it.
 *
 * Teal is a sound taken for a voice and grey one that was not; the cut is
 * amber, the rack's colour for something being taken away. A hi-hat passes
 * as a grey column with nothing hanging over it, which is the whole claim the
 * stage makes. Under Isolate only the cut is drawn, rising from the floor:
 * that is all the listener hears.
 */
export const drawHistory = (
  context: CanvasRenderingContext2D,
  box: IPlotBox,
  history: IHistory,
  columns: number,
  /** 0 to 1: how far into the next column time has gone. */
  phase: number,
  spanDb: number,
  isolate: boolean,
  inks: IDeEsserInks,
  nowLabel: string,
) => {
  const { x, y, width, height } = box;
  const lanes = Math.max(1, height - LANE_GAP - 16);
  const cutHeight = isolate ? lanes : lanes * CUT_SHARE;
  const standoutTop = y + cutHeight + LANE_GAP;
  const standoutHeight = Math.max(1, lanes - cutHeight - LANE_GAP);
  const thresholdY = standoutTop + standoutHeight / 2;
  const columnWidth = width / columns;
  const standoutY = (db: number) =>
    thresholdY -
    (Math.max(-STANDOUT_SPAN_DB, Math.min(STANDOUT_SPAN_DB, db)) /
      STANDOUT_SPAN_DB) *
      (standoutHeight / 2);

  context.font = GRAPH_FONT;
  context.textBaseline = 'middle';
  context.lineWidth = 1;

  // The cut lane's floor and its deepest figure, which is the dial's.
  context.strokeStyle = 'rgba(255,255,255,0.14)';
  const cutBase = isolate ? y + lanes : y;
  line(
    context,
    x,
    Math.round(cutBase) + 0.5,
    x + width,
    Math.round(cutBase) + 0.5,
  );
  context.strokeStyle = 'rgba(255,255,255,0.05)';
  const cutFloor = isolate ? y : y + cutHeight;
  line(
    context,
    x,
    Math.round(cutFloor) + 0.5,
    x + width,
    Math.round(cutFloor) + 0.5,
  );
  context.fillStyle = inks.text;
  context.textAlign = 'left';
  context.fillText(
    `−${spanDb.toFixed(0)} dB`,
    x + 4,
    isolate ? y + 8 : y + cutHeight - 8,
  );

  if (!isolate) {
    // Where the stage starts: the line every column is read against.
    context.setLineDash([3, 3]);
    context.strokeStyle = 'rgba(255,255,255,0.32)';
    line(
      context,
      x,
      Math.round(thresholdY) + 0.5,
      x + width,
      Math.round(thresholdY) + 0.5,
    );
    context.setLineDash([]);
  }

  // The columns slide left by the part of a column that has gone by, inside
  // the strip's own box, so the oldest leaves at the edge rather than over it.
  context.save();
  context.beginPath();
  context.rect(x, y, width, lanes);
  context.clip();
  for (let index = 0; index < columns; index += 1) {
    const slot = history.at(index);
    if (history.live[slot] === 1) {
      const left = x + (index - phase) * columnWidth;
      const drawn = Math.max(1, columnWidth - 1);
      const cut = Math.min(spanDb, -history.cut[slot]);
      const standout = history.standout[slot];
      if (
        !isolate &&
        Number.isFinite(standout) &&
        standout > -STANDOUT_SPAN_DB
      ) {
        const top = standoutY(standout);
        const isVoice = history.voice[slot] === 1;
        const ink = isVoice ? inks.voice : inks.notVoice;
        // Under the line it is only the treble going by; over it, the part
        // the stage could cut, drawn brighter so the eye finds it.
        const bottom = standoutTop + standoutHeight;
        context.fillStyle = `rgba(${ink},0.22)`;
        context.fillRect(
          left,
          Math.max(top, thresholdY),
          drawn,
          bottom - Math.max(top, thresholdY),
        );
        if (top < thresholdY) {
          context.fillStyle = `rgba(${ink},${isVoice ? 0.9 : 0.6})`;
          context.fillRect(left, top, drawn, thresholdY - top);
        }
      }
      if (cut > 0.05) {
        const extent = (cut / spanDb) * cutHeight;
        context.fillStyle = `rgba(${inks.cut},0.88)`;
        context.fillRect(
          left,
          isolate ? cutBase - extent : cutBase,
          drawn,
          extent,
        );
      }
    }
  }
  context.restore();

  // Seconds under the strip, the newest at the right where the eye already is.
  context.fillStyle = inks.text;
  context.textAlign = 'center';
  const labelY = y + height - 6;
  for (let second = 1; second <= 3; second += 1) {
    const at = x + width * (1 - second / 4);
    context.strokeStyle = 'rgba(255,255,255,0.05)';
    line(context, Math.round(at) + 0.5, y, Math.round(at) + 0.5, y + lanes);
    context.fillText(`-${second}s`, at, labelY);
  }
  context.textAlign = 'right';
  context.fillText(nowLabel, x + width, labelY);
};

const xOf = (box: IPlotBox, hz: number) =>
  box.x +
  (Math.log(hz / TREBLE_LOW_HZ) / Math.log(TREBLE_HIGH_HZ / TREBLE_LOW_HZ)) *
    box.width;

/** A range edge in kilohertz, as its dial reads it. */
const formatEdge = (hz: number) => `${(hz / 1000).toFixed(1)}k`;

/**
 * The treble now, 2 to 20 kHz: the range it listens to, each band's level
 * against where the stage starts on it, and the cut hanging from the top.
 */
/**
 * How much of the treble picture is lit for the control being turned, 0 to
 * 1 each, moving as the lens fades: the range's edges for From and To, the
 * bands' threshold marks for Sensitivity.
 */
export interface ITrebleEmphasis {
  range: number;
  thresholds: number;
}

export const drawTreble = (
  context: CanvasRenderingContext2D,
  box: IPlotBox,
  treble: ITrebleNow,
  lowHz: number,
  highHz: number,
  mode: TDeEsserMode,
  spanDb: number,
  inks: IDeEsserInks,
  emphasis: ITrebleEmphasis,
) => {
  const { x, y, width, height } = box;
  const plotBottom = y + height - 16;
  const cutHeight = (height - 16) * 0.3;
  const steps = Math.max(24, Math.round(width / 4));
  const curve = sampleCutCurve(
    treble,
    mode,
    lowHz,
    TREBLE_LOW_HZ,
    TREBLE_HIGH_HZ,
    steps,
    spanDb,
  );
  // Leave room for the stroke at either extreme of the fitted response.
  const cutY = (db: number) => y + 2 + (db / curve.bottomDb) * (cutHeight - 4);
  const baseline = cutY(0);
  const levelTop = y + cutHeight + 8;
  const levelY = (db: number) =>
    levelTop +
    ((LEVEL_TOP_DB - Math.max(LEVEL_BOTTOM_DB, Math.min(LEVEL_TOP_DB, db))) /
      (LEVEL_TOP_DB - LEVEL_BOTTOM_DB)) *
      (plotBottom - levelTop);

  // Everything inside the picture's own box. A band is a third of an octave
  // wide around its centre, so the lowest band of a range that starts at
  // 2 kHz reaches under the axis's first frequency, and its bar was drawn
  // over the strip beside it.
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();

  context.font = GRAPH_FONT;
  context.textBaseline = 'middle';
  context.lineWidth = 1;

  // Kilohertz under the plot, on lines up it.
  context.textAlign = 'center';
  FREQUENCY_GRID.forEach((hz) => {
    const at = Math.round(xOf(box, hz)) + 0.5;
    context.strokeStyle = 'rgba(255,255,255,0.05)';
    line(context, at, y, at, plotBottom);
    context.fillStyle = inks.text;
    context.fillText(`${hz / 1000}k`, at, y + height - 6);
  });

  // The range it listens to, shaded, its edges dashed — and lit, solid and
  // named in kilohertz while From or To is being turned.
  const from = xOf(box, lowHz);
  const to = xOf(box, highHz);
  const lit = emphasis.range;
  context.fillStyle = `rgba(${inks.voice},${(0.07 + 0.09 * lit).toFixed(3)})`;
  context.fillRect(from, y, to - from, plotBottom - y);
  context.setLineDash(lit > 0.5 ? [] : [3, 3]);
  context.strokeStyle = `rgba(${inks.voice},${(0.55 + 0.45 * lit).toFixed(3)})`;
  context.lineWidth = 1 + lit;
  if (lit > 0) {
    context.shadowColor = `rgba(${inks.voice},${(0.6 * lit).toFixed(3)})`;
    context.shadowBlur = 10 * lit;
  }
  line(context, Math.round(from) + 0.5, y, Math.round(from) + 0.5, plotBottom);
  line(context, Math.round(to) + 0.5, y, Math.round(to) + 0.5, plotBottom);
  context.shadowColor = 'transparent';
  context.shadowBlur = 0;
  context.lineWidth = 1;
  context.setLineDash([]);
  if (lit > 0.01) {
    context.fillStyle = `rgba(${inks.voice},${lit.toFixed(3)})`;
    context.textAlign = 'right';
    context.fillText(formatEdge(lowHz), from - 5, y + (plotBottom - y) * 0.5);
    context.textAlign = 'left';
    context.fillText(formatEdge(highHz), to + 5, y + (plotBottom - y) * 0.5);
  }

  const { hz: centres, levelDb, thresholdDb } = treble;
  if (centres.length > 0) {
    // Each band's level, as a bar a band wide.
    const halfBand = 2 ** (1 / 6);
    centres.forEach((centre, band) => {
      const left = xOf(box, centre / halfBand) + 1;
      const right = xOf(box, centre * halfBand) - 1;
      const level = levelDb[band] ?? LEVEL_BOTTOM_DB;
      const threshold = thresholdDb[band] ?? LEVEL_TOP_DB;
      const top = levelY(level);
      context.fillStyle = `rgba(${inks.voice},0.28)`;
      context.fillRect(left, top, right - left, plotBottom - top);
      if (level > threshold) {
        context.fillStyle = `rgba(${inks.voice},0.85)`;
        context.fillRect(left, top, right - left, levelY(threshold) - top);
      }
      // Where the stage starts on this band, brighter while Sensitivity is
      // the dial being turned.
      const marked = emphasis.thresholds;
      context.strokeStyle = `rgba(255,255,255,${(0.55 + 0.45 * marked).toFixed(3)})`;
      context.lineWidth = 1 + marked;
      const mark = Math.round(levelY(threshold)) + 0.5;
      line(context, left, mark, right, mark);
      context.lineWidth = 1;
    });
  }

  // The cut, hanging from zero, with room for the whole response.
  context.strokeStyle = 'rgba(255,255,255,0.14)';
  line(
    context,
    x,
    Math.round(baseline) + 0.5,
    x + width,
    Math.round(baseline) + 0.5,
  );
  const traceCut = () => {
    context.beginPath();
    curve.points.forEach((db, step) => {
      const at = cutY(db);
      const left = x + (step / steps) * width;
      if (step === 0) {
        context.moveTo(left, at);
      } else {
        context.lineTo(left, at);
      }
    });
  };
  traceCut();
  context.lineTo(x + width, baseline);
  context.lineTo(x, baseline);
  context.closePath();
  context.fillStyle = `rgba(${inks.cut},0.22)`;
  context.fill();
  traceCut();
  context.strokeStyle = `rgba(${inks.cut},0.95)`;
  context.lineWidth = 1.6;
  context.stroke();
  context.lineWidth = 1;

  // Where the S was, while it is being cut.
  // Not snapped to a pixel: it slides, and a line snapped to whole pixels
  // slides in steps.
  if (treble.sHz > 0 && treble.sAlpha > 0.01 && mode !== 'whole') {
    const at = xOf(box, treble.sHz);
    context.strokeStyle = `rgba(${inks.voice},${(0.9 * treble.sAlpha).toFixed(3)})`;
    context.lineWidth = 1.5;
    line(context, at, y + 2, at, plotBottom);
    context.lineWidth = 1;
  }
  context.restore();
};
