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
  | 'ridge'
  | 'stems'
  | 'needles'
  | 'terrace'
  | 'dashes'
  | 'scatter'
  | 'caps'
  | 'ribs'
  | 'pillars'
  | 'crown'
  | 'weave'
  | 'contour'
  | 'hatch'
  | 'matrix'
  | 'skyline'
  | 'bezier'
  | 'ribbon'
  | 'feather'
  | 'truss'
  | 'zipper'
  | 'slope'
  | 'islands'
  | 'stalactites'
  | 'bubbles'
  | 'diamonds'
  | 'chevrons'
  | 'sawtooth'
  | 'ecg'
  | 'arcs'
  | 'rain'
  | 'echo';

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
  'stems',
  'needles',
  'terrace',
  'dashes',
  'scatter',
  'caps',
  'ribs',
  'pillars',
  'crown',
  'weave',
  'contour',
  'hatch',
  'matrix',
  'skyline',
  'bezier',
  'ribbon',
  'feather',
  'truss',
  'zipper',
  'slope',
  'islands',
  'stalactites',
  'bubbles',
  'diamonds',
  'chevrons',
  'sawtooth',
  'ecg',
  'arcs',
  'rain',
  'echo',
];

/**
 * Human names for the picker.
 *
 * Written out rather than generated from the key, because "mirror" and
 * "terrace" mean nothing on their own — the list is chosen by eye and the
 * label is what somebody searches.
 */
export const GRAPH_STYLE_LABELS: Record<GraphStyle, string> = {
  line: 'Line',
  area: 'Area',
  bars: 'Bars',
  comb: 'Comb',
  dots: 'Dots',
  steps: 'Staircase',
  blocks: 'LED blocks',
  spikes: 'Spikes',
  mirror: 'Mirrored body',
  ridge: 'Ridge',
  stems: 'Stems',
  needles: 'Needles',
  terrace: 'Terrace',
  dashes: 'Dashes',
  scatter: 'Scatter',
  caps: 'Floating caps',
  ribs: 'Ribs',
  pillars: 'Pillars',
  crown: 'Crown',
  weave: 'Weave',
  contour: 'Topography',
  hatch: 'Hatching',
  matrix: 'Dot matrix',
  skyline: 'Skyline',
  bezier: 'Silk',
  ribbon: 'Ribbon',
  feather: 'Feather',
  truss: 'Truss',
  zipper: 'Zipper',
  slope: 'Slope field',
  islands: 'Islands',
  stalactites: 'Stalactites',
  bubbles: 'Bubbles',
  diamonds: 'Diamonds',
  chevrons: 'Chevrons',
  sawtooth: 'Sawtooth',
  ecg: 'Pulse',
  arcs: 'Arcs',
  rain: 'Rainfall',
  echo: 'Echo',
};

export const nextGraphStyle = (style: GraphStyle): GraphStyle => {
  const index = GRAPH_STYLES.indexOf(style);
  return GRAPH_STYLES[(index + 1) % GRAPH_STYLES.length] ?? 'line';
};

/** Whether a style is painted rather than stroked, so the caller can say so. */
const STROKED_STYLES = new Set<GraphStyle>([
  'line',
  'comb',
  'steps',
  'needles',
  'dashes',
  'ribs',
  'weave',
  'contour',
  'hatch',
  'bezier',
  'feather',
  'truss',
  'zipper',
  'slope',
  'chevrons',
  'ecg',
  'arcs',
  'rain',
  'echo',
]);

export const isFilledGraphStyle = (style: GraphStyle): boolean =>
  !STROKED_STYLES.has(style);

/**
 * How a form is coloured, which is the second half of what makes a look.
 *
 * Kept separate from the shape rather than written into it, because the two
 * are genuinely independent — every form reads differently in the signal
 * colour and in the spectrum, and pairing them as forty flat entries would
 * mean forty pieces of geometry where twenty and a flag will do.
 *
 * `signal` is the trace's own colour, one hue for the whole figure. `rainbow`
 * runs the spectrum across the frequency axis, so a bar's colour says where in
 * the range it sits.
 */
export type GraphPalette = 'signal' | 'rainbow';

export const GRAPH_PALETTES: GraphPalette[] = ['signal', 'rainbow'];

export const GRAPH_PALETTE_LABELS: Record<GraphPalette, string> = {
  signal: '',
  rainbow: 'rainbow',
};

/** One selectable look: a form and how it is coloured. */
export interface IGraphLook {
  id: string;
  style: GraphStyle;
  palette: GraphPalette;
  label: string;
}

/**
 * Every combination, in a stable order.
 *
 * Generated rather than listed, so adding a form adds its whole row and no
 * entry can be forgotten or duplicated.
 */
export const GRAPH_LOOKS: IGraphLook[] = GRAPH_STYLES.flatMap((style) =>
  GRAPH_PALETTES.map((palette) => ({
    id: palette === 'signal' ? style : `${style}-${palette}`,
    style,
    palette,
    label: [GRAPH_STYLE_LABELS[style], GRAPH_PALETTE_LABELS[palette]]
      .filter(Boolean)
      .join(' · '),
  })),
);

export const getGraphLook = (id: string): IGraphLook =>
  GRAPH_LOOKS.find((look) => look.id === id) ?? GRAPH_LOOKS[0];

/**
 * How each form moves.
 *
 * A form is not only a shape — the same spectrum reads completely differently
 * depending on how quickly the drawing chases it, and matching the motion to
 * the figure is most of what makes one look interesting rather than merely
 * different.
 *
 * Bars and blocks snap and hang, the way a level meter does, so a kick lands
 * as a step rather than a swell. A ridge or a mirrored body is a landscape and
 * moves like one, slowly, because a hill that twitches is noise. Dots and
 * caps float — quick to rise so they mark the peak, slow to fall so the mark
 * stays long enough to read. Needles and combs are nearly instantaneous, which
 * is the whole point of a form that thin.
 *
 * In milliseconds to halve the remaining distance.
 */
export interface IGraphBallistics {
  attackMs: number;
  releaseMs: number;
}

const DEFAULT_BALLISTICS: IGraphBallistics = { attackMs: 8, releaseMs: 28 };

const BALLISTICS: Partial<Record<GraphStyle, IGraphBallistics>> = {
  // Snap up, hang, drop away — a meter's manners.
  bars: { attackMs: 4, releaseMs: 45 },
  pillars: { attackMs: 4, releaseMs: 45 },
  blocks: { attackMs: 3, releaseMs: 60 },
  // Peak marks: they exist to be caught, so they fall slowly enough to see.
  caps: { attackMs: 2, releaseMs: 110 },
  dots: { attackMs: 5, releaseMs: 70 },
  scatter: { attackMs: 5, releaseMs: 70 },
  dashes: { attackMs: 4, releaseMs: 85 },
  // Thin forms can afford to be instant; there is no mass to them.
  needles: { attackMs: 2, releaseMs: 14 },
  comb: { attackMs: 2, releaseMs: 16 },
  ribs: { attackMs: 3, releaseMs: 30 },
  stems: { attackMs: 4, releaseMs: 40 },
  spikes: { attackMs: 3, releaseMs: 22 },
  crown: { attackMs: 4, releaseMs: 36 },
  // Landscapes. A hill that twitches is noise, so these are the slow ones.
  ridge: { attackMs: 22, releaseMs: 90 },
  mirror: { attackMs: 20, releaseMs: 80 },
  terrace: { attackMs: 16, releaseMs: 70 },
  area: { attackMs: 12, releaseMs: 48 },
  // The staircase steps by nature; easing it hard would blur the treads.
  steps: { attackMs: 6, releaseMs: 26 },
  weave: { attackMs: 6, releaseMs: 30 },

  // More landscapes. Contours and islands are drawn from where the level
  // crosses a threshold, so a jittery curve makes rings pop in and out of
  // existence — these are the slowest things here on purpose.
  contour: { attackMs: 26, releaseMs: 95 },
  islands: { attackMs: 28, releaseMs: 100 },
  hatch: { attackMs: 18, releaseMs: 70 },
  bezier: { attackMs: 16, releaseMs: 55 },
  ribbon: { attackMs: 11, releaseMs: 46 },
  echo: { attackMs: 7, releaseMs: 140 },

  // Architecture. Buildings do not sway, so these are stiff going up and slow
  // coming down — the skyline should look built, not blown about.
  skyline: { attackMs: 5, releaseMs: 72 },
  truss: { attackMs: 7, releaseMs: 32 },
  matrix: { attackMs: 3, releaseMs: 66 },
  chevrons: { attackMs: 3, releaseMs: 56 },
  sawtooth: { attackMs: 4, releaseMs: 40 },
  arcs: { attackMs: 5, releaseMs: 52 },

  // Things that hang, fall or float have gravity in them: quick to appear,
  // reluctant to leave.
  stalactites: { attackMs: 9, releaseMs: 120 },
  bubbles: { attackMs: 3, releaseMs: 92 },
  diamonds: { attackMs: 4, releaseMs: 78 },
  rain: { attackMs: 4, releaseMs: 105 },

  // The pulse is a heartbeat. One that arrives late is not a heartbeat, so it
  // is the fastest of the lot in both directions.
  ecg: { attackMs: 1, releaseMs: 12 },
  // A slope field draws the direction the spectrum is moving in. Smooth it and
  // it starts pointing at where the music was, which is worse than useless.
  slope: { attackMs: 3, releaseMs: 18 },
  feather: { attackMs: 4, releaseMs: 34 },
  zipper: { attackMs: 4, releaseMs: 26 },
};

export const getGraphBallistics = (style: GraphStyle): IGraphBallistics =>
  BALLISTICS[style] ?? DEFAULT_BALLISTICS;

/** A point already in pixels. */
export type Projected = readonly [number, number];

const rect = (x: number, y: number, width: number, height: number) =>
  `M ${x.toFixed(1)},${y.toFixed(1)} h ${width.toFixed(1)} v ${height.toFixed(
    1,
  )} h ${(-width).toFixed(1)} Z`;

/**
 * The same rectangle wound the other way round, which makes it a hole.
 *
 * Under the non-zero fill rule a subpath that runs counter to the shape it sits
 * inside cancels it out rather than painting over it, so a window punched this
 * way shows the chart behind the building rather than a darker patch of
 * building. Written as a separate helper because the only difference is the
 * order of the sides, and that is exactly the kind of detail that gets
 * "tidied" back into `rect` by someone who has not seen what it does.
 */
const hole = (x: number, y: number, width: number, height: number) =>
  `M ${x.toFixed(1)},${y.toFixed(1)} v ${height.toFixed(1)} h ${width.toFixed(
    1,
  )} v ${(-height).toFixed(1)} Z`;

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
 * Forms that want a different density.
 *
 * Sixty-four is right for bars and far too many for buildings: a skyline of
 * sixty-four towers is a fence. Anything that stacks pieces up its column also
 * has to be counted twice over — a chevron every ten pixels across sixty-four
 * columns is two thousand marks in one path string, rebuilt every frame — so
 * the ornate forms are given fewer, larger columns and the sparse ones more.
 */
const COLUMN_OVERRIDES: Partial<Record<GraphStyle, number>> = {
  skyline: 26,
  truss: 22,
  ecg: 26,
  chevrons: 24,
  arcs: 34,
  matrix: 40,
  bubbles: 40,
  zipper: 40,
  sawtooth: 40,
  feather: 44,
  slope: 44,
  rain: 48,
  diamonds: 48,
  stalactites: 52,
};

const getColumnCount = (style: GraphStyle) =>
  COLUMN_OVERRIDES[style] ?? COLUMN_COUNT;

/** The forms drawn one piece per column rather than as a continuous figure. */
const DISCRETE_STYLES = new Set<GraphStyle>([
  'bars',
  'comb',
  'dots',
  'blocks',
  'spikes',
  'stems',
  'needles',
  'dashes',
  'scatter',
  'caps',
  'ribs',
  'pillars',
  'crown',
  'matrix',
  'skyline',
  'feather',
  'truss',
  'zipper',
  'slope',
  'stalactites',
  'bubbles',
  'diamonds',
  'chevrons',
  'sawtooth',
  'ecg',
  'arcs',
  'rain',
]);

/**
 * Reduce to one column per bucket, keeping the PEAK rather than the average.
 *
 * A spectrum is read for where the energy is, and averaging a narrow spike
 * with its quiet neighbours is how a real peak turns into a bump that is not
 * there. The loudest point in the bucket is the honest summary.
 */
const toColumns = (
  points: readonly Projected[],
  count: number,
): Projected[] => {
  if (points.length <= count) {
    return points as Projected[];
  }
  const perColumn = points.length / count;
  const columns: Projected[] = [];
  for (let index = 0; index < count; index += 1) {
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
  const isDiscrete = DISCRETE_STYLES.has(style);
  const figure = isDiscrete ? toColumns(points, getColumnCount(style)) : points;
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

    // A dot on the peak with a thread down to the floor.
    case 'stems': {
      const size = Math.max(1.8, step * 0.42);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path += rect(x - 0.6, y, 1.2, Math.max(0, baseline - y));
        path += rect(x - size / 2, y - size / 2, size, size);
      }
      return path;
    }

    // Hair-thin verticals: the same information as bars, with air between.
    case 'needles': {
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path += `M ${x.toFixed(1)},${baseline.toFixed(1)} L ${x.toFixed(
          1,
        )},${y.toFixed(1)} `;
      }
      return path.trim();
    }

    // The staircase, filled — levels rather than a slope.
    case 'terrace': {
      let path = `M ${figure[0][0].toFixed(1)},${baseline.toFixed(1)}`;
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path += ` V ${y.toFixed(1)} H ${(x + step).toFixed(1)}`;
      }
      return `${path} V ${baseline.toFixed(1)} Z`;
    }

    // Just the tops, floating where the level is.
    case 'dashes': {
      const width = Math.max(2, step * 0.7);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path += `M ${(x - width / 2).toFixed(1)},${y.toFixed(1)} h ${width.toFixed(
          1,
        )} `;
      }
      return path.trim();
    }

    // Two marks per column: the level, and half way down to it.
    case 'scatter': {
      const size = Math.max(1.4, step * 0.34);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const half = y + (baseline - y) * 0.5;
        path += rect(x - size / 2, y - size / 2, size, size);
        path += rect(x - size / 2, half - size / 2, size, size);
      }
      return path;
    }

    // A cap hovering above an empty column, the way a peak-hold reads.
    case 'caps': {
      const width = Math.max(2, step * 0.66);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path += rect(x - width / 2, y, width, 3);
      }
      return path;
    }

    // Horizontal rungs stacked up each column.
    case 'ribs': {
      const width = Math.max(2, step * 0.66);
      const gap = 9;
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        for (let at = baseline; at > y; at -= gap) {
          path += `M ${(x - width / 2).toFixed(1)},${at.toFixed(
            1,
          )} h ${width.toFixed(1)} `;
        }
      }
      return path.trim();
    }

    // Wide columns with no gap, so the spectrum reads as a solid skyline.
    case 'pillars': {
      const width = Math.max(1, step * 0.96);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path += rect(x - width / 2, y, width, Math.max(0, baseline - y));
      }
      return path;
    }

    // Tapered towers: wide at the floor, narrow at the peak.
    case 'crown': {
      const width = Math.max(2, step * 0.8);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path += `M ${(x - width / 2).toFixed(1)},${baseline.toFixed(
          1,
        )} L ${(x - width / 6).toFixed(1)},${y.toFixed(1)} L ${(
          x +
          width / 6
        ).toFixed(1)},${y.toFixed(1)} L ${(x + width / 2).toFixed(
          1,
        )},${baseline.toFixed(1)} Z`;
      }
      return path;
    }

    // A contour map of the spectrum.
    //
    // Instead of drawing where the level is, this draws the frequency ranges
    // that are louder than each of a series of thresholds — the same trick an
    // Ordnance Survey map uses for a hill. Loud regions end up ringed by
    // stacked lines; quiet ones are bare. It reads nothing like a curve, and it
    // is very good at showing how wide a peak is rather than only how tall.
    case 'contour': {
      const spacing = 16;
      const ceiling = points.reduce((min, [, y]) => Math.min(min, y), Infinity);
      const rightEdge = points[points.length - 1][0];
      let path = '';
      for (let level = baseline - spacing; level > ceiling; level -= spacing) {
        let from: number | undefined;
        for (let index = 0; index < points.length; index += 1) {
          const [x, y] = points[index];
          if (y <= level && from === undefined) {
            from = x;
          } else if (y > level && from !== undefined) {
            path += `M ${from.toFixed(1)},${level.toFixed(1)} H ${x.toFixed(1)} `;
            from = undefined;
          }
        }
        if (from !== undefined) {
          path += `M ${from.toFixed(1)},${level.toFixed(
            1,
          )} H ${rightEdge.toFixed(1)} `;
        }
      }
      // Nothing clears the first threshold when the signal is at the floor.
      // The outline is still the truth, so fall back to it rather than
      // blanking the trace, which looks like the capture having died.
      return path.trim() || polyline(points);
    }

    // The area under the curve, shaded rather than painted.
    //
    // Diagonals at 45°, clipped to the region below the trace, plus the trace
    // itself. A solid fill says "there is energy here"; hatching says the same
    // thing while leaving the grid and the EQ curves behind it legible, which
    // on a chart with four other lines on it is the difference between a
    // reading and a wall.
    case 'hatch': {
      const left = points[0][0];
      const right = points[points.length - 1][0];
      const ceiling = points.reduce((min, [, y]) => Math.min(min, y), Infinity);
      const span = Math.max(1, right - left);
      // Indexed by proportion rather than searched: the projection is even in
      // pixels because the source is even in log frequency.
      const heightAt = (x: number) => {
        const at = Math.round(((x - left) / span) * (points.length - 1));
        return points[Math.min(points.length - 1, Math.max(0, at))][1];
      };
      const spacing = 15;
      const stepY = 4;
      let path = polyline(points);
      for (let offset = left - baseline; offset < right; offset += spacing) {
        let from: number | undefined;
        for (let y = ceiling; y <= baseline; y += stepY) {
          const x = y + offset;
          const inside = x >= left && x <= right && y >= heightAt(x);
          if (inside && from === undefined) {
            from = y;
          } else if (!inside && from !== undefined) {
            path += ` M ${(from + offset).toFixed(1)},${from.toFixed(
              1,
            )} L ${(y + offset).toFixed(1)},${y.toFixed(1)}`;
            from = undefined;
          }
        }
        if (from !== undefined) {
          path += ` M ${(from + offset).toFixed(1)},${from.toFixed(1)} L ${(
            baseline + offset
          ).toFixed(1)},${baseline.toFixed(1)}`;
        }
      }
      return path;
    }

    // A departure board. Small squares on a fixed grid, lit up each column as
    // far as the level reaches — so the picture is quantised in both
    // directions and the eye counts rows instead of measuring heights.
    case 'matrix': {
      const size = Math.max(1.5, step * 0.36);
      const cell = 13;
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        for (let at = baseline - cell / 2; at > y; at -= cell) {
          path += rect(x - size / 2, at - size / 2, size, size);
        }
      }
      return path;
    }

    // Buildings, with the lights on.
    //
    // Wide towers with windows punched out of them — the holes wind the other
    // way round, so the fill rule cuts them rather than painting them over.
    // Fewer, fatter columns than the bars use: sixty-four skyscrapers is a
    // fence, and the point is that you can tell one building from the next.
    case 'skyline': {
      const width = Math.max(4, step * 0.88);
      const pane = Math.max(1.4, width * 0.16);
      const floorHeight = 17;
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path += rect(x - width / 2, y, width, Math.max(0, baseline - y));
        for (
          let floor = baseline - floorHeight;
          floor > y + floorHeight * 0.7;
          floor -= floorHeight
        ) {
          for (let column = -1; column <= 1; column += 2) {
            path += hole(
              x + column * width * 0.22 - pane / 2,
              floor - pane / 2,
              pane,
              pane,
            );
          }
        }
      }
      return path;
    }

    // The same data with the corners taken off: a Catmull-Rom spline through
    // every fourth point. A spectrum is spiky by nature and the line style is
    // honest about it; this one is the opposite choice, and on slow music it
    // reads like something poured rather than plotted.
    case 'bezier': {
      const knots = points.filter(
        (_point, index) => index % 4 === 0 || index === points.length - 1,
      );
      if (knots.length < 2) {
        return polyline(points);
      }
      let path = `M ${knots[0][0].toFixed(1)},${knots[0][1].toFixed(1)}`;
      for (let index = 0; index < knots.length - 1; index += 1) {
        const before = knots[Math.max(0, index - 1)];
        const from = knots[index];
        const to = knots[index + 1];
        const after = knots[Math.min(knots.length - 1, index + 2)];
        path += ` C ${(from[0] + (to[0] - before[0]) / 6).toFixed(1)},${(
          from[1] +
          (to[1] - before[1]) / 6
        ).toFixed(1)} ${(to[0] - (after[0] - from[0]) / 6).toFixed(1)},${(
          to[1] -
          (after[1] - from[1]) / 6
        ).toFixed(1)} ${to[0].toFixed(1)},${to[1].toFixed(1)}`;
      }
      return path;
    }

    // A band that swells where the signal is strong.
    //
    // The curve carries its own weight: thickness is the level, so a loud
    // region is a fat stripe and a quiet one thins to a thread. Height and
    // width say the same thing twice, which sounds redundant and is in fact
    // why it reads so quickly.
    case 'ribbon': {
      const upper: Projected[] = [];
      const lower: Projected[] = [];
      for (let index = 0; index < points.length; index += 1) {
        const [x, y] = points[index];
        const half = 1.5 + Math.min(15, Math.max(0, baseline - y) * 0.075);
        upper.push([x, y - half]);
        lower.push([x, y + half]);
      }
      return `${polyline(upper)} L ${[...lower]
        .reverse()
        .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
        .join(' L ')} Z`;
    }

    // A quill laid along the peaks: a spine, with barbs swept back off both
    // sides of it, longer where the signal is louder.
    case 'feather': {
      let path = polyline(figure);
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const length = 3 + Math.max(0, baseline - y) * 0.12;
        const back = (x - length * 0.5).toFixed(1);
        path += ` M ${x.toFixed(1)},${y.toFixed(1)} L ${back},${(
          y - length
        ).toFixed(1)} M ${x.toFixed(1)},${y.toFixed(1)} L ${back},${(
          y + length
        ).toFixed(1)}`;
      }
      return path;
    }

    // A bridge. Top chord along the peaks, bottom chord on the floor, and a
    // cross-brace in every bay — the spectrum drawn as the thing that would
    // have to be built to hold it up.
    case 'truss': {
      const rightEdge = figure[figure.length - 1][0];
      let path = `${polyline(figure)} M ${figure[0][0].toFixed(
        1,
      )},${baseline.toFixed(1)} H ${rightEdge.toFixed(1)}`;
      for (let index = 0; index < figure.length - 1; index += 1) {
        const [x, y] = figure[index];
        const [nextX, nextY] = figure[index + 1];
        path += ` M ${x.toFixed(1)},${y.toFixed(1)} L ${nextX.toFixed(
          1,
        )},${baseline.toFixed(1)} M ${nextX.toFixed(1)},${nextY.toFixed(
          1,
        )} L ${x.toFixed(1)},${baseline.toFixed(1)}`;
      }
      return path;
    }

    // Two rails astride the curve with teeth reaching alternately across the
    // gap between them, meeting just past the middle. Closed when the signal
    // is steady; it visibly gapes where the spectrum jumps.
    case 'zipper': {
      const rail = 8;
      const upper = figure.map(([x, y]) => [x, y - rail] as Projected);
      const lower = figure.map(([x, y]) => [x, y + rail] as Projected);
      let path = `${polyline(upper)} ${polyline(lower)}`;
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const fromTop = index % 2 === 0;
        path += ` M ${x.toFixed(1)},${(y + (fromTop ? -rail : rail)).toFixed(
          1,
        )} L ${x.toFixed(1)},${(
          y + (fromTop ? rail * 0.3 : -rail * 0.3)
        ).toFixed(1)}`;
      }
      return path;
    }

    // Not where the level is — which way it is going.
    //
    // Each mark is a short tick lying along the local gradient, so the picture
    // is made of directions rather than heights. Flat where the spectrum is
    // even, raked steeply through a crossover, and it makes a slope you would
    // never notice on a curve jump straight out.
    case 'slope': {
      const length = Math.max(6, step * 0.85);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const before = figure[Math.max(0, index - 1)];
        const after = figure[Math.min(figure.length - 1, index + 1)];
        const runX = after[0] - before[0] || 1;
        const runY = after[1] - before[1];
        const norm = Math.hypot(runX, runY) || 1;
        const halfX = (runX / norm) * (length / 2);
        const halfY = (runY / norm) * (length / 2);
        const [x, y] = figure[index];
        path += `M ${(x - halfX).toFixed(1)},${(y - halfY).toFixed(1)} L ${(
          x + halfX
        ).toFixed(1)},${(y + halfY).toFixed(1)} `;
      }
      return path.trim();
    }

    // Only what is above sea level.
    //
    // The waterline is the frame's own average, so the quiet two-thirds of the
    // spectrum simply are not drawn and the loud regions become separate
    // shapes with edges. Turning a continuous reading into a countable number
    // of objects is a genuinely different way to look at it: you stop reading
    // heights and start reading how many, and how wide.
    case 'islands': {
      const waterline =
        points.reduce((total, [, y]) => total + y, 0) / points.length;
      let path = '';
      let run: Projected[] = [];
      const land = () => {
        if (run.length >= 2) {
          path += `${polyline(run)} L ${run[run.length - 1][0].toFixed(
            1,
          )},${waterline.toFixed(1)} L ${run[0][0].toFixed(
            1,
          )},${waterline.toFixed(1)} Z `;
        }
        run = [];
      };
      for (let index = 0; index < points.length; index += 1) {
        if (points[index][1] <= waterline) {
          run.push(points[index]);
        } else {
          land();
        }
      }
      land();
      return (
        path.trim() ||
        `${polyline(points)} L ${points[points.length - 1][0].toFixed(
          1,
        )},${baseline.toFixed(1)} L ${points[0][0].toFixed(
          1,
        )},${baseline.toFixed(1)} Z`
      );
    }

    // Hung from the ceiling rather than stood on the floor. The same numbers,
    // read upside down — loud is long, and the shape grows towards you from
    // the top of the plot instead of away from the bottom.
    case 'stalactites': {
      const width = Math.max(2, step * 0.62);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const length = Math.max(0, baseline - y);
        path += `M ${(x - width / 2).toFixed(1)},0 L ${(x + width / 2).toFixed(
          1,
        )},0 L ${x.toFixed(1)},${length.toFixed(1)} Z`;
      }
      return path;
    }

    // A circle per column, sized by the level and floating at it. Area rather
    // than height does the talking, which flatters the quiet end of the
    // spectrum — a small bubble is still unmistakably there, where a two-pixel
    // bar is not.
    case 'bubbles': {
      const largest = Math.max(2, step * 0.62);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const radius = Math.max(
          0.9,
          Math.min(largest, 1 + Math.max(0, baseline - y) * 0.06),
        );
        const across = (radius * 2).toFixed(1);
        path += `M ${(x - radius).toFixed(1)},${y.toFixed(
          1,
        )} a ${radius.toFixed(1)},${radius.toFixed(
          1,
        )} 0 1,0 ${across},0 a ${radius.toFixed(1)},${radius.toFixed(
          1,
        )} 0 1,0 -${across},0 Z`;
      }
      return path;
    }

    // Gems on the peaks, cut larger where the signal is stronger.
    case 'diamonds': {
      const largest = Math.max(2.5, step * 0.85);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const size = Math.max(
          1.2,
          Math.min(largest, 1.2 + Math.max(0, baseline - y) * 0.055),
        );
        path += `M ${x.toFixed(1)},${(y - size).toFixed(1)} L ${(
          x + size
        ).toFixed(1)},${y.toFixed(1)} L ${x.toFixed(1)},${(y + size).toFixed(
          1,
        )} L ${(x - size).toFixed(1)},${y.toFixed(1)} Z`;
      }
      return path;
    }

    // Stacked arrowheads climbing each column, all pointing up. Reads as
    // motion even when the frame is frozen, which is the trick of it.
    case 'chevrons': {
      const width = Math.max(3, step * 0.72);
      const gap = 14;
      const rise = 5;
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        for (let at = baseline - rise; at > y; at -= gap) {
          path += `M ${(x - width / 2).toFixed(1)},${at.toFixed(
            1,
          )} L ${x.toFixed(1)},${(at - rise).toFixed(1)} L ${(
            x +
            width / 2
          ).toFixed(1)},${at.toFixed(1)} `;
        }
      }
      return path.trim();
    }

    // The waveform the oscillator makes: a slow ramp up to the level and a
    // vertical drop back. Every tooth leans the same way, so the whole figure
    // has a direction to it that a symmetrical bar chart does not.
    case 'sawtooth': {
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path += `M ${(x - step * 0.5).toFixed(1)},${baseline.toFixed(1)} L ${(
          x +
          step * 0.5
        ).toFixed(1)},${y.toFixed(1)} L ${(x + step * 0.5).toFixed(
          1,
        )},${baseline.toFixed(1)} Z`;
      }
      return path;
    }

    // A heart monitor. The trace rests on its own line and deflects once per
    // column — a small dip, a tall spike, a smaller dip, back to rest —
    // instead of tracing the level continuously. Loud bands beat harder.
    case 'ecg': {
      const rest = baseline - 30;
      const width = Math.max(1.5, step * 0.16);
      let path = `M ${figure[0][0].toFixed(1)},${rest.toFixed(1)}`;
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const beat = Math.max(2, (baseline - y) * 0.72);
        path += ` H ${(x - width * 2).toFixed(1)} L ${(x - width).toFixed(
          1,
        )},${(rest + beat * 0.16).toFixed(1)} L ${x.toFixed(1)},${(
          rest - beat
        ).toFixed(1)} L ${(x + width).toFixed(1)},${(
          rest +
          beat * 0.11
        ).toFixed(1)} L ${(x + width * 2).toFixed(1)},${rest.toFixed(1)}`;
      }
      return path;
    }

    // A row of arches standing on the floor, each one as tall as its band. The
    // curvature carries the level as well as the height does, and the gaps
    // between them keep the grid readable.
    case 'arcs': {
      const half = Math.max(2, step * 0.46);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const height = Math.max(1, baseline - y);
        path += `M ${(x - half).toFixed(1)},${baseline.toFixed(
          1,
        )} A ${half.toFixed(1)},${height.toFixed(1)} 0 0,1 ${(x + half).toFixed(
          1,
        )},${baseline.toFixed(1)} `;
      }
      return path.trim();
    }

    // Falling streaks: short dashes down each column, as far up as the level
    // reaches, staggered so neighbouring columns never line up into rows. Loud
    // bands rain harder.
    case 'rain': {
      const gap = 14;
      const dash = 5;
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const stagger = (index % 3) * 5;
        for (let at = baseline - stagger; at > y; at -= gap) {
          path += `M ${x.toFixed(1)},${at.toFixed(1)} v -${dash} `;
        }
      }
      return path.trim();
    }

    // The trace, and three afterimages of it — each arriving a little to the
    // right and standing a little lower, the way a delay repeat comes back
    // late and quieter. Nothing here is remembered between frames; the echoes
    // are the same instant redrawn smaller, which is a picture of decay rather
    // than a recording of it.
    case 'echo': {
      let path = polyline(points);
      for (let copy = 1; copy <= 3; copy += 1) {
        const decay = 1 - copy * 0.26;
        const late = copy * 6;
        path += ` ${polyline(
          points.map(
            ([x, y]) =>
              [x + late, baseline - (baseline - y) * decay] as Projected,
          ),
        )}`;
      }
      return path;
    }

    // A zigzag threading the peaks, alternating above and below each one.
    case 'weave': {
      let path = `M ${figure[0][0].toFixed(1)},${figure[0][1].toFixed(1)}`;
      for (let index = 1; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const swing = index % 2 === 0 ? -6 : 6;
        path += ` L ${x.toFixed(1)},${(y + swing).toFixed(1)}`;
      }
      return path;
    }

    default:
      return polyline(points);
  }
};

/**
 * What, if anything, a form does when a band peaks.
 *
 * Not one effect applied to everything. Most forms get nothing at all: a
 * contour map, a slope field or a bridge truss is already saying something
 * specific, and stapling the same bright dot onto all forty would flatten
 * exactly the variety the forms exist to provide. Only the ones whose shape
 * has an obvious place for it get one, and what they get differs:
 *
 * - `cap`   a bright bar sitting on a flat-topped column, the way a peak-hold
 *          indicator sits on a level meter.
 * - `bead`  a lit dot on the end of something thin. This is the one that was
 *          asked for — a stem with a glowing tip.
 * - `crest` one mark, on the single loudest point of a smooth curve. A curve
 *          has no columns to cap, and a dozen dots on it is a rash; one is a
 *          reading.
 * - `drip`  a bead, but at the hanging end, for the form that grows downward.
 * - `beat`  the R spike of the pulse trace, which is a different point on the
 *          figure entirely from where the level is.
 */
type GraphAccent = 'none' | 'cap' | 'bead' | 'crest' | 'drip' | 'beat';

const ACCENTS: Partial<Record<GraphStyle, GraphAccent>> = {
  bars: 'cap',
  pillars: 'cap',
  blocks: 'cap',
  matrix: 'cap',
  skyline: 'cap',
  stems: 'bead',
  needles: 'bead',
  comb: 'bead',
  spikes: 'bead',
  crown: 'bead',
  line: 'crest',
  bezier: 'crest',
  ridge: 'crest',
  mirror: 'crest',
  stalactites: 'drip',
  ecg: 'beat',
};

/**
 * How loud a peak has to be, against the loudest thing on screen, to be lit.
 *
 * Low enough that a busy mix lights several at once, high enough that quiet
 * passages light nothing rather than picking an arbitrary winner out of the
 * noise floor.
 */
const ACCENT_THRESHOLD = 0.62;

/**
 * A ceiling on how many tips can be lit at once.
 *
 * Without it, a wall of pink noise lights every column and the accent stops
 * meaning "here is the peak" — it becomes a second copy of the drawing, drawn
 * brighter, which is just the drawing with the contrast turned up.
 */
const MAX_ACCENTS = 10;

/**
 * The lit peaks, as a path of their own — for the forms that have them.
 *
 * Drawn separately from the figure so the tips can be lit while the body stays
 * calm: the caller strokes this twice, once thick and faint and once thin and
 * bright, which reads as a glow without a filter anywhere near it. That
 * matters more than it sounds — an SVG filter on a path whose geometry changes
 * every frame re-rasterises its whole region every frame, and this pane learned
 * that lesson expensively.
 *
 * Returns an empty path for most forms, which is the intended answer and not a
 * failure to draw one.
 */
export const createGraphAccent = (
  points: readonly Projected[],
  style: GraphStyle,
  baseline: number,
): string => {
  const accent = ACCENTS[style] ?? 'none';
  if (accent === 'none' || points.length < 3) {
    return '';
  }
  const figure = toColumns(points, getColumnCount(style));
  if (figure.length < 3) {
    return '';
  }
  const span = figure[figure.length - 1][0] - figure[0][0];
  const step = Math.max(1, span / (figure.length - 1));

  let tallest = 0;
  let loudest = 0;
  for (let index = 0; index < figure.length; index += 1) {
    const height = baseline - figure[index][1];
    if (height > tallest) {
      tallest = height;
      loudest = index;
    }
  }
  if (tallest <= 1) {
    return '';
  }

  const width = Math.max(3, step * 0.62);
  const size = Math.max(2.4, step * 0.36);
  const bead = Math.max(2.6, step * 0.5);
  // The pulse trace deflects from its own resting line rather than from the
  // floor, so its brightest moment is nowhere near where the level is.
  const restingLine = baseline - 30;

  const mark = (x: number, y: number): string => {
    switch (accent) {
      case 'cap':
        return rect(x - width / 2, y - 1.5, width, 3);
      case 'drip':
        return rect(x - bead / 2, baseline - y - bead / 2, bead, bead);
      case 'beat': {
        const tip = restingLine - Math.max(2, (baseline - y) * 0.72);
        return rect(x - size / 2, tip - size / 2, size, size);
      }
      case 'crest':
        return rect(x - bead / 2, y - bead / 2, bead, bead);
      case 'bead':
      default:
        return rect(x - bead / 2, y - bead / 2, bead, bead);
    }
  };

  // One mark, on the loudest point there is. A smooth curve has no columns to
  // cap, and scattering marks along it reads as damage rather than as emphasis.
  if (accent === 'crest') {
    const [x, y] = figure[loudest];
    return mark(x, y);
  }

  const floor = tallest * ACCENT_THRESHOLD;
  let path = '';
  let count = 0;
  let lastX = -Infinity;
  for (
    let index = 1;
    index < figure.length - 1 && count < MAX_ACCENTS;
    index += 1
  ) {
    const [x, y] = figure[index];
    // Three things make a tip worth lighting: it is loud enough against the
    // rest of the frame, nothing beside it is louder — which keeps a broad
    // peak to one mark rather than a smear across its shoulders — and it is
    // far enough from the last one to be a separate peak at all.
    const isLoud = baseline - y >= floor;
    const isLocalPeak =
      y <= figure[index - 1][1] && y <= figure[index + 1][1] && isLoud;
    if (isLocalPeak && x - lastX >= step * 1.5) {
      lastX = x;
      count += 1;
      path += mark(x, y);
    }
  }
  return path;
};
