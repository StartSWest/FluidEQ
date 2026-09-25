/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  figureInk,
  hash01,
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
 * LED WALL: a stadium board of round lamps.
 *
 * Every lamp is on the board all the time — the unlit ones a faint ghost of
 * the glass, the way a real board looks with its power on and nothing
 * showing — and the music lights columns of them, each lamp with a hot
 * centre, a darker rim and a glint on its lens. The top lamp of each column
 * is held for a moment and then falls (Lit peaks), and the board blooms: its
 * light spills into the air around it, harder on the kick and more with the
 * look's Glow. On the treble a few of the top lamps flash white.
 *
 * The style editor: Pieces is the columns of lamps and Gap the space between
 * them (a lamp is as wide as its column less the gap, and the rows keep the
 * same pitch, so lamps stay round); Colour by lights each lamp in its row's
 * colour, its column's, one colour, or its column's loudness; Outline draws
 * the lamps as rings at the line width; Opacity dims the lit lamps.
 *
 * Lamps are a fixed size. The height slider takes rows away rather than
 * squashing them, and a narrow window gets fewer columns rather than lamps
 * too small to read.
 *
 * Cost, which is the whole design of the drawing: the unlit board is printed
 * once to a layer and copied each frame; the lit lamps of one colour are one
 * path and one fill; the lens is a pattern the size of one lamp, laid over
 * every lit column in one fill; and the bloom is the lit columns drawn on a
 * canvas an eighth of the size, blurred there and stretched back up. Flat
 * colour stretched from a quarter of the size read as a mustard slab behind
 * the lamps, with the columns' edges in it.
 */

/** A lamp never on a pitch smaller than this, in CSS pixels. */
const MIN_PITCH = 6;

interface ILedBoard {
  rows: number;
  foot: number;
  up: number;
}

interface ILedLayout {
  key: string;
  pitch: number;
  radius: number;
  count: number;
  /** One per copy of the drawing: the rows it holds and where they stand. */
  boards: ILedBoard[];
}

export interface ILedWallState {
  layout?: ILedLayout;
  row: IPieceRow;
  /** The unlit board, printed once per layout. */
  ghost?: HTMLCanvasElement;
  /** One lamp's lens, repeated over whatever is lit. */
  lens?: CanvasPattern | null;
  /** The size in device pixels the lens was drawn at. */
  lensSize: number;
  /** The lit columns, sharp, and then blurred: the light in the air. */
  bloom: ISceneBloom;
  peaks: IPeakHold;
  /** Frames drawn, for the twinkle's pattern. */
  frame: number;
}

export const createLedWallState = (): ILedWallState => ({
  row: createPieceRow(),
  bloom: createSceneBloom(),
  lensSize: 1,
  peaks: createPeakHold(),
  frame: 0,
});

const layoutFor = (frame: ISceneFrame, row: IPieceRow): ILedLayout => {
  const { bands, look } = frame;
  const { pitch, count } = row;
  const radius = Math.max(1, row.body / 2);
  const boards = bands.map((band: IAnalysisBand) => {
    const depth = band.bottom - band.top;
    const rows = Math.max(2, Math.floor(depth / pitch));
    // A board stands on its floor and grows away from it: up, or down when
    // the wave is upside down.
    const foot = band.flipped ? band.top + pitch / 2 : band.bottom - pitch / 2;
    return { rows, foot, up: band.flipped ? 1 : -1 };
  });
  return {
    key: `${count}|${pitch.toFixed(2)}|${radius.toFixed(2)}|${boards
      .map((board) => `${board.rows}@${Math.round(board.foot)}`)
      .join(',')}|${frame.ratio}|${frame.colours.join(',')}|${
      look.filled ? 'fill' : `ring${look.lineWidth}`
    }`,
    pitch,
    radius,
    count,
    boards,
  };
};

const makeCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

/**
 * One lamp's lens on a transparent tile: a rim that darkens toward the edge,
 * a hot centre, and a glint up and to the left. Laid over a lamp already
 * filled in its colour, it turns a flat disc into a lit diode.
 */
const printLens = (size: number, share: number): HTMLCanvasElement => {
  const tile = makeCanvas(size, size);
  const context = tile.getContext('2d');
  if (!context) {
    return tile;
  }
  const centre = size / 2;
  const radius = size * share;
  const rim = context.createRadialGradient(
    centre,
    centre,
    radius * 0.62,
    centre,
    centre,
    radius,
  );
  rim.addColorStop(0, 'rgba(0, 0, 0, 0)');
  rim.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  context.fillStyle = rim;
  context.beginPath();
  context.arc(centre, centre, radius, 0, Math.PI * 2);
  context.fill();

  const core = context.createRadialGradient(
    centre,
    centre,
    0,
    centre,
    centre,
    radius * 0.72,
  );
  core.addColorStop(0, 'rgba(255, 255, 255, 0.62)');
  core.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
  core.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = core;
  context.fill();

  const glintX = centre - radius * 0.34;
  const glintY = centre - radius * 0.36;
  const glint = context.createRadialGradient(
    glintX,
    glintY,
    0,
    glintX,
    glintY,
    radius * 0.3,
  );
  glint.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
  glint.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = glint;
  context.beginPath();
  context.arc(glintX, glintY, radius * 0.3, 0, Math.PI * 2);
  context.fill();
  return tile;
};

/** Puts the lens's tiles on a board's lamps: one tile a pitch, centred. */
const alignLens = (
  lens: CanvasPattern,
  size: number,
  left: number,
  pitch: number,
  board: ILedBoard,
): void => {
  const scale = pitch / size;
  lens.setTransform(
    new DOMMatrix([
      scale,
      0,
      0,
      scale,
      left - pitch / 2,
      board.foot - pitch / 2,
    ]),
  );
};

/** Where a board's lamps stand, for its paint: across, and foot to top. */
const spanOf = (
  frame: ISceneFrame,
  layout: ILedLayout,
  board: ILedBoard,
): ISceneSpan => ({
  left: frame.plot.left,
  right: frame.plot.right,
  floor: board.foot,
  head: board.foot + board.up * (board.rows - 1) * layout.pitch,
});

/** Draws a path of lamps as the look says: solid, or rings. */
const lampStroke = (
  context: CanvasRenderingContext2D,
  frame: ISceneFrame,
  path: Path2D,
): void => {
  if (frame.look.filled) {
    context.fill(path);
  } else {
    context.lineWidth = frame.look.lineWidth;
    context.stroke(path);
  }
};

/** The board with its power on and nothing showing. */
const printGhost = (
  frame: ISceneFrame,
  layout: ILedLayout,
  lefts: Float64Array,
  lens: CanvasPattern | null | undefined,
  lensSize: number,
) => {
  const { ratio, window } = frame;
  const canvas = makeCanvas(window.width * ratio, window.height * ratio);
  const context = canvas.getContext('2d');
  if (!context) {
    return canvas;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const { radius, pitch } = layout;
  layout.boards.forEach((board) => {
    const glass = new Path2D();
    for (let column = 0; column < layout.count; column += 1) {
      const x = lefts[column] + radius;
      for (let row = 0; row < board.rows; row += 1) {
        const y = board.foot + board.up * row * pitch;
        glass.moveTo(x + radius, y);
        glass.arc(x, y, radius, 0, Math.PI * 2);
      }
    }
    // Tinted with the bottom of the ramp, so the board's glass belongs to the
    // colours it lights in rather than being a grey sheet.
    context.fillStyle = inkAt(frame.colours, 0.1, 0.075);
    context.strokeStyle = inkAt(frame.colours, 0.1, 0.12);
    lampStroke(context, frame, glass);
    // The unlit lenses still catch the room's light, faintly.
    if (lens && frame.look.filled) {
      alignLens(lens, lensSize, lefts[0] + radius, pitch, board);
      context.globalAlpha = 0.07;
      context.fillStyle = lens;
      context.fill(glass);
      context.globalAlpha = 1;
    }
  });
  return canvas;
};

export const drawLedWall = (
  frame: ISceneFrame,
  state: ILedWallState,
): ISceneDrawn => {
  const { context, ratio, music, colours, look } = frame;
  const row = layPieces(frame, state.row, MIN_PITCH);
  const layout = layoutFor(frame, row);
  if (!state.layout || state.layout.key !== layout.key) {
    state.layout = layout;
    state.lensSize = Math.max(4, Math.ceil(layout.pitch * ratio));
    state.lens = context.createPattern(
      printLens(state.lensSize, layout.radius / layout.pitch),
      'repeat',
    );
    state.ghost = printGhost(
      frame,
      layout,
      row.lefts,
      state.lens,
      state.lensSize,
    );
  }
  state.frame += 1;
  const { pitch, radius, count, boards } = layout;
  const falling = holdPeaks(state.peaks, row.levels, count, frame.deltaMs);

  // The unlit board, copied rather than drawn.
  if (state.ghost) {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.drawImage(state.ghost, 0, 0);
    context.restore();
  }

  const bloom = beginBloom(frame, state.bloom);

  const sparks = new Path2D();
  const body = look.textured ? new Path2D() : undefined;
  context.save();
  context.globalAlpha = look.opacity;
  boards.forEach((board) => {
    // One path per colour: a row's for level, a heat step's for heat, and
    // one for the whole board when the colour runs across it or is one.
    const groups = inkGroups(look.ink, board.rows);
    const lit: Path2D[] = [];
    for (let group = 0; group < groups; group += 1) {
      lit.push(new Path2D());
    }
    const peakLamps = new Path2D();
    // Every lit lamp's cell, for the lens; and every lit column, for the
    // bloom.
    const cells = new Path2D();
    const light = new Path2D();
    for (let column = 0; column < count; column += 1) {
      const x = row.lefts[column] + radius;
      const level = row.levels[column];
      const rows = Math.round(level * board.rows);
      const heat = heatStep(level);
      for (let lamp = 0; lamp < rows; lamp += 1) {
        const y = board.foot + board.up * lamp * pitch;
        let group = 0;
        if (look.ink === 'level') {
          group = lamp;
        } else if (look.ink === 'heat') {
          group = heat;
        }
        lit[group].moveTo(x + radius, y);
        lit[group].arc(x, y, radius, 0, Math.PI * 2);
      }
      if (rows > 0) {
        const topY = board.foot + board.up * (rows - 0.5) * pitch;
        const footY = board.foot - board.up * pitch * 0.5;
        cells.rect(
          x - pitch / 2,
          Math.min(topY, footY),
          pitch,
          Math.abs(footY - topY),
        );
        light.rect(
          x - pitch / 2,
          Math.min(topY, footY),
          pitch,
          Math.abs(footY - topY),
        );
      }
      // The top lamp of a lit column catches the treble.
      if (
        rows > 0 &&
        music.treble > 0.2 &&
        hash01(column * 7.3 + state.frame * 0.61) < music.treble * 0.16
      ) {
        const y = board.foot + board.up * (rows - 1) * pitch;
        sparks.moveTo(x + radius * 1.05, y);
        sparks.arc(x, y, radius * 1.05, 0, Math.PI * 2);
      }
      // The held peak, a lamp left lit over the column.
      const peakRow = Math.round(state.peaks.held[column] * board.rows) - 1;
      if (
        look.accents &&
        peakRow >= rows &&
        peakRow >= 0 &&
        peakRow < board.rows
      ) {
        const y = board.foot + board.up * peakRow * pitch;
        peakLamps.moveTo(x + radius, y);
        peakLamps.arc(x, y, radius, 0, Math.PI * 2);
        cells.rect(x - pitch / 2, y - pitch / 2, pitch, pitch);
      }
    }
    const span = spanOf(frame, layout, board);
    const whole = figureInk(context, frame, span, 1);
    lit.forEach((path, group) => {
      let paint: string | CanvasGradient = whole;
      if (look.ink === 'level') {
        paint = inkAt(
          colours,
          board.rows > 1 ? group / (board.rows - 1) : 1,
          1,
        );
      } else if (look.ink === 'heat') {
        paint = heatInk(colours, group, 1);
      }
      context.fillStyle = paint;
      context.strokeStyle = paint;
      lampStroke(context, frame, path);
      body?.addPath(path);
    });
    // A held peak is the lamp of its own row, lit a little whiter, so it
    // reads as the same board and not as a second set of lights.
    const peakPaint = figureInk(context, frame, span, 1, 0.3);
    context.fillStyle = peakPaint;
    context.strokeStyle = peakPaint;
    lampStroke(context, frame, peakLamps);
    body?.addPath(peakLamps);
    if (state.lens && look.filled) {
      alignLens(
        state.lens,
        state.lensSize,
        row.lefts[0] + radius,
        pitch,
        board,
      );
      context.fillStyle = state.lens;
      context.fill(cells);
    }
    if (bloom) {
      bloom.fillStyle = figureInk(bloom, frame, span, 1);
      bloom.fill(light);
    }
  });
  context.restore();

  // The bloom: soft light round everything lit, brighter on the kick and
  // with the Glow.
  if (bloom) {
    endBloom(
      frame,
      state.bloom,
      (0.3 + music.pulse * 0.4 + frame.glow * 0.45) * look.opacity,
    );
  }

  context.fillStyle = 'rgba(255, 255, 255, 0.9)';
  context.fill(sparks);

  state.frame %= 100000;
  // Still falling peaks keep the loop awake; the music's own movement is
  // answered for by the listener (`hearMusic`).
  return { moving: falling && look.accents, body };
};
