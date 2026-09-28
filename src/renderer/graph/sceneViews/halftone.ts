/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  clampUnit,
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

/**
 * HALFTONE: the spectrum printed as a dot screen.
 *
 * A grid of dots covers the band, and the spectrum is printed into it the
 * way a newspaper prints a photograph: under the spectrum's line the dots
 * are full, shrinking toward the line, and above it they fade to specks, so
 * the edge of the music is soft, like ink on paper. Every kick sends a
 * ripple through the screen from the bass end, swelling the dots it passes;
 * with Lit peaks a row of bright dots marks where each column reached a
 * moment ago.
 *
 * Pieces is how many columns of dots, and the rows follow so the screen
 * stays square; Gap is the paper between the largest dots; Colour by prints
 * each row in its own colour, across the screen, in one colour, or each
 * column by its loudness; Outline prints rings instead of dots; Opacity is
 * how dark the ink is.
 */

/**
 * A column of dots never on a pitch smaller than this, in CSS pixels.
 * Exported with the functions below for the look's GPU painting
 * (`engineLooks/halftoneLook.ts`), which prints the dots these size.
 */
export const MIN_PITCH = 6;
/** How far below the line a dot takes to reach full size, and above it to vanish. */
const FILL_DEPTH = 0.28;
const FADE_HEIGHT = 0.12;
/** How fast a ripple crosses the screen, in widths a second, and how wide it is. */
const RIPPLE_SPEED = 1.3;
const RIPPLE_WIDTH = 0.08;

export interface IHalftoneState {
  row: IPieceRow;
  peaks: IPeakHold;
  /** Where each ripple's front is, as a share of the width. */
  ripples: number[];
}

export const createHalftoneState = (): IHalftoneState => ({
  row: createPieceRow(),
  peaks: createPeakHold(),
  ripples: [],
});

/** Where one copy's screen stands: its floor, which way it grows, its rows. */
export const halftoneStand = (band: IAnalysisBand, pitch: number) => ({
  floor: band.flipped ? band.top : band.bottom,
  up: band.flipped ? 1 : -1,
  rows: Math.max(2, Math.floor((band.bottom - band.top) / pitch)),
});

/** How much the kicks' ripples swell a column at `along` (0..1 across). */
export const rippleSwell = (
  ripples: readonly number[],
  along: number,
): number => {
  let swell = 0;
  ripples.forEach((front) => {
    const distance = Math.abs(along - front) / RIPPLE_WIDTH;
    swell = Math.max(swell, Math.exp(-distance * distance) * (1 - front * 0.5));
  });
  return swell;
};

/**
 * A dot's radius: full under the spectrum's line, shrinking toward it, fading
 * to specks above it, swollen by a passing ripple. Under 0.4 it is not drawn.
 */
export const halftoneDot = (
  largest: number,
  level: number,
  line: number,
  rows: number,
  swell: number,
): number => {
  const height = (line + 0.5) / rows;
  const size =
    height <= level
      ? 0.35 + 0.65 * clampUnit((level - height) / FILL_DEPTH)
      : 0.16 * clampUnit(1 - (height - level) / FADE_HEIGHT);
  return largest * Math.min(1.25, size * (1 + swell * 0.45));
};

/** The row a column's held dot is printed on, or -1 for none. */
export const halftoneHeldLine = (
  accents: boolean,
  held: number,
  level: number,
  rows: number,
): number => {
  const heldLine = Math.round(held * rows) - 1;
  const levelLine = Math.round(level * rows) - 1;
  return accents && heldLine > levelLine && heldLine < rows ? heldLine : -1;
};

/** A kick sends a ripple from the bass end, and every ripple travels on. */
export const moveRipples = (
  state: IHalftoneState,
  onBeat: boolean,
  deltaMs: number,
): void => {
  if (onBeat && state.ripples.length < 4) {
    state.ripples.push(0);
  }
  const travel = (RIPPLE_SPEED * deltaMs) / 1000;
  state.ripples = state.ripples
    .map((front) => front + travel)
    .filter((front) => front < 1 + RIPPLE_WIDTH * 2);
};

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: IHalftoneState,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, look } = frame;
  const { row } = state;
  const width = plot.right - plot.left;
  const { pitch } = row;
  const { floor, up, rows } = halftoneStand(band, pitch);
  const largest = row.body / 2;
  const groups = inkGroups(look.ink, rows);
  const dots: Path2D[] = [];
  for (let group = 0; group < groups; group += 1) {
    dots.push(new Path2D());
  }
  const held = new Path2D();
  for (let column = 0; column < row.count; column += 1) {
    const x = row.lefts[column] + row.body / 2;
    const level = row.levels[column];
    const swell = rippleSwell(state.ripples, (x - plot.left) / width);
    const heat = heatStep(level);
    for (let line = 0; line < rows; line += 1) {
      const radius = halftoneDot(largest, level, line, rows, swell);
      if (radius >= 0.4) {
        const y = floor + up * (line + 0.5) * pitch;
        let group = 0;
        if (look.ink === 'level') {
          group = line;
        } else if (look.ink === 'heat') {
          group = heat;
        }
        dots[group].moveTo(x + radius, y);
        dots[group].arc(x, y, radius, 0, Math.PI * 2);
      }
    }
    const heldLine = halftoneHeldLine(
      look.accents,
      state.peaks.held[column],
      level,
      rows,
    );
    if (heldLine >= 0) {
      const y = floor + up * (heldLine + 0.5) * pitch;
      held.moveTo(x + largest * 0.7, y);
      held.arc(x, y, largest * 0.7, 0, Math.PI * 2);
    }
  }
  const span: ISceneSpan = {
    left: plot.left,
    right: plot.right,
    floor,
    head: floor + up * rows * pitch,
  };
  const whole = figureInk(context, frame, span, 1);
  context.save();
  context.globalAlpha = look.opacity;
  dots.forEach((path, group) => {
    let paint: string | CanvasGradient = whole;
    if (look.ink === 'level') {
      paint = inkAt(colours, rows > 1 ? group / (rows - 1) : 1, 1);
    } else if (look.ink === 'heat') {
      paint = heatInk(colours, group, 1);
    }
    if (look.filled) {
      context.fillStyle = paint;
      context.fill(path);
      body?.addPath(path);
    } else {
      context.strokeStyle = paint;
      context.lineWidth = Math.max(0.6, look.lineWidth * 0.5);
      context.stroke(path);
    }
  });
  context.fillStyle = figureInk(context, frame, span, 1, 0.6);
  context.fill(held);
  context.restore();
};

export const drawHalftone = (
  frame: ISceneFrame,
  state: IHalftoneState,
): ISceneDrawn => {
  const row = layPieces(frame, state.row, MIN_PITCH);
  const falling = holdPeaks(state.peaks, row.levels, row.count, frame.deltaMs);
  moveRipples(state, frame.music.onBeat, frame.deltaMs);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, body));
  return {
    moving: state.ripples.length > 0 || (falling && frame.look.accents),
    body,
  };
};
