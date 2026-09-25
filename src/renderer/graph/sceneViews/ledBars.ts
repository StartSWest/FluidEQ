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
  inkPosition,
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
 * LED BARS: the hi-fi spectrum analyser — columns of square LED segments.
 *
 * Every segment is on the panel all the time, the unlit ones a dim print of
 * the colour they light in, the way a real analyser's segments show through
 * their filter; the music lights each column from the floor, the top lit
 * segment hottest, each segment with a glassy highlight along its top edge.
 * A peak segment is held over each column and falls (Lit peaks), and the lit
 * panel blooms, harder on the kick and more with the look's Glow.
 *
 * Segments are square while the columns are narrow enough for a dozen rows
 * of squares to fit; wider columns get the classic wide segment instead, so
 * a bar never has fewer than a dozen steps. Pieces is the columns and Gap
 * the space between them; Colour by lights the segments by their row (green
 * to red, the meter's own reading), across the panel, in one colour, or each
 * column whole by its loudness; Outline draws the segments as frames at the
 * line width; Opacity dims the lit segments.
 *
 * The unlit panel is printed once to a layer and copied; the lit segments of
 * one colour are one path and one fill; the highlights one more.
 */

/** A column never on a pitch smaller than this, in CSS pixels. */
const MIN_PITCH = 5;
/** Never fewer rows than this, whatever the columns' width. */
const MIN_ROWS = 12;
/** The gap between two rows, as a share of a segment's height, and least. */
const ROW_GAP = 0.2;
const MIN_ROW_GAP = 1.5;

interface IPanel {
  key: string;
  /** Segment height and the pitch between rows. */
  cell: number;
  rowPitch: number;
  /** One per copy: its rows and where its floor is. */
  boards: { rows: number; floor: number; up: number }[];
}

export interface ILedBarsState {
  row: IPieceRow;
  peaks: IPeakHold;
  bloom: ISceneBloom;
  panel?: IPanel;
  ghost?: HTMLCanvasElement;
}

export const createLedBarsState = (): ILedBarsState => ({
  row: createPieceRow(),
  peaks: createPeakHold(),
  bloom: createSceneBloom(),
});

const panelFor = (frame: ISceneFrame, row: IPieceRow): IPanel => {
  const { bands, look, colours, ratio } = frame;
  const shallowest = bands.reduce(
    (least, band: IAnalysisBand) => Math.min(least, band.bottom - band.top),
    Number.POSITIVE_INFINITY,
  );
  // Square while a dozen squares fit; otherwise the height a dozen rows
  // leave, which is the wide segment of a classic panel.
  const squareRows = Math.floor(
    shallowest / (row.body + Math.max(MIN_ROW_GAP, row.body * ROW_GAP)),
  );
  let cell = row.body;
  let rowPitch = row.body + Math.max(MIN_ROW_GAP, row.body * ROW_GAP);
  if (squareRows < MIN_ROWS) {
    rowPitch = shallowest / MIN_ROWS;
    cell = Math.max(1, rowPitch - Math.max(MIN_ROW_GAP, rowPitch * ROW_GAP));
  }
  const boards = bands.map((band) => ({
    rows: Math.max(1, Math.floor((band.bottom - band.top) / rowPitch)),
    floor: band.flipped ? band.top : band.bottom,
    up: band.flipped ? 1 : -1,
  }));
  return {
    key: `${row.count}|${row.body.toFixed(2)}|${rowPitch.toFixed(2)}|${boards
      .map((board) => `${board.rows}@${Math.round(board.floor)}`)
      .join(',')}|${ratio}|${colours.join(',')}|${look.ink}|${
      look.filled ? 'fill' : `frame${look.lineWidth}`
    }`,
    cell,
    rowPitch,
    boards,
  };
};

/** The segment `step` rows up a column, as a rectangle. */
const segmentAt = (
  panel: IPanel,
  board: IPanel['boards'][number],
  step: number,
): number =>
  board.up < 0
    ? board.floor - (step + 1) * panel.rowPitch + (panel.rowPitch - panel.cell)
    : board.floor + step * panel.rowPitch;

/** A segment's colour position on the ramp for Colour by. */
const segmentTint = (
  frame: ISceneFrame,
  along: number,
  step: number,
  rows: number,
  columnLevel: number,
): number =>
  frame.look.ink === 'heat'
    ? columnLevel
    : inkPosition(frame.look.ink, along, rows > 1 ? step / (rows - 1) : 1);

/** The whole panel, unlit: every segment a dim print of its own colour. */
const printGhost = (
  frame: ISceneFrame,
  panel: IPanel,
  row: IPieceRow,
): HTMLCanvasElement => {
  const { ratio, window, colours, plot, look } = frame;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(window.width * ratio));
  canvas.height = Math.max(1, Math.round(window.height * ratio));
  const context = canvas.getContext('2d');
  if (!context) {
    return canvas;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const width = plot.right - plot.left;
  panel.boards.forEach((board) => {
    // Dim prints are one path per row for level, one per column otherwise:
    // either way a few dozen fills, once.
    for (let step = 0; step < board.rows; step += 1) {
      const y = segmentAt(panel, board, step);
      const cells = new Path2D();
      for (let piece = 0; piece < row.count; piece += 1) {
        cells.rect(row.lefts[piece], y, row.body, panel.cell);
      }
      if (look.ink === 'frequency') {
        const across = context.createLinearGradient(
          plot.left,
          0,
          plot.left + width,
          0,
        );
        for (let stop = 0; stop < 8; stop += 1) {
          across.addColorStop(stop / 7, inkAt(colours, stop / 7, 0.09));
        }
        context.fillStyle = across;
        context.strokeStyle = across;
      } else {
        const tint = segmentTint(frame, 0.5, step, board.rows, 0);
        context.fillStyle = inkAt(colours, tint, 0.09);
        context.strokeStyle = inkAt(colours, tint, 0.16);
      }
      if (look.filled) {
        context.fill(cells);
      } else {
        context.lineWidth = look.lineWidth;
        context.stroke(cells);
      }
    }
  });
  return canvas;
};

export const drawLedBars = (
  frame: ISceneFrame,
  state: ILedBarsState,
): ISceneDrawn => {
  const { context, music, colours, look, plot } = frame;
  const row = layPieces(frame, state.row, MIN_PITCH);
  const panel = panelFor(frame, row);
  if (!state.panel || state.panel.key !== panel.key) {
    state.panel = panel;
    state.ghost = printGhost(frame, panel, row);
  }
  const falling = holdPeaks(state.peaks, row.levels, row.count, frame.deltaMs);

  if (state.ghost) {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.drawImage(state.ghost, 0, 0);
    context.restore();
  }

  const bloom = beginBloom(frame, state.bloom);
  const body = look.textured ? new Path2D() : undefined;
  context.save();
  panel.boards.forEach((board) => {
    const groups = inkGroups(look.ink, board.rows);
    const lit: Path2D[] = [];
    for (let group = 0; group < groups; group += 1) {
      lit.push(new Path2D());
    }
    const hot = new Path2D();
    const shine = new Path2D();
    const held = new Path2D();
    const light = new Path2D();
    for (let piece = 0; piece < row.count; piece += 1) {
      const left = row.lefts[piece];
      const level = row.levels[piece];
      const steps = Math.round(level * board.rows);
      const heat = heatStep(level);
      for (let step = 0; step < steps; step += 1) {
        const y = segmentAt(panel, board, step);
        let group = 0;
        if (look.ink === 'level') {
          group = step;
        } else if (look.ink === 'heat') {
          group = heat;
        }
        // The top lit segment burns hotter than the rest of its column.
        (step === steps - 1 ? hot : lit[group]).rect(
          left,
          y,
          row.body,
          panel.cell,
        );
        shine.rect(
          left + 1,
          board.up < 0 ? y + 0.5 : y + panel.cell - 1.5,
          Math.max(0.5, row.body - 2),
          Math.max(0.6, panel.cell * 0.14),
        );
      }
      if (steps > 0) {
        const top = segmentAt(panel, board, steps - 1);
        const foot = board.floor;
        light.rect(
          left,
          Math.min(top, foot),
          row.body,
          Math.abs(foot - top) + (board.up < 0 ? 0 : panel.cell),
        );
      }
      const heldStep = Math.round(state.peaks.held[piece] * board.rows) - 1;
      if (look.accents && heldStep >= steps && heldStep < board.rows) {
        held.rect(
          left,
          segmentAt(panel, board, heldStep),
          row.body,
          panel.cell,
        );
      }
    }
    const span: ISceneSpan = {
      left: plot.left,
      right: plot.right,
      floor: board.floor,
      head: board.floor + board.up * board.rows * panel.rowPitch,
    };
    const whole = figureInk(context, frame, span, 1);
    context.globalAlpha = look.opacity;
    const paint = (path: Path2D, fill: string | CanvasGradient) => {
      if (look.filled) {
        context.fillStyle = fill;
        context.fill(path);
      } else {
        context.strokeStyle = fill;
        context.lineWidth = look.lineWidth;
        context.stroke(path);
      }
      body?.addPath(path);
    };
    lit.forEach((path, group) => {
      let fill: string | CanvasGradient = whole;
      if (look.ink === 'level') {
        fill = inkAt(colours, board.rows > 1 ? group / (board.rows - 1) : 1, 1);
      } else if (look.ink === 'heat') {
        fill = heatInk(colours, group, 1);
      }
      paint(path, fill);
    });
    // The hottest segment of each column, and the held ones, whitened.
    paint(hot, figureInk(context, frame, span, 1, 0.2));
    paint(held, figureInk(context, frame, span, 1, 0.55));
    if (look.filled) {
      context.fillStyle = 'rgba(255, 255, 255, 0.28)';
      context.fill(shine);
    }
    context.globalAlpha = 1;
    if (bloom) {
      bloom.fillStyle = figureInk(bloom, frame, span, 1);
      bloom.fill(light);
      bloom.fill(held);
    }
  });
  context.restore();
  if (bloom) {
    endBloom(
      frame,
      state.bloom,
      (0.28 + music.pulse * 0.35 + frame.glow * 0.45) * look.opacity,
    );
  }
  return { moving: falling && look.accents, body };
};
