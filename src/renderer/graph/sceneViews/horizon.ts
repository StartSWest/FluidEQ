/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand, IAnalysisPlot } from '../analysis/analysisFrame';
import {
  figureInk,
  heatInk,
  heatStep,
  inkAt,
  lightInkAt,
  type ISceneDrawn,
  type ISceneFrame,
  type ISceneMusic,
  type ISceneSpan,
  type ISceneStand,
} from './sceneFrame';
import {
  createPeakHold,
  createPieceRow,
  holdPeaks,
  layPieces,
  type IPeakHold,
  type IPieceRow,
} from './scenePieces';
import {
  beginBloom,
  createSceneBloom,
  endBloom,
  type ISceneBloom,
} from './sceneBloom';

/**
 * HORIZON: the spectrum standing on a line of light, a sun low behind it and
 * its reflection in the water below.
 *
 * Every bar runs through the colours from its foot to its head, whatever its
 * height, so a short bar is as much of the palette as a tall one; the
 * horizon is a bright line under the row that flashes on the beat, the
 * reflection hangs under it and fades into the dark, and behind the bars a
 * glow in the last of the colours breathes with the bass and swells on the
 * kick, drifting slowly with the music. Ivan asked for it from a picture he
 * loved (2026-09-26: "make one like this one loved it").
 *
 * Pieces is how many bars and Gap the dark between them; Colour by runs the
 * colours up every bar, across the row, as one colour, or each bar whole by
 * its loudness; Outline draws the bars as frames at the line width; Opacity
 * is how solid they are; Lit peaks holds a line over each bar; Glow is how
 * much light they throw.
 */

/**
 * A bar never on a pitch smaller than this, in CSS pixels. Exported with the
 * numbers and functions below for the look's GPU painting
 * (`engineLooks/horizonLook.ts`).
 */
export const MIN_PITCH = 5;
/** The horizon stands this far up the band; the reflection fills below it. */
const FLOOR_SHARE = 0.2;
/** How long a reflection is against the bar that casts it. */
export const MIRROR = 0.42;
/** A bar at rest is still this tall, a row of stubs along the horizon. */
export const REST_HEIGHT = 2;
/** Where the glow sits above the horizon, and its size, against the reach. */
const SUN_HEIGHT = 0.74;
export const SUN_WIDE = 0.62;
const SUN_TALL = 0.46;
/** Where on the colours the sun is. */
export const SUN_INK = 0.84;
/** Stops sampled up a bar: enough for seven colours to read as a sweep. */
const BAR_STOPS = 5;

export interface IHorizonState {
  row: IPieceRow;
  peaks: IPeakHold;
  bloom: ISceneBloom;
}

export const createHorizonState = (): IHorizonState => ({
  row: createPieceRow(),
  peaks: createPeakHold(),
  bloom: createSceneBloom(),
});

/** The colours from a bar's foot to its head, in this bar's own height. */
const barRamp = (
  context: CanvasRenderingContext2D,
  colours: readonly string[],
  foot: number,
  head: number,
  alpha: number,
  fadeTo = alpha,
): CanvasGradient => {
  const ramp = context.createLinearGradient(0, foot, 0, head);
  for (let stop = 0; stop < BAR_STOPS; stop += 1) {
    const position = stop / (BAR_STOPS - 1);
    ramp.addColorStop(
      position,
      inkAt(colours, position, alpha + (fadeTo - alpha) * position),
    );
  }
  return ramp;
};

/** Where one copy's row stands: its horizon clear of the reflection. */
export const horizonStand = (band: IAnalysisBand): ISceneStand => {
  const depth = band.bottom - band.top;
  return {
    floor: band.flipped
      ? band.top + depth * FLOOR_SHARE
      : band.bottom - depth * FLOOR_SHARE,
    up: band.flipped ? 1 : -1,
    reach: depth * (1 - FLOOR_SHARE) - 4,
  };
};

/**
 * The sun low behind a copy's row: where it is, how tall and wide, and how
 * bright — breathing with the bass, swelling on the kick and wandering a
 * little with the music.
 */
export const horizonSun = (
  plot: IAnalysisPlot,
  stand: ISceneStand,
  music: Pick<ISceneMusic, 'clock' | 'bass' | 'pulse'>,
  opacity: number,
) => {
  const width = plot.right - plot.left;
  return {
    x: plot.left + width * (0.5 + Math.sin(music.clock * 0.11) * 0.06),
    y: stand.floor + stand.up * stand.reach * SUN_HEIGHT,
    tall: stand.reach * SUN_TALL * (1 + music.bass * 0.12 + music.pulse * 0.08),
    wide: stand.reach * SUN_WIDE,
    strength: clampAlpha(
      (0.34 + music.bass * 0.26 + music.pulse * 0.22) * opacity,
    ),
  };
};

/** The horizon line's light, and its haze's, flashing on the beat. */
export const horizonLine = (pulse: number) => ({
  line: clampAlpha(0.7 + pulse * 0.3),
  haze: 0.22 + pulse * 0.2,
});

/** The row's bloom for a frame. */
export const horizonBloom = (pulse: number, glow: number, opacity: number) =>
  (0.4 + pulse * 0.3 + glow * 0.5) * opacity;

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: IHorizonState,
  bloom: CanvasRenderingContext2D | null,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, music, look } = frame;
  const { row } = state;
  const stand = horizonStand(band);
  const { floor, up, reach } = stand;
  const width = plot.right - plot.left;
  const span: ISceneSpan = {
    left: plot.left,
    right: plot.right,
    floor,
    head: floor + up * reach,
  };

  // The sun, low behind the row: the last of the colours, breathing with
  // the bass, swelling on the kick and wandering a little with the music.
  const sunGlow = horizonSun(plot, stand, music, look.opacity);
  const { tall, strength } = sunGlow;
  context.save();
  // Added as light, so it glows through the dark rather than staining it.
  context.globalCompositeOperation = 'lighter';
  context.translate(sunGlow.x, sunGlow.y);
  context.scale(sunGlow.wide / tall, 1);
  const sun = context.createRadialGradient(0, 0, 0, 0, 0, tall);
  // Near the end of the colours rather than at it: the last stop of a
  // rainbow is often its palest, and a pale glow over the dark reads as dust.
  sun.addColorStop(0, lightInkAt(colours, SUN_INK, 0.1, strength));
  sun.addColorStop(0.45, inkAt(colours, SUN_INK, strength * 0.6));
  sun.addColorStop(1, inkAt(colours, SUN_INK, 0));
  context.fillStyle = sun;
  context.fillRect(-tall, -tall, tall * 2, tall * 2);
  context.restore();

  const barWidth = row.body;
  const bars = new Path2D();
  const tops = new Path2D();
  const held = new Path2D();
  const heights = new Float64Array(row.count);
  for (let piece = 0; piece < row.count; piece += 1) {
    const height = Math.max(REST_HEIGHT, row.levels[piece] * reach);
    heights[piece] = height;
    const left = row.lefts[piece];
    const top = up < 0 ? floor - height : floor;
    bars.rect(left, top, barWidth, height);
    tops.rect(
      left,
      up < 0 ? floor - height : floor + height - 1.5,
      barWidth,
      Math.min(1.5, height),
    );
    const heldHeight = state.peaks.held[piece] * reach;
    if (look.accents && heldHeight - height > 3) {
      held.rect(left, floor + up * (heldHeight + 3) - 0.75, barWidth, 1.5);
    }
  }

  // The reflection, under the horizon, each bar in its own colours running
  // away from the line and fading into the dark.
  context.save();
  for (let piece = 0; piece < row.count; piece += 1) {
    const shown = heights[piece] * MIRROR;
    const left = row.lefts[piece];
    const near = floor - up * 2;
    const far = near - up * shown;
    context.fillStyle = barRamp(
      context,
      colours,
      near,
      far,
      0.36 * look.opacity,
      0,
    );
    context.fillRect(left, Math.min(near, far), barWidth, Math.abs(far - near));
  }
  context.restore();

  // The bars.
  context.save();
  context.globalAlpha = look.opacity;
  if (look.ink === 'level') {
    for (let piece = 0; piece < row.count; piece += 1) {
      const height = heights[piece];
      const bar = new Path2D();
      bar.rect(
        row.lefts[piece],
        up < 0 ? floor - height : floor,
        barWidth,
        height,
      );
      const paint = barRamp(context, colours, floor, floor + up * height, 1);
      paintBar(context, bar, paint, look.filled, look.lineWidth);
    }
  } else if (look.ink === 'heat') {
    for (let piece = 0; piece < row.count; piece += 1) {
      const height = heights[piece];
      const bar = new Path2D();
      bar.rect(
        row.lefts[piece],
        up < 0 ? floor - height : floor,
        barWidth,
        height,
      );
      paintBar(
        context,
        bar,
        heatInk(colours, heatStep(row.levels[piece]), 1),
        look.filled,
        look.lineWidth,
      );
    }
  } else {
    paintBar(
      context,
      bars,
      figureInk(context, frame, span, 1),
      look.filled,
      look.lineWidth,
    );
  }
  if (look.filled) {
    body?.addPath(bars);
    context.fillStyle = 'rgba(255, 255, 255, 0.45)';
    context.fill(tops);
  }
  context.restore();

  context.fillStyle = lightInkAt(colours, 1, 0.5, 0.9);
  context.fill(held);

  // The horizon: a line of light across the whole plot, and its haze.
  const lights = horizonLine(music.pulse);
  const lineAlpha = lights.line;
  const haze = context.createLinearGradient(0, floor - 6, 0, floor + 6);
  haze.addColorStop(0, inkAt(colours, 0, 0));
  haze.addColorStop(0.5, inkAt(colours, 0, lights.haze));
  haze.addColorStop(1, inkAt(colours, 0, 0));
  context.fillStyle = haze;
  context.fillRect(plot.left, floor - 6, width, 12);
  context.fillStyle = lightInkAt(colours, 0, 0.55, lineAlpha);
  context.fillRect(plot.left, floor - 0.75, width, 1.5);

  if (bloom) {
    bloom.fillStyle = figureInk(bloom, frame, span, 1);
    bloom.fill(bars);
    bloom.fillStyle = lightInkAt(colours, 0, 0.4, lineAlpha);
    bloom.fillRect(plot.left, floor - 1.5, width, 3);
  }
};

const clampAlpha = (value: number): number => Math.max(0, Math.min(1, value));

const paintBar = (
  context: CanvasRenderingContext2D,
  path: Path2D,
  paint: string | CanvasGradient,
  filled: boolean,
  lineWidth: number,
): void => {
  if (filled) {
    context.fillStyle = paint;
    context.fill(path);
  } else {
    context.strokeStyle = paint;
    context.lineWidth = lineWidth;
    context.stroke(path);
  }
};

export const drawHorizon = (
  frame: ISceneFrame,
  state: IHorizonState,
): ISceneDrawn => {
  const row = layPieces(frame, state.row, MIN_PITCH);
  const falling = holdPeaks(state.peaks, row.levels, row.count, frame.deltaMs);
  const bloom = beginBloom(frame, state.bloom);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, bloom, body));
  if (bloom) {
    endBloom(
      frame,
      state.bloom,
      horizonBloom(frame.music.pulse, frame.glow, frame.look.opacity),
    );
  }
  // The sun keeps breathing and wandering while there is music to follow.
  return {
    moving: frame.playing || (falling && frame.look.accents),
    body,
  };
};
