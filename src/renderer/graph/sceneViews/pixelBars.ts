/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  figureInk,
  heatInk,
  heatStep,
  inkAt,
  inkGroups,
  type ISceneDrawn,
  type ISceneFrame,
  type ISceneSpan,
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
 * PIXEL BARS: the spectrum drawn the way an eight-bit console would.
 *
 * Every column is a stack of square pixels on the pixel grid itself — edges
 * snapped to whole screen pixels, never smoothed — its top pixel lit white
 * hot and flashing on the kick, its lower pixels dithered in a checkerboard
 * the way old hardware faded a colour it could not blend. A pixel is held
 * over each column and drops back (Lit peaks), and a row of dim pixels marks
 * the floor.
 *
 * Pieces is how many columns, and the pixels stay square: the rows come
 * from the columns' width. Gap is the seam between pixels, both ways; Colour
 * by lights each pixel by its row, across the row, in one colour, or each
 * column by its loudness; Outline draws hollow pixels; Opacity dims them;
 * Glow lets them bleed a little light, which the originals never could.
 */

/** A column never narrower than this, in CSS pixels. */
const MIN_PITCH = 5;
/** Below this share of a column's height, pixels are dithered. */
const DITHER_BELOW = 0.34;

export interface IPixelBarsState {
  row: IPieceRow;
  peaks: IPeakHold;
  bloom: ISceneBloom;
}

export const createPixelBarsState = (): IPixelBarsState => ({
  row: createPieceRow(),
  peaks: createPeakHold(),
  bloom: createSceneBloom(),
});

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: IPixelBarsState,
  bloom: CanvasRenderingContext2D | null,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, music, look, ratio } = frame;
  const { row } = state;
  const up = band.flipped ? 1 : -1;
  const floor = band.flipped ? band.top : band.bottom;
  const { pitch } = row;
  // A strip of the floor is kept for the ground row the columns stand on.
  const base = pitch * 0.35;
  const rows = Math.max(1, Math.floor((band.bottom - band.top - base) / pitch));
  // Whole screen pixels, so the grid never smears.
  const snap = (value: number) => Math.round(value * ratio) / ratio;
  const cell = Math.max(1 / ratio, snap(row.body));
  const groups = inkGroups(look.ink, rows);
  const lit: Path2D[] = [];
  const dim: Path2D[] = [];
  for (let group = 0; group < groups; group += 1) {
    lit.push(new Path2D());
    dim.push(new Path2D());
  }
  const tops = new Path2D();
  const held = new Path2D();
  const ground = new Path2D();
  const light = new Path2D();
  const yOf = (step: number) =>
    snap(
      up < 0 ? floor - base - (step + 1) * pitch : floor + base + step * pitch,
    );
  const groundY = snap(up < 0 ? floor - cell * 0.22 : floor);
  for (let column = 0; column < row.count; column += 1) {
    const x = snap(row.lefts[column]);
    const level = row.levels[column];
    const steps = Math.round(level * rows);
    const heat = heatStep(level);
    ground.rect(x, groundY, cell, Math.max(1 / ratio, cell * 0.22));
    for (let step = 0; step < steps; step += 1) {
      const y = yOf(step);
      if (step === steps - 1) {
        tops.rect(x, y, cell, cell);
      } else {
        let group = 0;
        if (look.ink === 'level') {
          group = step;
        } else if (look.ink === 'heat') {
          group = heat;
        }
        const isLow = step < steps * DITHER_BELOW;
        const isOdd = (column + step) % 2 === 1;
        (isLow && isOdd ? dim : lit)[group].rect(x, y, cell, cell);
      }
    }
    if (steps > 0) {
      const top = yOf(steps - 1);
      light.rect(x, Math.min(top, floor), cell, Math.abs(floor - top) + cell);
    }
    const heldStep = Math.round(state.peaks.held[column] * rows) - 1;
    if (look.accents && heldStep >= steps && heldStep >= 0) {
      held.rect(x, yOf(heldStep), cell, cell);
    }
  }
  const span: ISceneSpan = {
    left: plot.left,
    right: plot.right,
    floor,
    head: floor + up * rows * pitch,
  };
  const whole = figureInk(context, frame, span, 1);
  const paintOf = (group: number): string | CanvasGradient => {
    if (look.ink === 'level') {
      return inkAt(colours, rows > 1 ? group / (rows - 1) : 1, 1);
    }
    if (look.ink === 'heat') {
      return heatInk(colours, group, 1);
    }
    return whole;
  };
  const draw = (path: Path2D, paint: string | CanvasGradient) => {
    if (look.filled) {
      context.fillStyle = paint;
      context.fill(path);
    } else {
      context.strokeStyle = paint;
      context.lineWidth = look.lineWidth;
      context.stroke(path);
    }
    body?.addPath(path);
  };

  context.save();
  context.imageSmoothingEnabled = false;
  context.globalAlpha = look.opacity * 0.4;
  context.fillStyle = inkAt(colours, 0.15, 1);
  context.fill(ground);
  context.globalAlpha = look.opacity;
  lit.forEach((path, group) => draw(path, paintOf(group)));
  context.globalAlpha = look.opacity * 0.45;
  dim.forEach((path, group) => draw(path, paintOf(group)));
  context.globalAlpha = look.opacity;
  draw(tops, figureInk(context, frame, span, 1, 0.18 + music.pulse * 0.5));
  draw(held, figureInk(context, frame, span, 1, 0.6));
  context.restore();

  if (bloom) {
    bloom.fillStyle = figureInk(bloom, frame, span, 1);
    bloom.fill(light);
  }
};

export const drawPixelBars = (
  frame: ISceneFrame,
  state: IPixelBarsState,
): ISceneDrawn => {
  const row = layPieces(frame, state.row, MIN_PITCH);
  const falling = holdPeaks(state.peaks, row.levels, row.count, frame.deltaMs);
  // The originals had no glow at all: a faint one on the kick, and more
  // only when the look's Glow asks for it.
  const strength =
    (0.1 + frame.music.pulse * 0.2 + frame.glow * 0.5) * frame.look.opacity;
  const bloom = beginBloom(frame, state.bloom);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, bloom, body));
  if (bloom) {
    endBloom(frame, state.bloom, strength);
  }
  return { moving: falling && frame.look.accents, body };
};
