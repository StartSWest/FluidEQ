/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What every flat meter style is drawn with: the input a painter is handed,
 * whole-pixel slots, the bands resampled to a row, smooth curves, and the
 * one line and one tint a style may use (`waveformFlatPaint.ts`).
 */
import type { WaveformStyle } from 'common/waveformStyles';
import type { IFlatMeterState } from './waveformFlatState';

/** Every style but the recorder, which keeps its own pixels (`waveformRecorder.ts`). */
export type TFlatWaveformStyle = Exclude<WaveformStyle, 'recorder'>;

export interface IFlatMeterBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IFlatMeterInput {
  style: TFlatWaveformStyle;
  box: IFlatMeterBox;
  /** Device pixels per CSS pixel. */
  ratio: number;
  /** The waveform, signed, -1..1 at the pane's edge. */
  wave: readonly number[];
  /** The spectrum's bands, 0..1. */
  bands: readonly number[];
  state: IFlatMeterState;
  /** Every body and line: the trace's colours across the pane, or a state's
   * single colour (paused, clipping). */
  ink: string | CanvasGradient;
  /** The pale accent, for what peaks. */
  light: string;
  /** What an unlit cell or a track is painted. */
  unlit: string;
  /**
   * Where the meter itself begins, as a y in the box. The styles with a
   * background grid draw that grid to the box's top, under the label row,
   * and light it only from here down (Ivan, 2026-11-16: "just the bg not the
   * meter"). The box's own top for every other style.
   */
  meterTop: number;
}

export type TPainter = (
  context: CanvasRenderingContext2D,
  input: IFlatMeterInput,
) => void;

/** How much of a body's colour a filled style keeps. */
export const BODY_TINT = 0.16;
/** Amber and red for the top two cells of a loud band (Segments). */
export const WARM = '#ffb35c';
export const HOT = '#ff6b6b';

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Whole device pixels, in CSS units. */
export const snap = (value: number, ratio: number) =>
  Math.round(value * ratio) / ratio;

/**
 * `count` slots on whole device pixels with an even `gap` between each,
 * spanning the box edge to edge (Ivan, 2026-11-16: "all meters need to fill
 * the full width of the container").
 *
 * The row's width rarely divides into whole pixels, and centring a row of
 * equal pieces left up to a pixel per piece at the two ends: 64 device pixels,
 * 32 CSS, on a 2x screen. The pixels left over go one each to pieces spread
 * evenly along the row instead, so a piece is at most one device pixel wider
 * than its neighbour, which no eye can tell, and the row reaches both edges.
 */
export const slots = (
  box: IFlatMeterBox,
  ratio: number,
  count: number,
  gap: number,
) => {
  const deviceGap = Math.max(1, Math.round(gap * ratio));
  const span = Math.max(count, Math.round(box.width * ratio));
  const room = Math.max(count, span - deviceGap * (count - 1));
  const base = Math.floor(room / count);
  const extra = room - base * count;
  const left = Math.round(box.x * ratio);
  const pieces: { x: number; width: number }[] = [];
  let at = left;
  for (let index = 0; index < count; index += 1) {
    const grows =
      Math.floor(((index + 1) * extra) / count) -
      Math.floor((index * extra) / count);
    const width = base + grows;
    pieces.push({ x: at / ratio, width: width / ratio });
    at += width + deviceGap;
  }
  return pieces;
};

/**
 * `count` rows on whole device pixels with an even `gap` between each,
 * spanning the box top to bottom, the bottom row first: a background grid's
 * rows (Ivan, 2026-11-16: "for the bg ones you are still missing bit of the
 * top"). Rows of one fixed pitch stacked up from the floor left whatever
 * part of a pitch the box's height did not divide into, up to a whole row,
 * as an empty band under the label row. The pixels left over go one each to
 * rows spread evenly up the grid instead, as `slots` does across.
 */
export const rowsSpanning = (
  box: IFlatMeterBox,
  ratio: number,
  count: number,
  gap: number,
) =>
  slots({ x: box.y, y: 0, width: box.height, height: 0 }, ratio, count, gap)
    .reverse()
    .map(({ x, width }) => ({ y: x, height: width }));

/**
 * How many rows the grid over the whole box needs so that the bottom
 * `inMeter` of them fit between `meterTop` and the floor: never fewer, so a
 * row is never taller than the meter's own would be and the lit rows never
 * rise above the meter's top.
 */
export const gridRowsFor = (
  box: IFlatMeterBox,
  meterTop: number,
  inMeter: number,
  gap: number,
) => {
  const floor = box.y + box.height;
  const meterPitch = Math.max(1e-6, (floor - meterTop + gap) / inMeter);
  return Math.max(inMeter, Math.ceil((box.height + gap) / meterPitch - 1e-9));
};

/** The bands resampled to `count` pieces, each the loudest band it covers. */
export const resample = (bands: readonly number[], count: number): number[] => {
  if (bands.length === 0) {
    return new Array<number>(count).fill(0);
  }
  if (bands.length === count) {
    return bands.map(clamp01);
  }
  const stride = bands.length / count;
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor(index * stride);
    const end = Math.max(start + 1, Math.floor((index + 1) * stride));
    let loudest = 0;
    for (let band = start; band < end && band < bands.length; band += 1) {
      loudest = Math.max(loudest, bands[band]);
    }
    return clamp01(loudest);
  });
};

/** How many pieces fit across, at about `pitch` CSS pixels each. */
export const countFor = (
  box: IFlatMeterBox,
  pitch: number,
  least: number,
  most: number,
) => Math.max(least, Math.min(most, Math.round(box.width / pitch)));

/** A smooth curve through points (Catmull-Rom as cubic Béziers). */
export const traceCurve = (
  context: CanvasRenderingContext2D,
  points: readonly [number, number][],
  isContinuing = false,
) => {
  if (points.length === 0) {
    return;
  }
  if (isContinuing) {
    context.lineTo(points[0][0], points[0][1]);
  } else {
    context.moveTo(points[0][0], points[0][1]);
  }
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x0, y0] = points[Math.max(0, index - 1)];
    const [x1, y1] = points[index];
    const [x2, y2] = points[index + 1];
    const [x3, y3] = points[Math.min(points.length - 1, index + 2)];
    context.bezierCurveTo(
      x1 + (x2 - x0) / 6,
      y1 + (y2 - y0) / 6,
      x2 - (x3 - x1) / 6,
      y2 - (y3 - y1) / 6,
      x2,
      y2,
    );
  }
};

/** Values spread evenly across the box, as points at `toY` of each value. */
export const across = (
  box: IFlatMeterBox,
  values: readonly number[],
  toY: (value: number, index: number) => number,
): [number, number][] => {
  const last = Math.max(1, values.length - 1);
  return values.map((value, index) => [
    box.x + (index / last) * box.width,
    toY(value, index),
  ]);
};

/** A neighbourhood average, for a silhouette that should not rasp. */
export const soften = (values: readonly number[], reach: number): number[] =>
  values.map((_, index) => {
    let sum = 0;
    let count = 0;
    for (let k = -reach; k <= reach; k += 1) {
      const at = index + k;
      if (at >= 0 && at < values.length) {
        sum += values[at];
        count += 1;
      }
    }
    return sum / count;
  });

export const stroke = (
  context: CanvasRenderingContext2D,
  input: IFlatMeterInput,
  width: number,
  alpha = 1,
) => {
  context.globalAlpha = alpha;
  context.strokeStyle = input.ink;
  context.lineWidth = width;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.stroke();
  context.globalAlpha = 1;
};

export const tint = (
  context: CanvasRenderingContext2D,
  input: IFlatMeterInput,
  alpha = BODY_TINT,
) => {
  context.globalAlpha = alpha;
  context.fillStyle = input.ink;
  context.fill();
  context.globalAlpha = 1;
};

/** The mirrored waveform's two edges, `scale` of the way to the pane's edge. */
export const mirroredEdges = (input: IFlatMeterInput, scale = 0.92) => {
  const { box } = input;
  const centre = box.y + box.height / 2;
  const reach = (box.height / 2) * scale;
  const upper = across(box, input.wave, (value) => centre - value * reach);
  const lower = across(box, input.wave, (value) => centre + value * reach);
  return { upper, lower, centre };
};

/** The bands' silhouette from the floor. */
export const silhouette = (
  input: IFlatMeterInput,
  values: readonly number[],
) => {
  const { box } = input;
  const floor = box.y + box.height;
  return across(box, values, (value) => floor - 1 - value * (box.height - 3));
};
