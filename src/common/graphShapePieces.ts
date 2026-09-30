/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import noise from './seededNoise';
import {
  GraphStyle,
  MAX_GRAPH_COLUMNS,
  Projected,
  clampGraphColumns,
  getColumnCount,
  rect,
} from './graphStyles';
import { type PixelRect } from './graphInvaders';
import toColumns from './graphColumns';

// The graph's forms made of pieces — LED cells, towers, the skyline — laid
// out per column.

/**
 * One path for the whole spectrum.
 *
 * `baseline` is the pixel row the bars and fills sit on — the bottom of the
 * plot, not zero decibels, because a spectrum hangs from its own level rather
 * than straddling a midpoint the way a waveform does.
 *
 * `columns` overrides how many pieces a discrete form is broken into, for a
 * look the user has tuned. Left out, the form is drawn at the density it was
 * designed at, which is what every built-in look wants.
 */
/**
 * One piece of a form, on its own.
 *
 * The renderer draws a form as a single path because that is what makes the
 * ornate ones affordable — see the note in `LiveTraceCanvas`. One path takes
 * one fill, though, and a palette whose colour depends on how tall a PIECE is
 * cannot be expressed that way: it comes out as one colour for the lot, which
 * is why `heat` lit whole figures at once while the fluid — painted rather
 * than pathed — lit each bar on its own.
 *
 * So a form can also hand over its pieces, each with the two numbers a colour
 * might depend on. The renderer asks for these only when it has something to
 * say per piece, and takes the single path the rest of the time.
 */
export interface IGraphPiece {
  /** The piece alone, as path data. */
  d: string;
  /** Where it sits across the plot, 0 at the left. */
  across: number;
  /** How tall it is as a fraction of the plot's depth. */
  energy: number;
}

/**
 * The most LED cells the whole meter may hold, lit or not, however tall and
 * dense it is: forty-eight to a column at the densest setting.
 */
export const LED_CELL_BUDGET = 48 * MAX_GRAPH_COLUMNS;

/**
 * A TOWER, not a bar with holes in it.
 *
 * The windows used to be punched out of the block, which made them the
 * colour of whatever was behind the graph and the building a stencil.
 * The silhouette is solid now and the lit windows are painted onto it by
 * the city scene, which is what a city at night looks like.
 *
 * Three roofs, chosen by the piece's own index so a building keeps its
 * shape from frame to frame: a flat top, a setback with a narrower
 * storey above it, and a mast. Only the tall ones get a mast, and only
 * the tall ones get a beacon on it.
 *
 * As blocks rather than path data, because the engine's skyline
 * (`engineLooks/designed/skylineLook.ts`) draws the same towers.
 */
const skylineTower = (
  x: number,
  y: number,
  baseline: number,
  width: number,
  ceiling: number,
  index: number,
): PixelRect[] => {
  const height = Math.max(0, baseline - y);
  if (height < 1) {
    return [];
  }
  const kind = noise(index * 41 + 7);
  const half = width / 2;
  if (kind < 0.34) {
    // A setback: the top storey stands in from the walls below it.
    const setback = Math.min(height * 0.34, width * 0.85);
    const inset = width * 0.17;
    return [
      [x - half, y + setback, width, height - setback],
      [x - half + inset, y, width - inset * 2, setback],
    ];
  }
  const blocks: PixelRect[] = [[x - half, y, width, height]];
  if (kind > 0.72 && height > (baseline - ceiling) * 0.35) {
    // A mast, and a housing at its foot so it does not read as a hair.
    const mast = Math.max(4, width * 0.55);
    const stem = Math.max(1, width * 0.06);
    blocks.push([x - width * 0.16, y - mast * 0.28, width * 0.32, mast * 0.28]);
    blocks.push([x - stem / 2, y - mast, stem, mast]);
  }
  return blocks;
};

/**
 * How each form draws ONE of its pieces.
 *
 * The single-path cases below build their figure by calling these in a loop,
 * so the two are the same geometry rather than two copies of it — the failure
 * this avoids is a border drawn round pieces that are not quite the pieces
 * underneath it, which has already happened once on the fluid.
 */
const PIECE_BUILDERS: Partial<
  Record<
    GraphStyle,
    (
      x: number,
      y: number,
      baseline: number,
      width: number,
      ceiling: number,
      /** Which piece this is, so a form can vary them and not flicker. */
      index: number,
      /** How many pieces there are, for a form that shares a budget. */
      count: number,
    ) => string
  >
> = {
  bars: (x, y, baseline, width) =>
    rect(x - width / 2, y, width, Math.max(0, baseline - y)),
  pillars: (x, y, baseline, width) =>
    rect(x - width / 2, y, width, Math.max(0, baseline - y)),
  blocks: (x, y, baseline, width, ceiling, _index, count) => {
    /**
     * A CELL IS A CELL, whatever the height slider says.
     *
     * Dividing the plot into a fixed twenty-eight rows made the cell's
     * shape a function of the wave's height: tall letterboxes on a full
     * screen, slivers on a short one, and the same look reading as a
     * different form at each setting. Sized from the column's own width
     * instead, the LED keeps its landscape shape at every height and it
     * is the COUNT that answers the slider — fewer cells in a shorter
     * meter, which is what a real meter does.
     *
     * Within one budget for the whole meter, which only the dense end of
     * the slider reaches. The count grows with the square of the density,
     * and uncapped, 160 columns on a full screen lit about 15,000 cells —
     * six milliseconds a frame to build the shapes before a pixel was
     * filled, where the old fixed rows never drew more than 4,500. Past
     * `LED_CELL_BUDGET` the cells grow taller instead of multiplying: the
     * densest setting holds forty-eight to a column, and up to about eighty
     * columns a full screen keeps the landscape cell.
     */
    const segment = Math.max(
      6,
      width * 0.6,
      (Math.max(0, baseline - ceiling) * count) / LED_CELL_BUDGET,
    );
    const separation = Math.max(2, segment * 0.22);
    const lit = Math.floor(
      Math.min(Math.max(0, baseline - ceiling), Math.max(0, baseline - y)) /
        segment,
    );
    let d = '';
    for (let level = 0; level < lit; level += 1) {
      d += rect(
        x - width / 2,
        baseline - (level + 1) * segment + separation / 2,
        width,
        segment - separation,
      );
    }
    return d;
  },
  skyline: (x, y, baseline, width, ceiling, index) =>
    skylineTower(x, y, baseline, width, ceiling, index)
      .map((block) => rect(...block))
      .join(''),
};

/** The narrowest each of them may be drawn, whatever the density. */
const PIECE_WIDTH_FLOORS: Partial<Record<GraphStyle, number>> = {
  skyline: 4,
};

export const hasGraphPieces = (style: GraphStyle): boolean =>
  Boolean(PIECE_BUILDERS[style]);

/** Where a form's pieces stand, and how wide each of them is. */
const pieceLayout = (
  points: readonly Projected[],
  style: GraphStyle,
  columns: number | undefined,
  gap: number,
) => {
  const figure = toColumns(
    points,
    columns === undefined ? getColumnCount(style) : clampGraphColumns(columns),
  );
  const span = figure[figure.length - 1][0] - figure[0][0];
  const step = Math.max(1, span / Math.max(1, figure.length - 1));
  const width = Math.max(
    PIECE_WIDTH_FLOORS[style] ?? 1,
    step * (1 - Math.max(0, Math.min(0.85, gap))),
  );
  return { figure, width };
};

/**
 * The skyline's towers, block by block, laid out exactly as its pieces are:
 * each column's top and the blocks standing there. What the engine's skyline
 * draws (`engineLooks/designed/skylineLook.ts`).
 */
export const createSkylineTowers = (
  points: readonly Projected[],
  baseline: number,
  columns?: number,
  gap = 0,
  ceiling = 0,
) => {
  if (points.length < 2) {
    return { width: 0, towers: [] };
  }
  const { figure, width } = pieceLayout(points, 'skyline', columns, gap);
  return {
    width,
    towers: figure.map(([x, y], index) => ({
      x,
      y,
      blocks: skylineTower(x, y, baseline, width, ceiling, index),
    })),
  };
};

/**
 * The pieces, laid out exactly as the single path lays them out.
 *
 * Empty for a form that has none — a line, a curve, a contour — which is the
 * renderer's cue to take the path instead.
 */
export const createGraphPieces = (
  points: readonly Projected[],
  style: GraphStyle,
  baseline: number,
  columns?: number,
  gap = 0,
  ceiling = 0,
): IGraphPiece[] => {
  const build = PIECE_BUILDERS[style];
  if (!build || points.length < 2) {
    return [];
  }
  const { figure, width } = pieceLayout(points, style, columns, gap);
  const depth = Math.max(1, baseline - ceiling);
  return figure.map(([x, y], index) => ({
    d: build(x, y, baseline, width, ceiling, index, figure.length),
    across: figure.length > 1 ? index / (figure.length - 1) : 0,
    energy: Math.max(0, Math.min(1, (baseline - y) / depth)),
  }));
};
