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

import { GraphStyle, Projected, rect } from './graphStyles';
import toColumns from './graphColumns';

// The small figures the graph's forms are drawn from: a bucket's troughs,
// the line that joins marks, the scatter, the polylines and the slope
// arrows.

/**
 * The other end of each bucket: its QUIETEST point.
 *
 * `toColumns` keeps the peak, which is the honest summary of a band and is
 * what every form is drawn from. The information it discards is how even
 * the band was, and one form is built to show exactly that — so the floor
 * of each bucket is collected here, by the same bucketing arithmetic, and
 * the two agree about where a bucket starts and ends by construction.
 *
 * `passthrough` is for when there were fewer points than columns and
 * `toColumns` handed its input straight back: bucketing did not happen, so
 * every point is its own bucket and its trough is itself.
 */
const toColumnTroughs = (
  points: readonly Projected[],
  count: number,
  passthrough: boolean,
): number[] => {
  if (passthrough) {
    return points.map(([, y]) => y);
  }
  const perColumn = points.length / count;
  const troughs: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const from = Math.floor(index * perColumn);
    const to = Math.max(from + 1, Math.floor((index + 1) * perColumn));
    // Largest y is the quietest: the axis grows downward in pixels.
    let [, trough] = points[from];
    for (let at = from + 1; at < to; at += 1) {
      if (points[at][1] > trough) {
        [, trough] = points[at];
      }
    }
    troughs.push(trough);
  }
  return troughs;
};

/** Keep each band's peak prominent and its measured floor smaller and quieter. */
export const canConnectGraphMarks = (style: GraphStyle): boolean =>
  ['dots', 'scatter', 'stems', 'dashes', 'caps'].includes(style);

/** A closed narrow ribbon stays visible with either fill or stroke enabled. */
export const createGraphConnector = (
  figure: readonly Projected[],
  thread = 0.8,
): string => {
  let path = '';
  for (let index = 1; index < figure.length; index += 1) {
    const [ax, ay] = figure[index - 1];
    const [bx, by] = figure[index];
    const length = Math.max(0.001, Math.hypot(bx - ax, by - ay));
    const nx = (-(by - ay) / length) * thread;
    const ny = ((bx - ax) / length) * thread;
    path += `M ${(ax + nx).toFixed(2)},${(ay + ny).toFixed(2)} L ${(bx + nx).toFixed(2)},${(by + ny).toFixed(2)} L ${(bx - nx).toFixed(2)},${(by - ny).toFixed(2)} L ${(ax - nx).toFixed(2)},${(ay - ny).toFixed(2)} Z`;
  }
  return path;
};

export const createGraphScatter = (
  points: readonly Projected[],
  columns: number,
  gap: number,
) => {
  const bands = toColumns(points, columns);
  if (bands.length < 2) {
    return { primary: '', secondary: '', shape: '', satellites: [] };
  }
  const spacing =
    (bands[bands.length - 1][0] - bands[0][0]) / (bands.length - 1);
  const size = Math.max(1.4, spacing * (1 - gap));
  const small = size * 0.58;
  const troughs = toColumnTroughs(points, bands.length, bands === points);
  let primary = '';
  let secondary = '';
  const satellites: { x: number; y: number; size: number; crest: number }[] =
    [];
  bands.forEach(([x, y], index) => {
    primary += rect(x - size / 2, y - size / 2, size, size);
    // Merge a narrow spread into one mark; duplicated overlapping squares
    // made quiet bands look heavier than loud, clearly separated pairs.
    if (troughs[index] - y > size) {
      satellites.push({ x, y: troughs[index], size: small, crest: y });
      secondary += rect(
        x - small / 2,
        troughs[index] - small / 2,
        small,
        small,
      );
    }
  });
  return { primary, secondary, shape: primary + secondary, satellites };
};

/**
 * The same list of points, rounded off.
 *
 * Quadratic Beziers between the midpoints: each point becomes the control of
 * a segment whose ends are the midpoints to its neighbours, so the curve
 * visits those midpoints and every per-point corner rounds away. The
 * technique the titlebar's own shapes use, for the same reason — a figure
 * built from alternating offsets is a saw when its corners are kept and a
 * thread when they are not.
 */
export const smoothPolyline = (points: readonly Projected[]): string => {
  if (points.length < 3) {
    return polyline(points);
  }
  const [firstX, firstY] = points[0];
  let d = `M ${firstX.toFixed(1)},${firstY.toFixed(1)}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const [px, py] = points[index];
    const [nx, ny] = points[index + 1];
    d += ` Q ${px.toFixed(1)},${py.toFixed(1)} ${((px + nx) / 2).toFixed(
      1,
    )},${((py + ny) / 2).toFixed(1)}`;
  }
  const [lastX, lastY] = points[points.length - 1];
  d += ` L ${lastX.toFixed(1)},${lastY.toFixed(1)}`;
  return d;
};

export const polyline = (points: readonly Projected[]) =>
  `M ${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ')}`;

/** One of the slope's arrows: where it stands and which way it points. */
export interface ISlopeArrow {
  x: number;
  y: number;
  ux: number;
  uy: number;
}

/**
 * The slope's arrows, one on each point of `figure`: a tick `length` long
 * lying along the local gradient, with a head `wing` deep at its tip whose
 * barbs stand `spread` of that out to each side. What the path below and
 * the engine's slope (`engineLooks/designed/slopeLook.ts`) both draw.
 */
export const slopeArrows = (figure: readonly Projected[], gap: number) => {
  const span = figure[figure.length - 1][0] - figure[0][0];
  const step = Math.max(1, span / (figure.length - 1));
  const length = Math.max(6, step * (1 - Math.max(0, Math.min(0.85, gap))));
  const arrows: ISlopeArrow[] = figure.map(([x, y], index) => {
    // A wider neighbourhood steadies each direction through narrow FFT
    // spikes, while its centre still reports the actual band level.
    const before = figure[Math.max(0, index - 2)];
    const after = figure[Math.min(figure.length - 1, index + 2)];
    const runX = after[0] - before[0] || 1;
    const runY = after[1] - before[1];
    const norm = Math.hypot(runX, runY) || 1;
    return { x, y, ux: runX / norm, uy: runY / norm };
  });
  return { length, wing: Math.min(3.5, length * 0.2), spread: 0.65, arrows };
};
