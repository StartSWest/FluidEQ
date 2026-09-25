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

/** A column of dots never on a pitch smaller than this, in CSS pixels. */
const MIN_PITCH = 6;
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

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: IHalftoneState,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, look } = frame;
  const { row } = state;
  const width = plot.right - plot.left;
  const up = band.flipped ? 1 : -1;
  const floor = band.flipped ? band.top : band.bottom;
  const { pitch } = row;
  const rows = Math.max(2, Math.floor((band.bottom - band.top) / pitch));
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
    const along = (x - plot.left) / width;
    let swell = 0;
    state.ripples.forEach((front) => {
      const distance = Math.abs(along - front) / RIPPLE_WIDTH;
      swell = Math.max(
        swell,
        Math.exp(-distance * distance) * (1 - front * 0.5),
      );
    });
    const heat = heatStep(level);
    for (let line = 0; line < rows; line += 1) {
      const height = (line + 0.5) / rows;
      let size: number;
      if (height <= level) {
        size = 0.35 + 0.65 * clampUnit((level - height) / FILL_DEPTH);
      } else {
        size = 0.16 * clampUnit(1 - (height - level) / FADE_HEIGHT);
      }
      const radius = largest * Math.min(1.25, size * (1 + swell * 0.45));
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
    const heldLine = Math.round(state.peaks.held[column] * rows) - 1;
    const levelLine = Math.round(level * rows) - 1;
    if (look.accents && heldLine > levelLine && heldLine < rows) {
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
  // A kick sends a ripple from the bass end across the screen.
  if (frame.music.onBeat && state.ripples.length < 4) {
    state.ripples.push(0);
  }
  const travel = (RIPPLE_SPEED * frame.deltaMs) / 1000;
  state.ripples = state.ripples
    .map((front) => front + travel)
    .filter((front) => front < 1 + RIPPLE_WIDTH * 2);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, body));
  return {
    moving: state.ripples.length > 0 || (falling && frame.look.accents),
    body,
  };
};
