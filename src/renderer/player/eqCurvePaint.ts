/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IFilter, isBandEnabled } from 'common/constants';
import type { IChartPointData } from '../graph/ChartController';
import { getBandColor } from '../utils/bandColors';
import type { IPlayerCurves } from './usePlayerCurves';

const LOW_HZ = 20;
const HIGH_HZ = 20000;

export interface IEqCurvePaint {
  curves: IPlayerCurves;
  /** The bands with a gain, low to high, for a point each. */
  bands: IFilter[];
  /**
   * Decibels the HEARD curve slides by, on top of what was built into it.
   *
   * The engine's automatic preamp, which moves at display rate and is not in
   * the built curve for that reason (`usePlayerCurves.ts`). The bands' own
   * line never takes it: a preamp is not something a band is doing.
   */
  offsetDb: number;
  isEnabled: boolean;
  /** How many decibels either side of the middle the height spans. */
  rangeDb: number;
  /** The frequency lines and the dashed zero: the screen's, not the scene's. */
  hasGrid: boolean;
  /** In CSS pixels. */
  lineWidth: number;
  pointRadius: number;
}

const xOf = (hz: number, width: number) =>
  (Math.log(hz / LOW_HZ) / Math.log(HIGH_HZ / LOW_HZ)) * width;

/**
 * Where the screen stops being linear and starts compressing, as a fraction
 * of its half-height.
 */
const KNEE = 0.72;

/**
 * Decibels as a fraction of the half-height, with the top and bottom of the
 * screen COMPRESSED RATHER THAN CUT.
 *
 * It used to clamp. Anything past the range came out exactly on the edge, so
 * a boosted band drew a flat plateau along the top of the screen, and two
 * bands over the limit drew one straight line between them with no shape left
 * to read (Ivan, 2026-09-22) — on a screen this small the range is reached
 * easily, and a preamp sliding the whole curve reaches it on purpose.
 *
 * Linear up to the knee, so every ordinary curve is drawn exactly where it
 * was; past it, a tail that approaches the edge without ever arriving. The
 * two meet with the same slope, so there is no visible corner where one
 * becomes the other, and nothing drawn here is ever flat unless it is flat.
 */
const squash = (db: number, rangeDb: number) => {
  const x = db / rangeDb;
  const size = Math.abs(x);
  if (size <= KNEE) {
    return x;
  }
  const over = (size - KNEE) / (1 - KNEE);
  const compressed = KNEE + (1 - KNEE) * (over / (1 + over));
  return x < 0 ? -compressed : compressed;
};

/** A curve's gain at a frequency, between its two nearest points. */
const gainAt = (points: IChartPointData[], hz: number) => {
  if (points.length === 0) {
    return 0;
  }
  let low = 0;
  let high = points.length - 1;
  if (hz <= points[low].x) {
    return points[low].y;
  }
  if (hz >= points[high].x) {
    return points[high].y;
  }
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].x <= hz) {
      low = middle;
    } else {
      high = middle;
    }
  }
  const span = Math.log(points[high].x / points[low].x);
  const k = span === 0 ? 0 : Math.log(hz / points[low].x) / span;
  return points[low].y + (points[high].y - points[low].y) * k;
};

/**
 * The EQ as the player draws it, on the screen and over the visualizer: what
 * is heard in the band colours, the bands alone dashed beneath it where the
 * two differ, the Smart EQ correction in its own colour under both, and a
 * point per band on the bands' own line.
 *
 * The colours are the theme's (`--player-lcd-grid`, `--player-lcd-zero`,
 * `--player-curve-bands`, `--player-curve-smart`, `--player-curve-tint`) — a
 * theme that names a tint draws the curve in it, and one that does not keeps
 * the band colours. The Smart EQ curve keeps the layer's own colour in every
 * theme: it is the colour its chip and its lamp wear, and the one thing this
 * line has to say is which layer it is.
 */
const paintEqCurves = (
  canvas: HTMLCanvasElement,
  {
    curves,
    bands,
    offsetDb,
    isEnabled,
    rangeDb,
    hasGrid,
    lineWidth,
    pointRadius,
  }: IEqCurvePaint,
) => {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const { width, height } = canvas;
  const ratio = window.devicePixelRatio || 1;
  const computed = getComputedStyle(canvas);
  const token = (name: string) => computed.getPropertyValue(name).trim();
  const pad = (pointRadius + 1) * ratio;
  const yOf = (db: number) =>
    height / 2 - squash(db, rangeDb) * (height / 2 - pad);
  context.clearRect(0, 0, width, height);

  if (hasGrid) {
    context.lineWidth = 1;
    context.strokeStyle = token('--player-lcd-grid');
    [100, 1000, 10000].forEach((hz) => {
      const x = Math.round(xOf(hz, width)) + 0.5;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    });
    context.setLineDash([2 * ratio, 3 * ratio]);
    context.strokeStyle = token('--player-lcd-zero');
    context.beginPath();
    context.moveTo(0, Math.round(yOf(0)) + 0.5);
    context.lineTo(width, Math.round(yOf(0)) + 0.5);
    context.stroke();
    context.setLineDash([]);
  }

  const trace = (points: IChartPointData[], slideDb = 0) => {
    context.beginPath();
    points.forEach((point, i) => {
      const x = xOf(point.x, width);
      const y = yOf(point.y + slideDb);
      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
  };
  // The correction's FOOTPRINT, under everything else: the area between the
  // zero line and the Smart EQ curve, tinted in the layer's colour, with a
  // thin edge. An outline alone was tried first and said nothing in the
  // ordinary case — with the bands flat, the heard curve is the correction
  // and sits exactly on top of it, so the line was hidden wherever it
  // mattered. A tint from the zero line stays readable under any curve, and
  // it reads as what the layer is doing to the song: lifted here, eased
  // there, by this much.
  if (curves.smart && isEnabled) {
    const zero = yOf(0);
    const smart = token('--player-curve-smart');
    context.beginPath();
    context.moveTo(xOf(curves.smart[0].x, width), zero);
    curves.smart.forEach((point) => {
      context.lineTo(xOf(point.x, width), yOf(point.y));
    });
    context.lineTo(xOf(curves.smart[curves.smart.length - 1].x, width), zero);
    context.closePath();
    context.fillStyle = smart;
    // Measured on the teal glass: a fifth reads as a faint wash, a quarter
    // as a region with an edge, and the heard curve still sits on top of it.
    context.globalAlpha = 0.26;
    context.fill();
    context.lineWidth = 1 * ratio;
    context.strokeStyle = smart;
    context.globalAlpha = 0.8;
    trace(curves.smart);
    context.stroke();
    context.globalAlpha = 1;
  }
  if (curves.bands && curves.total !== curves.bands) {
    context.setLineDash([3 * ratio, 3 * ratio]);
    context.lineWidth = 1 * ratio;
    context.strokeStyle = token('--player-curve-bands');
    trace(curves.bands);
    context.stroke();
    context.setLineDash([]);
  }
  if (curves.total) {
    const tint = token('--player-curve-tint');
    let stroke: string | CanvasGradient = tint;
    if (!tint) {
      const sweep = context.createLinearGradient(0, 0, width, 0);
      for (let i = 0; i <= 8; i += 1) {
        sweep.addColorStop(i / 8, getBandColor(i / 8).color);
      }
      stroke = sweep;
    }
    context.lineWidth = lineWidth * ratio;
    context.strokeStyle = isEnabled ? stroke : token('--player-lcd-zero');
    context.shadowColor = 'rgba(0, 0, 0, 0.6)';
    context.shadowBlur = 4 * ratio;
    trace(curves.total, offsetDb);
    context.stroke();
    context.shadowBlur = 0;
  }
  const line = curves.bands ?? [];
  // The points wear the same colour the curve does: the band spectrum, or
  // the one colour a tint names — which outside Rainbow mode is the accent.
  const pointTint = token('--player-curve-tint');
  bands.forEach((band, i) => {
    const colour =
      isEnabled && isBandEnabled(band)
        ? pointTint || getBandColor(i / Math.max(1, bands.length - 1)).color
        : token('--player-lcd-zero');
    context.beginPath();
    context.arc(
      xOf(band.frequency, width),
      yOf(gainAt(line, band.frequency)),
      pointRadius * ratio,
      0,
      Math.PI * 2,
    );
    context.fillStyle = colour;
    context.fill();
  });
};

export default paintEqCurves;
