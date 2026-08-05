/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

/**
 * Ten ways to draw the live spectrum across the response graph.
 *
 * Same rule as the titlebar meter's styles: every one is a single path, so
 * choosing a style changes the picture without adding or removing a single
 * element. Bars are rectangles as subpaths, dots are little squares, and the
 * element that draws them is the element that was already there.
 *
 * These take points already projected into pixels, because the graph's axes
 * are logarithmic in x and decibel in y — doing the geometry in data space and
 * projecting afterwards would put curves through the wrong places entirely.
 */

export type GraphStyle =
  | 'line'
  | 'area'
  | 'bars'
  | 'comb'
  | 'dots'
  | 'steps'
  | 'blocks'
  | 'spikes'
  | 'mirror'
  | 'ridge';

/** In cycle order. */
export const GRAPH_STYLES: GraphStyle[] = [
  'line',
  'area',
  'bars',
  'comb',
  'dots',
  'steps',
  'blocks',
  'spikes',
  'mirror',
  'ridge',
];

export const nextGraphStyle = (style: GraphStyle): GraphStyle => {
  const index = GRAPH_STYLES.indexOf(style);
  return GRAPH_STYLES[(index + 1) % GRAPH_STYLES.length] ?? 'line';
};

/** Whether a style is painted rather than stroked, so the caller can say so. */
export const isFilledGraphStyle = (style: GraphStyle): boolean =>
  style !== 'line' && style !== 'comb' && style !== 'steps';

/** A point already in pixels. */
export type Projected = readonly [number, number];

const rect = (x: number, y: number, width: number, height: number) =>
  `M ${x.toFixed(1)},${y.toFixed(1)} h ${width.toFixed(1)} v ${height.toFixed(
    1,
  )} h ${(-width).toFixed(1)} Z`;

/**
 * How many columns the discrete styles get.
 *
 * The live curve carries 320 points, which is right for a curve and wrong for
 * bars twice over. It is slow — 320 rectangles is a path string several times
 * longer than the polyline it replaces, rebuilt on every animation frame — and
 * it does not even look like bars, because at that density they touch and read
 * as a filled area with a ragged top.
 *
 * Sixty-four is about the width of a finger on this pane: individually visible,
 * and a fifth of the string to build.
 */
const COLUMN_COUNT = 64;

/**
 * Reduce to one column per bucket, keeping the PEAK rather than the average.
 *
 * A spectrum is read for where the energy is, and averaging a narrow spike
 * with its quiet neighbours is how a real peak turns into a bump that is not
 * there. The loudest point in the bucket is the honest summary.
 */
const toColumns = (points: readonly Projected[]): Projected[] => {
  if (points.length <= COLUMN_COUNT) {
    return points as Projected[];
  }
  const perColumn = points.length / COLUMN_COUNT;
  const columns: Projected[] = [];
  for (let index = 0; index < COLUMN_COUNT; index += 1) {
    const from = Math.floor(index * perColumn);
    const to = Math.max(from + 1, Math.floor((index + 1) * perColumn));
    // Smallest y is the tallest bar: the axis grows downward in pixels.
    let peak = points[from];
    for (let at = from + 1; at < to; at += 1) {
      if (points[at][1] < peak[1]) {
        peak = points[at];
      }
    }
    columns.push(peak);
  }
  return columns;
};

const polyline = (points: readonly Projected[]) =>
  `M ${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ')}`;

/**
 * One path for the whole spectrum.
 *
 * `baseline` is the pixel row the bars and fills sit on — the bottom of the
 * plot, not zero decibels, because a spectrum hangs from its own level rather
 * than straddling a midpoint the way a waveform does.
 */
export const createGraphShape = (
  points: readonly Projected[],
  style: GraphStyle,
  baseline: number,
): string => {
  if (points.length < 2) {
    return '';
  }
  // Bars, dots, spikes and blocks are drawn per column; a line, an area or a
  // staircase is a single polyline and keeps the full resolution, which costs
  // nothing extra and reads better.
  const isDiscrete =
    style === 'bars' ||
    style === 'dots' ||
    style === 'spikes' ||
    style === 'blocks' ||
    style === 'comb';
  const figure = isDiscrete ? toColumns(points) : points;
  // Average spacing rather than per-pair, because the x axis is logarithmic:
  // a bar sized by the gap to its own neighbour would be hair-thin at 20Hz and
  // a slab at 20kHz.
  const span = figure[figure.length - 1][0] - figure[0][0];
  const step = Math.max(1, span / (figure.length - 1));

  switch (style) {
    case 'line':
      return polyline(points);

    case 'area':
    case 'ridge': {
      const first = points[0];
      const last = points[points.length - 1];
      return `${polyline(points)} L ${last[0].toFixed(1)},${baseline.toFixed(
        1,
      )} L ${first[0].toFixed(1)},${baseline.toFixed(1)} Z`;
    }

    case 'bars': {
      const width = Math.max(1, step * 0.62);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path += rect(x - width / 2, y, width, Math.max(0, baseline - y));
      }
      return path;
    }

    case 'comb': {
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path += `M ${x.toFixed(1)},${baseline.toFixed(1)} L ${x.toFixed(
          1,
        )},${y.toFixed(1)} `;
      }
      return path.trim();
    }

    case 'dots': {
      const size = Math.max(1.6, step * 0.5);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path += rect(x - size / 2, y - size / 2, size, size);
      }
      return path;
    }

    // A staircase, which is what a spectrum actually is before anyone draws a
    // curve through it — one level per band of frequency, not a continuum.
    case 'steps': {
      let path = `M ${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
      for (let index = 1; index < points.length; index += 1) {
        const [x, y] = points[index];
        path += ` H ${x.toFixed(1)} V ${y.toFixed(1)}`;
      }
      return path;
    }

    case 'blocks': {
      const width = Math.max(1, step * 0.62);
      // Taller segments than the meter uses: this pane is far deeper, and a
      // seven-pixel ladder over it is hundreds of rectangles per column.
      const segment = 11;
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const height = Math.max(0, baseline - y);
        const lit = Math.floor(height / segment);
        for (let level = 0; level < lit; level += 1) {
          path += rect(
            x - width / 2,
            baseline - (level + 1) * segment + 1,
            width,
            segment - 2,
          );
        }
      }
      return path;
    }

    case 'spikes': {
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const half = step * 0.55;
        path += `M ${(x - half).toFixed(1)},${baseline.toFixed(
          1,
        )} L ${x.toFixed(1)},${y.toFixed(1)} L ${(x + half).toFixed(
          1,
        )},${baseline.toFixed(1)} Z`;
      }
      return path;
    }

    // Reflected about its own middle, so the spectrum reads as a solid body
    // rather than as a horizon over empty space.
    case 'mirror': {
      const centre =
        points.reduce((total, [, y]) => total + y, 0) / points.length;
      const upper = points.map(
        ([x, y]) => [x, centre - (centre - y) * 0.5] as Projected,
      );
      const lower = points.map(
        ([x, y]) => [x, centre + (centre - y) * 0.5] as Projected,
      );
      return `${polyline(upper)} L ${[...lower]
        .reverse()
        .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
        .join(' L ')} Z`;
    }

    default:
      return polyline(points);
  }
};
