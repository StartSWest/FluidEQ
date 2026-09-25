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
  levelAtX,
  type ISceneDrawn,
  type ISceneFrame,
  type ISceneSpan,
} from './sceneFrame';

/**
 * MESH: the last second of the spectrum as a wireframe landscape rolling
 * toward you.
 *
 * Every few hundredths of a second the spectrum is laid down as a new ridge
 * at the front, and the ridges before it recede into the distance, lower and
 * narrower the further back they are, so the music leaves a terrain behind
 * it. Lines run along each ridge and down every column, dimming with
 * distance; the front ridge burns brightest and flashes on the kick. With
 * Lit peaks the highest points of the front ridge carry a spark.
 *
 * Pieces is how many points each ridge has; Colour by runs the colours
 * across, up the heights, in one colour, or each ridge by how loud it was;
 * Outline leaves the wireframe alone, and filled lays a faint skin under
 * every ridge; Opacity is how strong the lines are; Glow how bright the front.
 * Upside down, the terrain hangs from the top.
 */

/** Ridges kept, and how often a new one is laid down. */
const RIDGES = 26;
const EVERY_MS = 45;
/** Points along a ridge, however many Pieces asks for, within these. */
const FEWEST = 16;
const MOST = 120;

export interface IMeshState {
  /** Ridges, newest first, each the spectrum sampled across. */
  ridges: Float64Array[];
  since: number;
  points: number;
}

export const createMeshState = (): IMeshState => ({
  ridges: [],
  since: 0,
  points: 0,
});

/** How near a ridge is, 1 at the front and falling away into the distance. */
const nearness = (depth: number): number => 1 / (1 + depth * 3.2);

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: IMeshState,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, music, look } = frame;
  const width = plot.right - plot.left;
  const cx = (plot.left + plot.right) / 2;
  const tall = band.bottom - band.top;
  // Drawn upright and mirrored for a wave hung upside down.
  context.save();
  if (band.flipped) {
    context.translate(0, band.top + band.bottom);
    context.scale(1, -1);
  }
  const horizon = band.top + tall * 0.24;
  const floor = band.bottom - 2;
  const farthest = nearness(1);
  const span: ISceneSpan = {
    left: plot.left,
    right: plot.right,
    floor,
    head: band.top,
  };
  const count = state.points;
  // Rolling toward the viewer between one ridge and the next.
  const roll = Math.min(1, state.since / EVERY_MS);
  const grid: { x: number; y: number }[][] = [];
  state.ridges.forEach((ridge, index) => {
    const depth = Math.min(1, (index + roll) / (RIDGES - 1));
    const near = (nearness(depth) - farthest) / (1 - farthest);
    const base = horizon + (floor - horizon) * near;
    const spread = width * (0.34 + 0.66 * near);
    const lift = tall * 0.46 * (0.25 + 0.75 * near);
    const points: { x: number; y: number }[] = [];
    for (let point = 0; point < count; point += 1) {
      points.push({
        x: cx + (point / (count - 1) - 0.5) * spread,
        y: base - ridge[point] * lift,
      });
    }
    grid.push(points);
  });

  // Back to front, so nearer ridges are drawn over farther ones.
  for (let index = grid.length - 1; index >= 0; index -= 1) {
    const points = grid[index];
    const depth = Math.min(1, (index + roll) / (RIDGES - 1));
    const near = (nearness(depth) - farthest) / (1 - farthest);
    const line = new Path2D();
    points.forEach(({ x, y }, point) => {
      if (point === 0) {
        line.moveTo(x, y);
      } else {
        line.lineTo(x, y);
      }
    });
    const ridge = state.ridges[index];
    let loudest = 0;
    ridge.forEach((value) => {
      loudest = Math.max(loudest, value);
    });
    const isFront = index === 0;
    const alpha = (0.3 + 0.7 * near) * look.opacity;
    const whiten = isFront ? 0.3 + music.pulse * 0.5 : 0;
    const paint =
      look.ink === 'heat'
        ? heatInk(colours, heatStep(loudest), alpha, whiten)
        : figureInk(context, frame, span, alpha, whiten);
    if (look.filled) {
      const skin = new Path2D(line);
      skin.lineTo(points[points.length - 1].x, floor + 1);
      skin.lineTo(points[0].x, floor + 1);
      skin.closePath();
      context.fillStyle =
        look.ink === 'heat'
          ? heatInk(colours, heatStep(loudest), 0.03 * look.opacity)
          : figureInk(context, frame, span, 0.03 * look.opacity);
      context.fill(skin);
      if (isFront) {
        // Built upright; put back through the same mirror it was drawn in.
        body?.addPath(
          skin,
          band.flipped
            ? new DOMMatrix([1, 0, 0, -1, 0, band.top + band.bottom])
            : undefined,
        );
      }
    }
    context.strokeStyle = paint;
    context.lineWidth =
      (isFront ? 1.6 : 1) * look.lineWidth * (0.4 + 0.6 * near);
    context.lineJoin = 'round';
    context.stroke(line);
  }
  // The lines down every column, from the back to the front.
  if (grid.length > 1) {
    const columns = new Path2D();
    const stride = Math.max(1, Math.round(count / 32));
    for (let point = 0; point < count; point += stride) {
      grid.forEach((points, index) => {
        if (index === 0) {
          columns.moveTo(points[point].x, points[point].y);
        } else {
          columns.lineTo(points[point].x, points[point].y);
        }
      });
    }
    context.strokeStyle = figureInk(context, frame, span, 0.32 * look.opacity);
    context.lineWidth = 0.9;
    context.stroke(columns);
  }
  // Sparks on the front ridge's highest points.
  const [front] = grid;
  if (look.accents && front) {
    const sparks = new Path2D();
    const ridge = state.ridges[0];
    let peak = 0;
    ridge.forEach((value) => {
      peak = Math.max(peak, value);
    });
    front.forEach(({ x, y }, point) => {
      if (peak > 0.2 && ridge[point] > peak * 0.9) {
        sparks.moveTo(x + 2.2, y);
        sparks.arc(x, y, 2.2, 0, Math.PI * 2);
      }
    });
    context.fillStyle = figureInk(
      context,
      frame,
      span,
      clampUnit(0.7 + frame.glow * 0.3),
      0.6,
    );
    context.fill(sparks);
  }
  context.restore();
};

export const drawMesh = (
  frame: ISceneFrame,
  state: IMeshState,
): ISceneDrawn => {
  const { plot, xs, levels, look } = frame;
  const count = Math.max(FEWEST, Math.min(MOST, Math.round(look.pieces)));
  if (state.points !== count) {
    state.points = count;
    state.ridges = [];
    state.since = EVERY_MS;
  }
  // The newest ridge follows the music every frame; a copy of it is left
  // behind to recede every EVERY_MS of the frames' own time.
  state.since += frame.deltaMs;
  if (state.since >= EVERY_MS || state.ridges.length === 0) {
    state.since = 0;
    const recycled =
      state.ridges.length >= RIDGES ? state.ridges.pop() : undefined;
    state.ridges.unshift(recycled ?? new Float64Array(count));
  }
  const width = plot.right - plot.left;
  const [newest] = state.ridges;
  for (let point = 0; point < count; point += 1) {
    newest[point] = clampUnit(
      levelAtX(xs, levels, plot.left + (point / (count - 1)) * width),
    );
  }
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, body));
  // While any ridge still stands above the floor, the terrain is still
  // rolling away and the drawing has to keep going.
  const standing = state.ridges.some((ridge) =>
    ridge.some((value) => value > 0.002),
  );
  return { moving: standing, body };
};
