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
   * How much of a body's colour a filled style keeps: `BODY_TINT` on a dark
   * window, more on a white one (`LIGHT_BODY_TINT`), where 16% of a colour
   * is a ghost.
   */
  body: number;
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
/**
 * The same on a white window (Ivan, 2026-11-18, of the title bar's Fluid
 * on white: "too light, not visible"): the dark window's 16% of a colour
 * over white read as a faint grey wash.
 */
export const LIGHT_BODY_TINT = 0.38;
/** Amber and red for the top two cells of a loud band (Segments). */
export const WARM = '#ffb35c';
export const HOT = '#ff6b6b';

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
/** A signed wave value held to the pane's two edges. */
export const clampSigned = (value: number) => Math.max(-1, Math.min(1, value));

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

/** An LED cell's height, whatever the meter's: 4px, as the 54px bar draws it. */
export const LED_CELL = 4;

/**
 * Rows of LED cells `cell` tall, bottom row first, spanning the box from
 * floor to top: as many as fit, never squeezed to fit a count (Ivan,
 * 2026-11-17: "fix the led ones so they dont compress nor its bg"). A fixed
 * count of rows made every cell a sliver under 3px, and a hairline in the
 * short window's 40px bar. The pixels a whole row would not fill go one each
 * to gaps spread evenly up the column, so the grid still reaches the box's
 * top (2026-11-16: "for the bg ones you are still missing bit of the top")
 * and every cell keeps its height on whole device pixels.
 */
export const ledRows = (
  box: IFlatMeterBox,
  ratio: number,
  cell: number,
  gap: number,
) => {
  const deviceCell = Math.max(1, Math.round(cell * ratio));
  const deviceGap = Math.max(1, Math.round(gap * ratio));
  const span = Math.round(box.height * ratio);
  const count = Math.max(
    1,
    Math.floor((span + deviceGap) / (deviceCell + deviceGap)),
  );
  const gaps = count - 1;
  const spare = Math.max(0, span - count * deviceCell - gaps * deviceGap);
  const rows: { y: number; height: number }[] = [];
  let bottom = Math.round((box.y + box.height) * ratio);
  for (let index = 0; index < count; index += 1) {
    const top = bottom - deviceCell;
    rows.push({ y: top / ratio, height: deviceCell / ratio });
    const grows =
      gaps > 0
        ? Math.floor(((index + 1) * spare) / gaps) -
          Math.floor((index * spare) / gaps)
        : 0;
    bottom = top - deviceGap - grows;
  }
  return rows;
};

/** How many of `rows` (bottom first) stand wholly inside the meter. */
export const rowsInMeter = (rows: readonly { y: number }[], meterTop: number) =>
  Math.max(1, rows.filter(({ y }) => y >= meterTop - 1e-6).length);

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

/**
 * The clear space every drawn edge keeps from the top and the bottom of the
 * box, in CSS pixels, outside its own stroke (Ivan, 2026-11-25: "make sure
 * the waves never touch the top and pass"). The stage clips at the box, so
 * anything drawn past it is cut off flat.
 */
export const EDGE_CLEARANCE = 1;

/**
 * How far from the centre a line `lineWidth` thick may reach in a box `half`
 * its height either side: `scale` of the way, but never so far that the
 * stroke's outer half comes within `EDGE_CLEARANCE` of the edge. At the
 * title bar's 36px the scale is the smaller of the two and nothing moves; in
 * a short or tiny box this is what holds the line inside.
 */
export const reachWithin = (half: number, lineWidth: number, scale = 1) =>
  Math.max(0, Math.min(half * scale, half - lineWidth / 2 - EDGE_CLEARANCE));

/** Where a curve may go: the y of the top and the bottom of its band. */
export interface ICurveBand {
  top: number;
  bottom: number;
}

/**
 * A smooth curve through points (Catmull-Rom as cubic Béziers) that never
 * leaves `band`, the range its points are mapped into.
 *
 * WHY THE WAVE WAS CUT FLAT ON LOUD MUSIC. Catmull-Rom's control points lean
 * a sixth of the neighbours' difference past each point, so two neighbouring
 * points both at the top of the band — a dense loud passage, once the gate
 * has scaled the block's peak to the pane's edge — bowed the curve up to an
 * eighth of the whole band above them, past the top of the stage, which
 * clipped it flat (and the silhouettes' undershoot below the floor the same
 * way). Each point's lean is now held so neither of its control points stands
 * outside the band, so neither does the curve (a Bézier stays inside its
 * control points); a point keeps one tangent on both sides, and wherever the
 * curve stayed inside the band anyway — every quiet passage — it is exactly
 * the curve it was.
 */
export const traceCurve = (
  context: CanvasRenderingContext2D,
  points: readonly [number, number][],
  band: ICurveBand,
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
  const last = points.length - 1;
  // The vertical lean of a point's two control points, one each way.
  const lean = (index: number) => {
    const y = points[index][1];
    const rise =
      (points[Math.min(last, index + 1)][1] -
        points[Math.max(0, index - 1)][1]) /
      6;
    const room = Math.max(0, Math.min(y - band.top, band.bottom - y));
    return Math.max(-room, Math.min(room, rise));
  };
  for (let index = 0; index < last; index += 1) {
    const [x0] = points[Math.max(0, index - 1)];
    const [x1, y1] = points[index];
    const [x2, y2] = points[index + 1];
    const [x3] = points[Math.min(last, index + 2)];
    context.bezierCurveTo(
      x1 + (x2 - x0) / 6,
      y1 + lean(index),
      x2 - (x3 - x1) / 6,
      y2 - lean(index + 1),
      x2,
      y2,
    );
  }
};

/** The band either side of `centre`, `reach` each way. */
export const bandAround = (centre: number, reach: number): ICurveBand => ({
  top: centre - reach,
  bottom: centre + reach,
});

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
  alpha = input.body,
) => {
  context.globalAlpha = alpha;
  context.fillStyle = input.ink;
  context.fill();
  context.globalAlpha = 1;
};

/**
 * The mirrored waveform's two edges, `scale` of the way to the pane's edge,
 * and held inside it with a stroke `lineWidth` thick (`reachWithin`).
 */
export const mirroredEdges = (
  input: IFlatMeterInput,
  lineWidth: number,
  scale = 0.92,
) => {
  const { box } = input;
  const centre = box.y + box.height / 2;
  const reach = reachWithin(box.height / 2, lineWidth, scale);
  const upper = across(
    box,
    input.wave,
    (value) => centre - clampSigned(value) * reach,
  );
  const lower = across(
    box,
    input.wave,
    (value) => centre + clampSigned(value) * reach,
  );
  return { upper, lower, centre, band: bandAround(centre, reach) };
};

/**
 * The bands' silhouette from the floor: a pixel over it at rest, two under
 * the top at full, which holds the 1.5px line `EDGE_CLEARANCE` inside.
 */
export const silhouette = (
  input: IFlatMeterInput,
  values: readonly number[],
) => {
  const { box } = input;
  const rest = box.y + box.height - 1;
  const rise = box.height - 3;
  return {
    points: across(box, values, (value) => rest - clamp01(value) * rise),
    band: { top: rest - rise, bottom: rest },
  };
};
