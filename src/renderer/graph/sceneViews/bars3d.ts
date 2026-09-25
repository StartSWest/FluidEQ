/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  HEAT_STEPS,
  figureInk,
  heatInk,
  heatStep,
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
 * 3D BARS: blocks standing on a floor, seen from a little above and to the
 * left.
 *
 * Each bar is a solid block: its front face in its colour, its top lit, its
 * side in shadow, and a shadow of its own laid on the floor behind it. A
 * slab floats over every block at its recent height and settles back (Lit
 * peaks); the fronts bloom a little, more on the kick and with the Glow.
 *
 * Pieces is how many blocks and Gap the floor between them, which is also
 * where each block's side and shadow fall — the depth is a share of the
 * block's width, so it never runs into its neighbour; Colour by runs across
 * the row, up the blocks, in one colour, or each block by its loudness;
 * Outline draws the blocks as wireframes at the line width; Opacity is how
 * solid they are.
 *
 * Fronts, tops, sides and shadows of one colour are one path each.
 */

/** A block never on a pitch smaller than this, in CSS pixels. */
const MIN_PITCH = 7;
/** The depth drawn, as a share of a block's width, and its slant. */
const DEPTH = 0.42;
const SLANT_X = 0.8;
const SLANT_Y = 0.55;
/** The floor sits this far up the band, for the shadows to lie on. */
const FLOOR = 0.08;

export interface IBars3dState {
  row: IPieceRow;
  peaks: IPeakHold;
  bloom: ISceneBloom;
}

export const createBars3dState = (): IBars3dState => ({
  row: createPieceRow(),
  peaks: createPeakHold(),
  bloom: createSceneBloom(),
});

interface IBlockPaths {
  front: Path2D;
  top: Path2D;
  side: Path2D;
}

const blockPaths = (): IBlockPaths => ({
  front: new Path2D(),
  top: new Path2D(),
  side: new Path2D(),
});

/**
 * One block into the paths: a front from the floor up `height`, a top and a
 * side slanting back by `dx`, `dy`. Upside down (`up` > 0) the block hangs
 * and its "top" is its lowest face.
 */
const addBlock = (
  paths: IBlockPaths,
  left: number,
  width: number,
  floor: number,
  up: number,
  height: number,
  dx: number,
  dy: number,
) => {
  const head = floor + up * height;
  const top = Math.min(floor, head);
  paths.front.rect(left, top, width, Math.abs(head - floor));
  // The top face: the head edge pushed back.
  paths.top.moveTo(left, head);
  paths.top.lineTo(left + dx, head + up * dy);
  paths.top.lineTo(left + width + dx, head + up * dy);
  paths.top.lineTo(left + width, head);
  paths.top.closePath();
  // The side: the right edge pushed back, floor to head.
  paths.side.moveTo(left + width, floor);
  paths.side.lineTo(left + width + dx, floor + up * dy);
  paths.side.lineTo(left + width + dx, head + up * dy);
  paths.side.lineTo(left + width, head);
  paths.side.closePath();
};

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: IBars3dState,
  bloom: CanvasRenderingContext2D | null,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, look } = frame;
  const { row } = state;
  const depth = band.bottom - band.top;
  const up = band.flipped ? 1 : -1;
  const floor = band.flipped
    ? band.top + depth * FLOOR
    : band.bottom - depth * FLOOR;
  const dx = row.body * DEPTH * SLANT_X;
  const dy = row.body * DEPTH * SLANT_Y;
  const reach = depth * (1 - FLOOR) - dy - 4;
  const span: ISceneSpan = {
    left: plot.left,
    right: plot.right,
    floor,
    head: floor + up * reach,
  };
  const groups = look.ink === 'heat' ? HEAT_STEPS : 1;
  const blocks: IBlockPaths[] = [];
  for (let group = 0; group < groups; group += 1) {
    blocks.push(blockPaths());
  }
  const slabs = blockPaths();
  const shadows = new Path2D();
  const fronts = new Path2D();
  // Every block's side reaches `dx` past its front, so the row is moved left
  // by what the last side would overrun the plot — never further than the
  // first block's own margin — or the last block is cut at the edge.
  const margin = (row.pitch - row.body) / 2;
  const shift = Math.min(margin, Math.max(0, dx - margin));
  for (let piece = 0; piece < row.count; piece += 1) {
    const left = row.lefts[piece] - shift;
    const level = row.levels[piece];
    const height = Math.max(2, level * reach);
    const paths = blocks[look.ink === 'heat' ? heatStep(level) : 0];
    addBlock(paths, left, row.body, floor, up, height, dx, dy);
    fronts.rect(left, Math.min(floor, floor + up * height), row.body, height);
    // Its shadow on the floor, thrown back and to the right.
    const fall = Math.min(height * 0.35, dy * 3);
    shadows.moveTo(left + row.body, floor);
    shadows.lineTo(left + row.body + dx + fall * 0.6, floor + up * dy * 0.6);
    shadows.lineTo(left + dx * 0.6 + fall * 0.6, floor + up * dy * 0.6);
    shadows.lineTo(left, floor);
    shadows.closePath();
    const held = state.peaks.held[piece] * reach;
    if (look.accents && held - height > 4) {
      const slab = Math.max(2, Math.min(5, row.body * 0.18));
      addBlock(
        slabs,
        left,
        row.body,
        floor + up * (held - slab),
        up,
        slab,
        dx,
        dy,
      );
    }
  }

  context.save();
  context.globalAlpha = look.opacity;
  if (look.filled) {
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.fill(shadows);
  }
  const whole = figureInk(context, frame, span, 1);
  const lit = figureInk(context, frame, span, 1, 0.45);
  const draw = (path: Path2D, paint: string | CanvasGradient) => {
    if (look.filled) {
      context.fillStyle = paint;
      context.fill(path);
    } else {
      context.strokeStyle = paint;
      context.lineWidth = look.lineWidth;
      context.stroke(path);
    }
  };
  blocks.forEach((paths, group) => {
    const paint = look.ink === 'heat' ? heatInk(colours, group, 1) : whole;
    const top = look.ink === 'heat' ? heatInk(colours, group, 1, 0.45) : lit;
    // Side first, darkened; then the lit top; then the front over both.
    draw(paths.side, paint);
    if (look.filled) {
      context.fillStyle = 'rgba(0, 0, 0, 0.42)';
      context.fill(paths.side);
    }
    draw(paths.top, top);
    draw(paths.front, paint);
    body?.addPath(paths.front);
    body?.addPath(paths.top);
    body?.addPath(paths.side);
  });
  if (look.filled) {
    // A little light down the front's left edge, where the view catches it.
    const sheen = context.createLinearGradient(plot.left, 0, plot.right, 0);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
    context.fillStyle = sheen;
    context.fill(fronts);
  }
  context.restore();
  // The floating slabs, lit.
  draw(slabs.side, figureInk(context, frame, span, 0.9, 0.3));
  draw(slabs.top, figureInk(context, frame, span, 0.95, 0.7));
  draw(slabs.front, figureInk(context, frame, span, 0.95, 0.5));

  if (bloom) {
    bloom.fillStyle = figureInk(bloom, frame, span, 1);
    bloom.fill(fronts);
  }
};

export const drawBars3d = (
  frame: ISceneFrame,
  state: IBars3dState,
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
      (0.16 + frame.music.pulse * 0.3 + frame.glow * 0.45) * frame.look.opacity,
    );
  }
  return { moving: falling && frame.look.accents, body };
};
