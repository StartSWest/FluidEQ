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
 * AFTERGLOW: bars that leave their light behind them, like a long exposure.
 *
 * Every bar keeps the ghosts of where it stood a moment ago, each fainter
 * than the last, so a bar that drops leaves a trail of light hanging above
 * it that fades as it falls, and a busy passage draws a shimmering haze over
 * the whole row. The bars themselves burn bright at their tops, and the kick
 * lights the whole trail. With Lit peaks a line holds each bar's recent top.
 *
 * Pieces is how many bars and Gap the dark between them; Colour by colours
 * the bars and their trails across the row, up their height, in one colour,
 * or by each bar's loudness; Outline draws bars and ghosts as lines at the
 * line width; Opacity is how strong the light is; Glow how much it spills.
 *
 * The trail keeps a copy of the row every so often of the frames' own time,
 * so it is the same length at any frame rate.
 */

/** A bar never on a pitch smaller than this, in CSS pixels. */
const MIN_PITCH = 4;
/** Ghosts kept, and how often one is left behind, in milliseconds. */
const GHOSTS = 14;
const EVERY_MS = 42;
/** The height of a ghost's lit edge, in CSS pixels. */
const EDGE = 1.5;

export interface IAfterglowState {
  row: IPieceRow;
  peaks: IPeakHold;
  bloom: ISceneBloom;
  /** The row as it was, newest first. */
  ghosts: Float64Array[];
  since: number;
}

export const createAfterglowState = (): IAfterglowState => ({
  row: createPieceRow(),
  peaks: createPeakHold(),
  bloom: createSceneBloom(),
  ghosts: [],
  since: 0,
});

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: IAfterglowState,
  bloom: CanvasRenderingContext2D | null,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, music, look } = frame;
  const { row } = state;
  const up = band.flipped ? 1 : -1;
  const floor = band.flipped ? band.top : band.bottom;
  const reach = (band.bottom - band.top) * 0.94;
  const span: ISceneSpan = {
    left: plot.left,
    right: plot.right,
    floor,
    head: floor + up * reach,
  };
  const barAt = (path: Path2D, piece: number, level: number) => {
    const height = Math.max(1.5, level * reach);
    path.rect(
      row.lefts[piece],
      up < 0 ? floor - height : floor,
      row.body,
      height,
    );
  };
  const paint = (path: Path2D, fill: string | CanvasGradient) => {
    if (look.filled) {
      context.fillStyle = fill;
      context.fill(path);
    } else {
      context.strokeStyle = fill;
      context.lineWidth = look.lineWidth;
      context.stroke(path);
    }
  };

  context.save();
  context.globalCompositeOperation = 'lighter';
  // Oldest first, so the trail fades out toward the past.
  for (let age = state.ghosts.length - 1; age >= 1; age -= 1) {
    const ghost = state.ghosts[age];
    if (ghost.length === row.count) {
      const path = new Path2D();
      // Each ghost keeps the burning top its bar had, so a bar that drops
      // leaves a ladder of fading edges over a haze: the haze alone read as
      // a smudge a few pixels tall.
      const edges = new Path2D();
      for (let piece = 0; piece < row.count; piece += 1) {
        // Only where the ghost stood above the bar is there anything to see.
        if (ghost[piece] > row.levels[piece] + 0.01) {
          barAt(path, piece, ghost[piece]);
          const height = ghost[piece] * reach;
          edges.rect(
            row.lefts[piece],
            up < 0 ? floor - height : floor + height - EDGE,
            row.body,
            EDGE,
          );
        }
      }
      const fade = (1 - age / GHOSTS) ** 1.6;
      paint(
        path,
        figureInk(
          context,
          frame,
          span,
          (0.12 + music.pulse * 0.12 + frame.glow * 0.08) * fade * look.opacity,
          0.15,
        ),
      );
      context.fillStyle = figureInk(
        context,
        frame,
        span,
        0.6 * fade * look.opacity,
        0.35,
      );
      context.fill(edges);
    }
  }
  context.restore();

  const groups = look.ink === 'heat' ? HEAT_STEPS : 1;
  const bars: Path2D[] = [];
  for (let group = 0; group < groups; group += 1) {
    bars.push(new Path2D());
  }
  const tops = new Path2D();
  const held = new Path2D();
  for (let piece = 0; piece < row.count; piece += 1) {
    const level = row.levels[piece];
    const bar = new Path2D();
    barAt(bar, piece, level);
    bars[look.ink === 'heat' ? heatStep(level) : 0].addPath(bar);
    const height = Math.max(1.5, level * reach);
    const edge = Math.min(3, height);
    tops.rect(
      row.lefts[piece],
      up < 0 ? floor - height : floor + height - edge,
      row.body,
      edge,
    );
    const heldHeight = state.peaks.held[piece] * reach;
    if (look.accents && heldHeight - height > 3) {
      held.rect(
        row.lefts[piece],
        floor + up * heldHeight - 0.75,
        row.body,
        1.5,
      );
    }
  }
  const whole = figureInk(context, frame, span, 1);
  context.save();
  context.globalAlpha = look.opacity;
  bars.forEach((path, group) => {
    paint(path, look.ink === 'heat' ? heatInk(colours, group, 1) : whole);
    if (look.filled) {
      body?.addPath(path);
    }
  });
  context.restore();
  context.fillStyle = figureInk(
    context,
    frame,
    span,
    0.95,
    0.55 + music.pulse * 0.3,
  );
  context.fill(tops);
  context.fillStyle = figureInk(context, frame, span, 0.8, 0.5);
  context.fill(held);

  if (bloom) {
    bloom.fillStyle = figureInk(bloom, frame, span, 1, 0.2);
    bloom.fill(tops);
  }
};

export const drawAfterglow = (
  frame: ISceneFrame,
  state: IAfterglowState,
): ISceneDrawn => {
  const row = layPieces(frame, state.row, MIN_PITCH);
  const falling = holdPeaks(state.peaks, row.levels, row.count, frame.deltaMs);
  // The trail: a copy of the row every EVERY_MS of the frames' own time.
  state.since += frame.deltaMs;
  if (state.since >= EVERY_MS || state.ghosts.length === 0) {
    state.since = 0;
    const recycled =
      state.ghosts.length >= GHOSTS ? state.ghosts.pop() : undefined;
    const copy =
      recycled && recycled.length === row.count
        ? recycled
        : new Float64Array(row.count);
    copy.set(row.levels);
    state.ghosts.unshift(copy);
  }
  const bloom = beginBloom(frame, state.bloom);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, bloom, body));
  if (bloom) {
    endBloom(
      frame,
      state.bloom,
      (0.3 + frame.music.pulse * 0.35 + frame.glow * 0.5) * frame.look.opacity,
    );
  }
  // A trail still hanging over a bar at rest is still fading.
  const oldest = state.ghosts[state.ghosts.length - 1];
  let trailing = false;
  if (oldest && oldest.length === row.count) {
    for (let piece = 0; piece < row.count && !trailing; piece += 1) {
      trailing = oldest[piece] > row.levels[piece] + 0.01;
    }
  }
  return { moving: trailing || (falling && frame.look.accents), body };
};
