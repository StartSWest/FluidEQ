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
 * The ways to draw the live spectrum across the response graph.
 *
 * Counted nowhere in this comment on purpose — the list has grown three times
 * and the prose said "ten" throughout.
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
  | 'dots'
  | 'steps'
  | 'blocks'
  | 'spikes'
  | 'ridge'
  | 'stems'
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
  | 'stalactites'
  | 'bubbles'
  | 'diamonds'
  | 'sawtooth'
  | 'ecg'
  | 'echo'
  | 'racer'
  | 'invaders'
  | 'starfield'
  | 'candles'
  | 'arches'
  | 'flames'
  | 'barcode'
  | 'rain'
  | 'honeycomb'
  | 'fence'
  | 'braid'
  | 'stitch'
  | 'canyon';

/** In cycle order. */
export const GRAPH_STYLES: GraphStyle[] = [
  'line',
  'area',
  'bars',
  'dots',
  'steps',
  'blocks',
  'spikes',
  'ridge',
  'stems',
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
  'stalactites',
  'bubbles',
  'diamonds',
  'sawtooth',
  'ecg',
  'echo',
  'racer',
  'invaders',
  'starfield',
  // Appended rather than slotted in beside their relatives. The order is the
  // cycle order, and anybody who has learned that their favourite is four
  // clicks past Bars would have it moved out from under them.
  'candles',
  'arches',
  'flames',
  'barcode',
  'rain',
  'honeycomb',
  'fence',
  'braid',
  'stitch',
  'canyon',
];

/**
 * Human names for the picker.
 *
 * Written out rather than generated from the key, because "terrace" and
 * "crown" mean nothing on their own — the list is chosen by eye and the
 * label is what somebody searches.
 */
export const GRAPH_STYLE_LABELS: Record<GraphStyle, string> = {
  line: 'Line',
  area: 'Area',
  bars: 'Bars',
  dots: 'Dots',
  steps: 'Staircase',
  blocks: 'LED blocks',
  spikes: 'Spikes',
  ridge: 'Ridge',
  stems: 'Stems',
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
  stalactites: 'Stalactites',
  bubbles: 'Bubbles',
  diamonds: 'Diamonds',
  sawtooth: 'Sawtooth',
  ecg: 'Pulse',
  echo: 'Echo',
  racer: 'Road trip',
  invaders: 'Invaders',
  starfield: 'Warp speed',
  candles: 'Candles',
  arches: 'Arches',
  flames: 'Flames',
  barcode: 'Barcode',
  rain: 'Rainfall',
  honeycomb: 'Honeycomb',
  fence: 'Fence',
  braid: 'Braid',
  stitch: 'Cross-stitch',
  canyon: 'Canyon',
};

export const nextGraphStyle = (style: GraphStyle): GraphStyle => {
  const index = GRAPH_STYLES.indexOf(style);
  return GRAPH_STYLES[(index + 1) % GRAPH_STYLES.length] ?? 'line';
};

/** Whether a style is painted rather than stroked, so the caller can say so. */
const STROKED_STYLES = new Set<GraphStyle>([
  'line',
  'steps',
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
  'ecg',
  'echo',
  'starfield',
  'rain',
  'braid',
  'stitch',
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
 * as a step rather than a swell. A ridge is a landscape and moves like one,
 * slowly, because a hill that twitches is noise. Dots and caps float — quick
 * to rise so they mark the peak, slow to fall so the mark stays long enough to
 * read. The thin forms are nearly instantaneous, which is the
 * whole point of a form that thin.
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
  ribs: { attackMs: 3, releaseMs: 30 },
  stems: { attackMs: 4, releaseMs: 40 },
  spikes: { attackMs: 3, releaseMs: 22 },
  crown: { attackMs: 4, releaseMs: 36 },
  // Landscapes. A hill that twitches is noise, so these are the slow ones.
  ridge: { attackMs: 22, releaseMs: 90 },
  terrace: { attackMs: 16, releaseMs: 70 },
  area: { attackMs: 12, releaseMs: 48 },
  // The staircase steps by nature; easing it hard would blur the treads.
  steps: { attackMs: 6, releaseMs: 26 },
  weave: { attackMs: 6, releaseMs: 30 },

  // More landscapes. A contour is drawn from where the level crosses a
  // threshold, so a jittery curve makes rings pop in and out of existence —
  // it is the slowest thing here on purpose.
  contour: { attackMs: 26, releaseMs: 95 },
  hatch: { attackMs: 18, releaseMs: 70 },
  bezier: { attackMs: 16, releaseMs: 55 },
  ribbon: { attackMs: 11, releaseMs: 46 },
  echo: { attackMs: 7, releaseMs: 140 },

  // Architecture. Buildings do not sway, so these are stiff going up and slow
  // coming down — the skyline should look built, not blown about.
  skyline: { attackMs: 5, releaseMs: 72 },
  truss: { attackMs: 7, releaseMs: 32 },
  matrix: { attackMs: 3, releaseMs: 66 },
  sawtooth: { attackMs: 4, releaseMs: 40 },

  // Things that hang, fall or float have gravity in them: quick to appear,
  // reluctant to leave.
  stalactites: { attackMs: 9, releaseMs: 120 },
  bubbles: { attackMs: 3, releaseMs: 92 },
  diamonds: { attackMs: 4, releaseMs: 78 },

  // The pulse is a heartbeat. One that arrives late is not a heartbeat, so it
  // is the fastest of the lot in both directions.
  ecg: { attackMs: 1, releaseMs: 12 },
  // A slope field draws the direction the spectrum is moving in. Smooth it and
  // it starts pointing at where the music was, which is worse than useless.
  slope: { attackMs: 3, releaseMs: 18 },
  feather: { attackMs: 4, releaseMs: 34 },
  zipper: { attackMs: 4, releaseMs: 26 },

  // The arcade. These are toys, and toys have physics: the runner pops off the
  // ground on a kick and comes down under its own weight, the aliens hover
  // rather than twitch, the warp streaks are as immediate as the pulse, and
  // the bricks behave like the level meter they secretly are.
  racer: { attackMs: 6, releaseMs: 42 },
  invaders: { attackMs: 6, releaseMs: 85 },
  starfield: { attackMs: 3, releaseMs: 26 },

  // Meters with a body to them. A candle and a barcode stripe are both read by
  // their size rather than their outline, so they keep the level meter's
  // manners: snap to the peak, hang, drop away.
  candles: { attackMs: 4, releaseMs: 50 },
  barcode: { attackMs: 4, releaseMs: 44 },

  // Rounded forms swell rather than snap. An arch that jumped would stop
  // reading as an arch and start reading as a bar with a curved lid.
  arches: { attackMs: 7, releaseMs: 52 },

  // Fire is the quickest thing here after the pulse, and has to be: a flame
  // that eases into position is a balloon.
  flames: { attackMs: 3, releaseMs: 30 },

  // Weather. Rain falls at its own speed no matter what the music does, so the
  // release is long — the drops thin out gradually rather than stopping dead.
  rain: { attackMs: 4, releaseMs: 96 },

  // Things built out of stacked pieces, which is the same argument the dot
  // matrix and the LED blocks make: the eye is counting cells, and a cell that
  // flickers on the boundary is a miscount.
  honeycomb: { attackMs: 4, releaseMs: 68 },
  fence: { attackMs: 5, releaseMs: 58 },

  // A braid is a rope and a rope has mass. Slow enough that the strands stay
  // strands instead of blurring into a band.
  braid: { attackMs: 10, releaseMs: 44 },

  // Needlework does not hurry, and the marks are small enough that a fast
  // release would make them twinkle rather than settle.
  stitch: { attackMs: 5, releaseMs: 72 },

  // The negative space of a landscape, so it moves like one — the slowest of
  // the new forms, for the same reason the ridge and the contour are slow.
  canyon: { attackMs: 15, releaseMs: 82 },
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
  matrix: 40,
  bubbles: 40,
  zipper: 40,
  sawtooth: 40,
  feather: 44,
  slope: 44,
  diamonds: 48,
  stalactites: 52,
  // The arcade forms are drawn as sprites, and a sprite squeezed into a
  // six-pixel column is a smudge. Fewer, bigger.
  invaders: 20,
  starfield: 40,

  // Anything with an inside needs room to show it. A hexagon under about ten
  // pixels across is a blob, an arch is a bump, and a flame with no width to
  // taper over is a spike.
  honeycomb: 30,
  arches: 40,
  flames: 34,
  candles: 40,

  // A barcode is the opposite argument: the whole read is many thin stripes of
  // varying width, and at sixty-four it stops looking like one.
  barcode: 56,

  fence: 46,
  rain: 44,
  stitch: 38,
};

const getColumnCount = (style: GraphStyle) =>
  COLUMN_OVERRIDES[style] ?? COLUMN_COUNT;

/**
 * The density a form was drawn for, for anything that wants to offer it back.
 *
 * The table above is the author's answer to "how many pieces should this form
 * be made of", arrived at by looking at it. A custom look starts from that
 * answer rather than from a number somebody had to guess, so exposing it is
 * what makes tuning a form feel like adjusting it rather than rebuilding it.
 */
export const getGraphColumnCount = (style: GraphStyle): number =>
  getColumnCount(style);

/** The forms drawn one piece per column rather than as a continuous figure. */
const DISCRETE_STYLES = new Set<GraphStyle>([
  'bars',
  'dots',
  'blocks',
  'spikes',
  'stems',
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
  'sawtooth',
  'ecg',
  'invaders',
  'starfield',
  'candles',
  'arches',
  'flames',
  'barcode',
  'rain',
  'honeycomb',
  'fence',
  'stitch',
]);

/**
 * Whether a form is made of separate pieces, one per band.
 *
 * The distinction matters to anything offering the density as a setting: a
 * line, an area or a contour keeps all three hundred and twenty points and has
 * no columns to count, so a density slider on one of those would be a control
 * that visibly does nothing.
 */
export const isDiscreteGraphStyle = (style: GraphStyle): boolean =>
  DISCRETE_STYLES.has(style);

/**
 * How few and how many pieces a form may be broken into.
 *
 * The floor is where columns stop reading as a spectrum and start reading as a
 * bar chart of nothing in particular; the ceiling is where they touch and the
 * figure turns back into the filled area that `toColumns` exists to avoid.
 * Both are wider than any built-in form uses, because the point of the setting
 * is to go somewhere the built-ins do not.
 */
export const MIN_GRAPH_COLUMNS = 8;
export const MAX_GRAPH_COLUMNS = 160;

/**
 * A column count that `toColumns` can safely be handed.
 *
 * Applied at the drawing end as well as when a look is saved, because this is
 * the one tuning value that can turn a bad number into a broken loop rather
 * than an ugly picture: a count of zero divides by zero and a fractional one
 * walks off the end of the buffer.
 */
export const clampGraphColumns = (columns: number): number =>
  Number.isFinite(columns)
    ? Math.min(
        MAX_GRAPH_COLUMNS,
        Math.max(MIN_GRAPH_COLUMNS, Math.round(columns)),
      )
    : COLUMN_COUNT;

/**
 * Reduce to one column per bucket, keeping the PEAK rather than the average.
 *
 * A spectrum is read for where the energy is, and averaging a narrow spike
 * with its quiet neighbours is how a real peak turns into a bump that is not
 * there. The loudest point in the bucket is the honest summary.
 *
 * The peak's LEVEL, though — never its position. A bucket covers a band of
 * frequencies, and which sample inside it happens to be loudest changes from
 * frame to frame, so returning that sample's own x made every bar shuffle
 * sideways as the music moved. Nothing about the drawing is supposed to move
 * horizontally: a bar sits over a fixed band of the spectrum and says how loud
 * that band is by its height, and that is the only thing that should change.
 *
 * So the column stands at the centre of its bucket, which is a constant, and
 * carries the peak's height.
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
    let [, peak] = points[from];
    for (let at = from + 1; at < to; at += 1) {
      if (points[at][1] < peak) {
        [, peak] = points[at];
      }
    }
    columns.push([points[Math.floor((from + to - 1) / 2)][0], peak]);
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
 *
 * `columns` overrides how many pieces a discrete form is broken into, for a
 * look the user has tuned. Left out, the form is drawn at the density it was
 * designed at, which is what every built-in look wants.
 */
export const createGraphShape = (
  points: readonly Projected[],
  style: GraphStyle,
  baseline: number,
  columns?: number,
): string => {
  if (points.length < 2) {
    return '';
  }
  // Bars, dots, spikes and blocks are drawn per column; a line, an area or a
  // staircase is a single polyline and keeps the full resolution, which costs
  // nothing extra and reads better.
  const isDiscrete = DISCRETE_STYLES.has(style);
  const figure = isDiscrete
    ? toColumns(
        points,
        columns === undefined
          ? getColumnCount(style)
          : clampGraphColumns(columns),
      )
    : points;
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

    // A car on a road, and the road is the spectrum.
    //
    // The trace becomes tarmac with a dashed centre line punched through it,
    // and a little car rides the loudest band — so the camera pans across the
    // frequency axis on its own as the music moves, without anything here
    // knowing what a frame before this one looked like.
    case 'racer': {
      const half = 3.5;
      const upper = points.map(([x, y]) => [x, y - half] as Projected);
      const lower = points.map(([x, y]) => [x, y + half] as Projected);
      let path = `${polyline(upper)} L ${[...lower]
        .reverse()
        .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
        .join(' L ')} Z`;
      for (let index = 6; index < points.length; index += 12) {
        const [x, y] = points[index];
        path += hole(x - 3, y - 0.7, 6, 1.4);
      }
      let loudest = 0;
      for (let index = 1; index < points.length; index += 1) {
        if (points[index][1] < points[loudest][1]) {
          loudest = index;
        }
      }
      const [carX, carY] = points[loudest];
      const road = carY - half;
      path += rect(carX - 9, road - 9, 18, 6);
      path += rect(carX - 4, road - 13, 9, 4);
      path += rect(carX - 7.5, road - 4, 5, 4);
      path += rect(carX + 3, road - 4, 5, 4);
      return path;
    }

    // A rank of little sprites hanging at their own levels, eyes cut out of
    // them. Loud bands sit high and quiet ones drift down the screen.
    case 'invaders': {
      const unit = Math.max(1.2, step * 0.13);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path += rect(x - unit * 2.5, y - unit, unit * 5, unit * 2.5);
        path += rect(x - unit * 3.5, y - unit * 0.5, unit, unit * 2);
        path += rect(x + unit * 2.5, y - unit * 0.5, unit, unit * 2);
        path += rect(x - unit * 2, y - unit * 2.5, unit, unit * 1.5);
        path += rect(x + unit, y - unit * 2.5, unit, unit * 1.5);
        path += rect(x - unit * 2.5, y + unit * 1.5, unit, unit);
        path += rect(x + unit * 1.5, y + unit * 1.5, unit, unit);
        path += hole(x - unit * 1.5, y - unit * 0.5, unit, unit);
        path += hole(x + unit * 0.5, y - unit * 0.5, unit, unit);
      }
      return path;
    }

    // Stars streaking past, three depths of them.
    //
    // The offsets come from the column index rather than from a random number,
    // which matters: a fresh `Math.random` every frame makes the field boil
    // instead of fly. Same seed, same star, moving only because its level did.
    case 'starfield': {
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const level = Math.max(0, baseline - y);
        for (let depth = 0; depth < 3; depth += 1) {
          const seed = ((index * 73 + depth * 131) % 97) / 97;
          const streakX = x + (seed - 0.5) * step;
          const streakY = y + seed * level * 0.85;
          const length = 2 + level * 0.035 * (depth + 1);
          path += `M ${streakX.toFixed(1)},${streakY.toFixed(
            1,
          )} v ${length.toFixed(1)} `;
        }
      }
      return path.trim();
    }

    // A trading chart. A fat body standing on the level with a thin wick
    // through it, so each band reports a range rather than a single number —
    // the body is where the energy is and the wick is how far it reaches.
    //
    // Unlike a bar, nothing here touches the floor: the figure floats at the
    // level, which makes a quiet band a small mark in the right place instead
    // of a stub that has to be measured against the bottom of the plot.
    case 'candles': {
      const width = Math.max(2, step * 0.52);
      const wick = Math.max(1, step * 0.14);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const level = Math.max(0, baseline - y);
        const body = Math.max(2.5, level * 0.26);
        const reach = body * 0.55;
        path += rect(x - wick / 2, y - reach, wick, body + reach * 2);
        path += rect(x - width / 2, y, width, body);
      }
      return path;
    }

    // A colonnade. Each band is a parabolic arch standing on the floor and
    // rising to its own level.
    //
    // Drawn as a quadratic rather than an elliptical arc deliberately. An `A`
    // command's sweep flag decides which way the curve bulges, and in a y-down
    // coordinate system that is exactly the kind of thing that is right in one
    // renderer and upside down in the next. A control point placed at twice the
    // peak's distance puts the apex on the level by arithmetic, with nothing to
    // get backwards.
    case 'arches': {
      const half = Math.max(1.5, step * 0.46);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        // A quadratic sits halfway between its control point and the chord, so
        // the control goes twice as far out as the apex needs to be.
        const control = 2 * y - baseline;
        path += `M ${(x - half).toFixed(1)},${baseline.toFixed(1)} Q ${x.toFixed(
          1,
        )},${control.toFixed(1)} ${(x + half).toFixed(1)},${baseline.toFixed(
          1,
        )} Z`;
      }
      return path;
    }

    // Tongues of fire: a wide base on the floor drawn up to a tip at the level,
    // with the sides curving in the way a flame's do.
    //
    // The lean comes from the column index, not from a random number — the same
    // rule the starfield follows. A flame that picked a new direction every
    // frame would not flicker, it would strobe.
    case 'flames': {
      const half = Math.max(1.5, step * 0.42);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const lean = (((index * 37) % 13) / 13 - 0.5) * half;
        const waist = (y + baseline) / 2;
        path += `M ${(x - half).toFixed(1)},${baseline.toFixed(1)} Q ${(
          x -
          half * 0.85
        ).toFixed(1)},${waist.toFixed(1)} ${(x + lean).toFixed(1)},${y.toFixed(
          1,
        )} Q ${(x + half * 0.85).toFixed(1)},${waist.toFixed(1)} ${(
          x + half
        ).toFixed(1)},${baseline.toFixed(1)} Z`;
      }
      return path;
    }

    // Level as width rather than as height.
    //
    // Every stripe runs the full depth of the plot and says how loud its band
    // is by how fat it is. It is the only form here that does not use the y
    // axis at all, which is the point: the spectrum stops being a landscape
    // with a skyline and becomes a texture, and a broad loud region reads as a
    // dense patch rather than as a wide hill.
    case 'barcode': {
      const widest = Math.max(1.5, step * 0.82);
      // The plot's own depth, which is what a level is a fraction of. Guarded
      // because a baseline of zero would divide by it.
      const depth = Math.max(1, baseline);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const level = Math.max(0, baseline - y);
        const width = 0.6 + (level / depth) * widest;
        path += rect(x - width / 2, 0, width, baseline);
      }
      return path;
    }

    // Weather over the spectrum. Streaks fall in the empty air above each band,
    // more of them and longer where the signal is strong, and each one lands on
    // a short splash sitting on the level.
    //
    // Above the curve rather than below it, which is what keeps this from being
    // the starfield again: the warp streaks fill the loud region, and these
    // fill the room left over it.
    case 'rain': {
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const level = Math.max(0, baseline - y);
        const drops = 1 + Math.floor(level / 34);
        for (let drop = 0; drop < drops; drop += 1) {
          const seed = ((index * 41 + drop * 89) % 71) / 71;
          const dropX = x + (seed - 0.5) * step * 0.9;
          const dropY = seed * Math.max(0, y - 8);
          const length = 4 + level * 0.022;
          path += `M ${dropX.toFixed(1)},${dropY.toFixed(1)} v ${length.toFixed(
            1,
          )} `;
        }
        const splash = Math.max(1.5, step * 0.22);
        path += `M ${(x - splash).toFixed(1)},${y.toFixed(1)} h ${(
          splash * 2
        ).toFixed(1)} `;
      }
      return path.trim();
    }

    // Cells stacked up each column on a fixed grid.
    //
    // The same quantised reading as the dot matrix, in the shape that actually
    // tiles: hexagons pack without leaving the gaps a grid of squares does, so
    // a loud column reads as a solid comb rather than as a dotted line.
    case 'honeycomb': {
      const radius = Math.max(2, step * 0.4);
      // A pointy-top hexagon is a full radius tall and √3/2 of one wide, and
      // rows sit one and a half radii apart so they interlock rather than stack.
      const across = radius * 0.866;
      const row = radius * 1.5;
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        for (let at = baseline - radius; at > y; at -= row) {
          path +=
            `M ${x.toFixed(1)},${(at - radius).toFixed(1)} ` +
            `L ${(x + across).toFixed(1)},${(at - radius / 2).toFixed(1)} ` +
            `L ${(x + across).toFixed(1)},${(at + radius / 2).toFixed(1)} ` +
            `L ${x.toFixed(1)},${(at + radius).toFixed(1)} ` +
            `L ${(x - across).toFixed(1)},${(at + radius / 2).toFixed(1)} ` +
            `L ${(x - across).toFixed(1)},${(at - radius / 2).toFixed(1)} Z`;
        }
      }
      return path;
    }

    // Pickets cut to the level, with two rails running the whole width behind
    // them.
    //
    // The rails are the difference between this and a row of pointed bars: they
    // sit at fixed heights rather than following the signal, so they give the
    // eye a ruler to read the pickets against — which band clears the top rail
    // is a question a bar chart cannot answer at a glance.
    case 'fence': {
      const width = Math.max(1.5, step * 0.36);
      const cap = width * 0.9;
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path +=
          `M ${(x - width / 2).toFixed(1)},${baseline.toFixed(1)} ` +
          `L ${(x - width / 2).toFixed(1)},${(y + cap).toFixed(1)} ` +
          `L ${x.toFixed(1)},${y.toFixed(1)} ` +
          `L ${(x + width / 2).toFixed(1)},${(y + cap).toFixed(1)} ` +
          `L ${(x + width / 2).toFixed(1)},${baseline.toFixed(1)} Z`;
      }
      const left = figure[0][0];
      const right = figure[figure.length - 1][0];
      path += rect(left, baseline - 22, right - left, 3);
      path += rect(left, baseline - 48, right - left, 3);
      return path;
    }

    // Two strands wound around the curve, crossing where they meet.
    //
    // Both are the same trace displaced by a sine of the point index, one
    // inverted, so they braid at a fixed pitch while the width of the plait
    // swells with the level. Unlike the zipper, which is two rails and a set of
    // teeth, this is a single continuous rope and reads as one object.
    case 'braid': {
      const over: Projected[] = [];
      const under: Projected[] = [];
      for (let index = 0; index < points.length; index += 1) {
        const [x, y] = points[index];
        const swell = 2 + Math.min(13, Math.max(0, baseline - y) * 0.065);
        // Radians per point, which is the pitch of the plait. Tied to the index
        // rather than to x so the twist stays even across a logarithmic axis.
        const twist = Math.sin(index * 0.42) * swell;
        over.push([x, y + twist]);
        under.push([x, y - twist]);
      }
      return `${polyline(over)} ${polyline(under)}`;
    }

    // Needlework. A running thread along the peaks with a cross worked over
    // every band — the spectrum as something made by hand rather than measured.
    case 'stitch': {
      const size = Math.max(1.6, step * 0.28);
      let path = polyline(figure);
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path +=
          ` M ${(x - size).toFixed(1)},${(y - size).toFixed(1)} ` +
          `L ${(x + size).toFixed(1)},${(y + size).toFixed(1)} ` +
          `M ${(x - size).toFixed(1)},${(y + size).toFixed(1)} ` +
          `L ${(x + size).toFixed(1)},${(y - size).toFixed(1)}`;
      }
      return path;
    }

    // The room above the signal rather than the signal itself.
    //
    // Every other filled form here paints the energy; this one paints what is
    // left over it, so the picture is the headroom and the shape you are
    // reading is the underside of the ceiling. A loud mix closes the canyon up
    // and a sparse one opens it out, which is the same information the area
    // style carries and a completely different thing to look at.
    case 'canyon': {
      const first = points[0];
      const last = points[points.length - 1];
      const wall = [...points]
        .reverse()
        .map(([x, y]) => `L ${x.toFixed(1)},${y.toFixed(1)}`)
        .join(' ');
      return `M ${first[0].toFixed(1)},0 L ${last[0].toFixed(1)},0 ${wall} Z`;
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
 * One form. Not forty.
 *
 * The reason there are forty drawings is that they behave differently, so an
 * effect applied to all of them is not an effect — it is the drawing with the
 * contrast turned up, and it flattens the exact variety the forms exist to
 * provide. A lit tip belongs on a stem, which is a thin line with an end. It
 * says nothing on a contour map, a slope field or a bridge truss, and on a
 * smooth curve it reads as damage.
 *
 * The table is a table rather than a check for one string so that a second
 * form can be given one deliberately, one at a time, by somebody who has
 * looked at it and decided it earns one.
 */
const ACCENTS: Partial<Record<GraphStyle, 'bead'>> = {
  stems: 'bead',
};

/**
 * Whether a form has lit tips to offer at all.
 *
 * For the designer, which would otherwise show a switch that does nothing on
 * thirty-five of the thirty-six forms. A control that is off because the form
 * has none is a different thing from one that is off because the user turned
 * it off, and the panel says so rather than leaving them to work it out.
 */
export const hasGraphAccent = (style: GraphStyle): boolean =>
  Boolean(ACCENTS[style]);

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
 * meaning "here is the peak".
 */
const MAX_ACCENTS = 10;

/**
 * The lit tips, as a path of their own — for the one form that has them.
 *
 * Drawn separately from the figure so the tips can be lit while the body stays
 * calm: the caller strokes this twice, once thick and faint and once thin and
 * bright, which reads as a glow without a filter anywhere near it. That
 * matters more than it sounds — an SVG filter on a path whose geometry changes
 * every frame re-rasterises its whole region every frame, and this pane learned
 * that lesson expensively.
 *
 * Returns an empty path for every other form, which is the intended answer and
 * not a failure to draw one.
 */
export const createGraphAccent = (
  points: readonly Projected[],
  style: GraphStyle,
  baseline: number,
  columns?: number,
): string => {
  if (!ACCENTS[style] || points.length < 3) {
    return '';
  }
  // The same density as the figure, or the beads land between the stems they
  // are supposed to be sitting on.
  const figure = toColumns(
    points,
    columns === undefined ? getColumnCount(style) : clampGraphColumns(columns),
  );
  if (figure.length < 3) {
    return '';
  }
  const span = figure[figure.length - 1][0] - figure[0][0];
  const step = Math.max(1, span / (figure.length - 1));

  let tallest = 0;
  for (let index = 0; index < figure.length; index += 1) {
    const height = baseline - figure[index][1];
    if (height > tallest) {
      tallest = height;
    }
  }
  if (tallest <= 1) {
    return '';
  }

  const bead = Math.max(2.6, step * 0.5);
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
    // peak to one bead rather than a smear across its shoulders — and it is
    // far enough from the last one to be a separate peak at all.
    const isLoud = baseline - y >= floor;
    const isLocalPeak =
      y <= figure[index - 1][1] && y <= figure[index + 1][1] && isLoud;
    if (isLocalPeak && x - lastX >= step * 1.5) {
      lastX = x;
      count += 1;
      path += rect(x - bead / 2, y - bead / 2, bead, bead);
    }
  }
  return path;
};
