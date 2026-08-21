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

import {
  DISCRETE_STYLES,
  GraphStyle,
  Projected,
  clampGraphColumns,
  getColumnCount,
  isDiscreteGraphStyle,
  hole,
  rect,
} from './graphStyles';
import { WaveformStyle, createWaveformShape } from './waveformStyles';

/**
 * How each of the forty graph forms is actually drawn.
 *
 * Eleven hundred lines, and one job: turn a projected spectrum into the points
 * a form draws, plus the accent it shows when a band peaks. It was the bulk of
 * graphStyles.ts, which is otherwise a catalogue — the names, the labels, the
 * palettes, the ballistics. A catalogue and a renderer are different things,
 * and reading either meant scrolling through the other.
 *
 * Deliberately one function with a branch per form rather than forty modules.
 * The forms are variations on a handful of shared moves — bucket the points,
 * take the peak, emit columns or a polyline — and splitting them apart would
 * copy those moves forty times to avoid one switch.
 */
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
  /**
   * The column's x comes from an EVEN DIVISION of the span, not from a
   * sample's own position.
   *
   * It used to be the x of whichever sample sat in the middle of the bucket.
   * That is fixed, which is what mattered — a bar must not shuffle sideways
   * as the music moves — but it is not EVENLY SPACED: the bucket bounds are
   * floored, so consecutive middles land a sample nearer or further than the
   * pair before them. Against a constant bar width the gaps then came out
   * visibly uneven, and at some piece counts more than others, which read as
   * the drawing being wrong rather than as rounding.
   *
   * An even division is fixed for the same reason and even as well: it
   * depends only on the count and the plot.
   */
  const left = points[0][0];
  const stride = (points[points.length - 1][0] - left) / count;
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
    columns.push([left + (index + 0.5) * stride, peak]);
  }
  return columns;
};

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

/**
 * How many readings the wave forms are drawn from.
 *
 * The titlebar's own `WAVEFORM_POINT_COUNT`, repeated as a constant rather
 * than imported: that one lives in the renderer's capture module, and this
 * file is in `common` and draws for both. The number matters because these
 * forms size their pieces from the gap between samples — see the call site.
 */
const WAVE_SAMPLE_COUNT = 96;

/**
 * The titlebar wave's ten forms, and which of its styles each one is.
 *
 * They are not reimplemented here. `createWaveformShape` already draws all
 * ten and is the thing they are supposed to look exactly like, so the graph
 * hands it the spectrum and an origin and gets the same figure back. Two
 * copies of a shape stop being the same shape the first time one of them is
 * improved.
 */
const WAVE_FORMS: Partial<Record<GraphStyle, WaveformStyle>> = {
  // Its bars only. The trace over them is the accent — see `ACCENTS`.
  fluid: 'bars',
  'wave-line': 'line',
  'wave-filled': 'filled',
  'wave-bars': 'bars',
  'wave-mirror': 'mirror-bars',
  'wave-dots': 'dots',
  'wave-ribbon': 'ribbon',
  'wave-spikes': 'spikes',
  'wave-blocks': 'blocks',
  'wave-outline': 'outline',
  'wave-lattice': 'lattice',
};

/**
 * The spectrum, as the fractions of full height the wave shapes expect.
 *
 * A projected point is a pixel row and the wave shapes take amplitudes in
 * [0, 1], so this is the same reading in the units the other module speaks.
 * The mirroring is what the two have in common: a waveform straddles its
 * centre because a signal swings both ways, and a spectrum drawn this way
 * straddles it because the figure is reflected — the level is still extent
 * either way, which is why the reading survives the change of shape.
 */
const toWaveSamples = (
  points: readonly Projected[],
  baseline: number,
  // Normalised against the plot's depth rather than the floor's distance from
  // the card, or a reading at the ceiling comes back short of full scale by
  // exactly the headroom above the plot.
  ceiling = 0,
): number[] => {
  const depth = Math.max(1, baseline - ceiling);
  const samples: number[] = [];
  for (let index = 0; index < points.length; index += 1) {
    samples.push(
      Math.max(0, Math.min(1, (baseline - points[index][1]) / depth)),
    );
  }
  return samples;
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
const smoothPolyline = (points: readonly Projected[]): string => {
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
    (x: number, y: number, baseline: number, width: number) => string
  >
> = {
  bars: (x, y, baseline, width) =>
    rect(x - width / 2, y, width, Math.max(0, baseline - y)),
  pillars: (x, y, baseline, width) =>
    rect(x - width / 2, y, width, Math.max(0, baseline - y)),
  blocks: (x, y, baseline, width) => {
    // Taller segments than the meter uses: this pane is far deeper, and a
    // seven-pixel ladder over it is hundreds of rectangles per column.
    const segment = 11;
    const lit = Math.floor(Math.max(0, baseline - y) / segment);
    let d = '';
    for (let level = 0; level < lit; level += 1) {
      d += rect(
        x - width / 2,
        baseline - (level + 1) * segment + 1,
        width,
        segment - 2,
      );
    }
    return d;
  },
  skyline: (x, y, baseline, width) => {
    const pane = Math.max(1.4, width * 0.16);
    const floorHeight = 17;
    let d = rect(x - width / 2, y, width, Math.max(0, baseline - y));
    for (
      let floor = baseline - floorHeight;
      floor > y + floorHeight * 0.7;
      floor -= floorHeight
    ) {
      for (let column = -1; column <= 1; column += 2) {
        d += hole(
          x + column * width * 0.22 - pane / 2,
          floor - pane / 2,
          pane,
          pane,
        );
      }
    }
    return d;
  },
};

/** The narrowest each of them may be drawn, whatever the density. */
const PIECE_WIDTH_FLOORS: Partial<Record<GraphStyle, number>> = {
  skyline: 4,
};

export const hasGraphPieces = (style: GraphStyle): boolean =>
  Boolean(PIECE_BUILDERS[style]);

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
): IGraphPiece[] => {
  const build = PIECE_BUILDERS[style];
  if (!build || points.length < 2) {
    return [];
  }
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
  const depth = Math.max(1, baseline);
  return figure.map(([x, y], index) => ({
    d: build(x, y, baseline, width),
    across: figure.length > 1 ? index / (figure.length - 1) : 0,
    energy: Math.max(0, Math.min(1, (baseline - y) / depth)),
  }));
};

export const createGraphShape = (
  points: readonly Projected[],
  style: GraphStyle,
  baseline: number,
  columns?: number,
  /**
   * The output envelope, as absolute amplitudes in [0, 1].
   *
   * The second reading, and the mirror of the argument the titlebar wave
   * already takes. It is a TIME series, so nothing here may plot it across
   * x — this plot's x axis is logarithmic frequency, with grid lines and
   * labels saying so, and laying a waveform along it would draw seconds
   * against a hertz scale. Forms use its amplitude, never its shape.
   */
  waveform?: readonly number[],
  /**
   * How much of each column to leave empty, 0 for the width the form was
   * drawn at. Read by the forms made of columns; the rest have no gap to
   * speak of and ignore it.
   */
  gap = 0,
  /**
   * The pixel row the plot's ceiling sits on.
   *
   * Only the mirrored wave family reads it, and it reads it because it is the
   * only family that needs to know where the plot's MIDDLE is. Everything
   * else here hangs from the floor and is content with `baseline`.
   *
   * Zero was assumed, and the plot's ceiling is never zero: there is headroom
   * above it for the controls strip that floats over the card, measured from
   * the live strip and taller when it wraps. So the wave was centred on half
   * the floor's depth instead of half the plot's, which put its middle too
   * high by half the headroom and its crest above the plot entirely, where it
   * was cut off. Turning the grid off made it worse rather than causing it —
   * that drops the bottom margin, so the floor moves down, the assumed height
   * grows, and the overshoot at the top grows with it.
   */
  ceiling = 0,
  /**
   * Whether this is going to be painted rather than stroked.
   *
   * Read only by the handful of forms that are a single open trace, and read
   * because those two jobs want different paths from the same drawing. Left
   * open, a fill is closed for you by a straight line from the last point
   * back to the first — a diagonal across the whole plot with a meaningless
   * wedge under it. Closed to the floor unconditionally, the STROKED version
   * grows a hairline along the bottom of the plot and a vertical up each
   * side, which is a box drawn round a line nobody asked to frame.
   *
   * So the trace says how it shuts, and it can only say that if it is told
   * which of the two it is being asked for.
   */
  filled = false,
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
  // The gap IS the separation: zero is columns that touch. Each form's own
  // width lives in `BAR_GAP_DEFAULTS` as a starting position instead.
  /**
   * The same trace, shut against the floor.
   *
   * Down from where it ended, back along the bottom of the plot, and closed
   * — which is what filling a spectrum means in every other form here.
   */
  const closedUnder = (
    trace: string,
    fromX = points[0][0],
    toX = points[points.length - 1][0],
  ): string =>
    `${trace} L ${toX.toFixed(1)},${baseline.toFixed(1)} L ${fromX.toFixed(
      1,
    )},${baseline.toFixed(1)} Z`;
  const columnWidth = (floorPx: number) =>
    Math.max(floorPx, step * (1 - Math.max(0, Math.min(0.85, gap))));

  /**
   * The titlebar's ten, drawn by the titlebar's own code.
   *
   * Handled before the switch rather than as ten more cases, because there is
   * no geometry here to write: the whole point of these is that they are the
   * same figures, so all this does is convert the units, say where the plot
   * is, and pick which of the three returned paths this form is made of.
   *
   * A filled form takes the body. A stroked one takes both edges — those two
   * are one figure in every style that has them, and returning only the upper
   * would draw half a wave.
   */
  const waveStyle = WAVE_FORMS[style];
  if (waveStyle !== undefined) {
    const left = points[0][0];
    const shape = createWaveformShape(
      /**
       * The waveform, bucketed to the titlebar's own sample count.
       *
       * Several of these forms size their pieces from the gap between one
       * sample and the next, so handing them the plot's three-hundred-odd
       * points would draw the same figures at a fifth of the width each —
       * a ladder of hair-thin rungs instead of the ladder in the titlebar.
       * Matching the count is what makes them match.
       *
       * The spectrum stands in until the first envelope arrives, so a form
       * still draws something true rather than a flat line.
       */
      waveform !== undefined && waveform.length >= 2
        ? waveform
        : toWaveSamples(
            toColumns(points, WAVE_SAMPLE_COUNT),
            baseline,
            ceiling,
          ),
      waveStyle,
      Math.max(1, points[points.length - 1][0] - left),
      // The plot's own depth, floor to ceiling — not the floor's distance
      // from the top of the card, which is what `baseline` alone is.
      Math.max(1, baseline - ceiling),
      // Half the plot, because the figure is mirrored: a full-scale reading
      // reaches the ceiling going up and the floor going down, and anything
      // more would draw outside the plot in both directions at once.
      Math.max(1, baseline - ceiling) / 2,
      /**
       * THE SECOND READING, and the thing that was missing.
       *
       * Eight of these forms draw their bars off real frequency bands when
       * they are handed some, and fall back to the waveform when they are
       * not. The first port passed nothing, so every one of them took the
       * fallback — which is why they did not look like the titlebar, where
       * magnitudes are always supplied.
       *
       * This is also the arrangement that suits the axis: the bands are a
       * frequency reading and they land on a frequency axis, which is more
       * correct here than drawing the spectrum as if it were a wave.
       */
      /**
       * At the density the look asks for, falling back to the titlebar's
       * own band count.
       *
       * Hard-coded, Pieces moved the label and not the picture — and worse
       * than that, the bars this path traces are painted at the requested
       * count, so a border built from a fixed forty-eight sat over a
       * different number of bars than the ones underneath it.
       */
      toWaveSamples(
        toColumns(
          points,
          columns === undefined
            ? getColumnCount(style)
            : clampGraphColumns(columns),
        ),
        baseline,
        ceiling,
      ),
      { x: left, y: ceiling },
    );
    if (shape.fill) {
      return shape.fill;
    }
    return `${shape.line} ${shape.mirror}`.trim();
  }

  switch (style) {
    case 'line':
      return filled ? closedUnder(polyline(points)) : polyline(points);

    case 'area':
    case 'ridge': {
      const first = points[0];
      const last = points[points.length - 1];
      return `${polyline(points)} L ${last[0].toFixed(1)},${baseline.toFixed(
        1,
      )} L ${first[0].toFixed(1)},${baseline.toFixed(1)} Z`;
    }

    case 'bars':
      // Built from the same per-piece geometry the renderer asks for when
      // it has a colour to give each one — see `createGraphPieces`. One
      // layout, so a border can never be drawn round pieces that are not
      // the pieces underneath it.
      return createGraphPieces(points, style, baseline, columns, gap)
        .map((piece) => piece.d)
        .join('');

    case 'dots': {
      const size = columnWidth(1.6);
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
      return filled ? closedUnder(path) : path;
    }

    case 'blocks':
      // Built from the same per-piece geometry the renderer asks for when
      // it has a colour to give each one — see `createGraphPieces`. One
      // layout, so a border can never be drawn round pieces that are not
      // the pieces underneath it.
      return createGraphPieces(points, style, baseline, columns, gap)
        .map((piece) => piece.d)
        .join('');

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
      const size = columnWidth(1.8);
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
      const width = columnWidth(2);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path += `M ${(x - width / 2).toFixed(1)},${y.toFixed(1)} h ${width.toFixed(
          1,
        )} `;
      }
      return path.trim();
    }

    /**
     * Two marks per column: the loudest point in the band and the quietest.
     *
     * The second mark used to sit at `y + (baseline - y) * 0.5` — half way
     * down to the first. That is derived from the mark above it and was
     * never measured, so the form drew a decoration that looked exactly
     * like a second reading. Anything that looks like data has to be data.
     *
     * Measured, the pair says something no other form here says: how EVEN
     * a band is. A flat region closes the two marks together; a narrow
     * spike sitting in a quiet neighbourhood pulls them apart. That is the
     * spread the peak-only bucketing throws away everywhere else.
     */
    case 'scatter': {
      const size = columnWidth(1.4);
      const troughs = toColumnTroughs(points, figure.length, figure === points);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path += rect(x - size / 2, y - size / 2, size, size);
        const trough = troughs[index];
        // Only when the two are far enough apart to read as two marks —
        // otherwise a flat band draws one square on top of another and
        // looks like a rendering fault.
        if (trough - y > size) {
          path += rect(x - size / 2, trough - size / 2, size, size);
        }
      }
      return path;
    }

    // A cap hovering above an empty column, the way a peak-hold reads.
    case 'caps': {
      const width = columnWidth(2);
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        path += rect(x - width / 2, y, width, 3);
      }
      return path;
    }

    // Horizontal rungs stacked up each column.
    case 'ribs': {
      const width = columnWidth(2);
      // Rungs every nine pixels. Named for what it is: `gap` shadowed the
      // column-gap parameter and read as though this form answered it.
      const pitch = 9;
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        for (let at = baseline; at > y; at -= pitch) {
          path += `M ${(x - width / 2).toFixed(1)},${at.toFixed(
            1,
          )} h ${width.toFixed(1)} `;
        }
      }
      return path.trim();
    }

    // Wide columns with no gap, so the spectrum reads as a solid skyline.
    case 'pillars':
      // Built from the same per-piece geometry the renderer asks for when
      // it has a colour to give each one — see `createGraphPieces`. One
      // layout, so a border can never be drawn round pieces that are not
      // the pieces underneath it.
      return createGraphPieces(points, style, baseline, columns, gap)
        .map((piece) => piece.d)
        .join('');

    // Tapered towers: wide at the floor, narrow at the peak.
    case 'crown': {
      const width = columnWidth(2);
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
      const ceiling = points.reduce((min, [, y]) => Math.min(min, y), Infinity);
      /**
       * The thresholds fit the signal rather than sitting at a fixed 16px.
       *
       * Fixed, nothing cleared the first one through a quiet passage and
       * the form fell back to `polyline` — so the pane silently drew
       * `line` instead of the contour map that was chosen, and did it at
       * exactly the moments the trace was hardest to read. A map with no
       * lines on it is not a map.
       *
       * Four bands minimum, capped at the original spacing so a loud mix
       * looks exactly as it did before.
       */
      const spacing = Math.max(4, Math.min(16, (baseline - ceiling) / 4));
      const rightEdge = points[points.length - 1][0];
      let path = '';
      /**
       * The contours have thickness, because a fill needs something to fill.
       *
       * They were bare horizontal segments, and a segment encloses no area —
       * so with the look's Filled switch on, the canvas painted precisely
       * nothing and the form vanished from the pane. Not faint, not wrong:
       * gone, in a way indistinguishable from the capture having stopped.
       *
       * A drawn contour line has a width on any real map, so giving these one
       * costs the form nothing and makes both switch positions draw the same
       * map. Thin enough to stay a line, and tied to the spacing so the bands
       * never thicken into each other when the thresholds crowd up in a quiet
       * passage.
       */
      const weight = Math.max(1.5, Math.min(2.5, spacing * 0.3));
      const band = (from: number, to: number, level: number) =>
        rect(from, level - weight / 2, Math.max(weight, to - from), weight);
      for (let level = baseline - spacing; level > ceiling; level -= spacing) {
        let from: number | undefined;
        for (let index = 0; index < points.length; index += 1) {
          const [x, y] = points[index];
          if (y <= level && from === undefined) {
            from = x;
          } else if (y > level && from !== undefined) {
            path += band(from, x, level);
            from = undefined;
          }
        }
        if (from !== undefined) {
          path += band(from, rightEdge, level);
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
        /**
         * Only the stretch of the diagonal that can be inside the plot.
         *
         * The scan used to run the full ceiling-to-baseline depth for every
         * offset and test `x >= left && x <= right` inside the loop, so the
         * diagonals near either edge — which cross only a corner — spent
         * almost all of their iterations discarding points that were never
         * going to be in the plot. Since x is y + offset, the x bounds are
         * y bounds, and clamping the loop to them cuts that work without
         * changing a single line that gets drawn.
         */
        const fromY = Math.max(ceiling, left - offset);
        const toY = Math.min(baseline, right - offset);
        for (let y = fromY; y <= toY; y += stepY) {
          const x = y + offset;
          const inside = y >= heightAt(x);
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
          // Closed at the end of the clamped scan, not at the baseline: past
          // `toY` the diagonal has left the plot, and running the stroke on
          // to the baseline would draw it outside.
          path += ` M ${(from + offset).toFixed(1)},${from.toFixed(1)} L ${(
            toY + offset
          ).toFixed(1)},${toY.toFixed(1)}`;
        }
      }
      return path;
    }

    // A departure board. Small squares on a fixed grid, lit up each column as
    // far as the level reaches — so the picture is quantised in both
    // directions and the eye counts rows instead of measuring heights.
    case 'matrix': {
      const size = columnWidth(1.5);
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
    case 'skyline':
      // Built from the same per-piece geometry the renderer asks for when
      // it has a colour to give each one — see `createGraphPieces`. One
      // layout, so a border can never be drawn round pieces that are not
      // the pieces underneath it.
      return createGraphPieces(points, style, baseline, columns, gap)
        .map((piece) => piece.d)
        .join('');

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
      return filled ? closedUnder(path) : path;
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
      const width = columnWidth(2);
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
      const largest = columnWidth(2);
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
      const largest = columnWidth(2.5);
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
      return filled ? closedUnder(path) : path;
    }

    // The trace, and three afterimages of it — each arriving a little to the
    // right and standing a little lower, the way a delay repeat comes back
    // late and quieter. Nothing here is remembered between frames; the echoes
    // are the same instant redrawn smaller, which is a picture of decay rather
    // than a recording of it.
    case 'echo': {
      const left = points[0][0];
      const right = points[points.length - 1][0];
      // Each repeat shuts against the floor on ITS own span, not on the live
      // trace's — they are offset to the right, and closing all four between
      // the same two verticals would slant every repeat's end wall.
      const shut = (trace: string, late: number) =>
        filled ? closedUnder(trace, left + late, right + late) : trace;
      let path = shut(polyline(points), 0);
      for (let copy = 1; copy <= 3; copy += 1) {
        const decay = 1 - copy * 0.26;
        const late = copy * 6;
        path += ` ${shut(
          polyline(
            points.map(
              ([x, y]) =>
                [x + late, baseline - (baseline - y) * decay] as Projected,
            ),
          ),
          late,
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
      /**
       * The car rides the centre of energy, not the loudest bin.
       *
       * It used to take the argmax over every point, which teleports: two
       * bands within a hair of each other trade the maximum from frame to
       * frame and the car jumps the width of the plot between them. There
       * is nowhere to keep a smoothed position either — this function is
       * pure and sees one frame at a time.
       *
       * A weighted centroid needs no memory and cannot flicker: it is an
       * average, so a rival band pulls it a little rather than seizing it.
       * It is also the better reading. The argmax says which single bin
       * won; the centroid says where the music actually sits.
       */
      let weightSum = 0;
      let weighted = 0;
      for (let index = 0; index < points.length; index += 1) {
        // Squared, so the loud region still dominates and the car does not
        // simply park in the middle of the axis on every mix.
        const level = Math.max(0, baseline - points[index][1]) ** 2;
        weightSum += level;
        weighted += level * index;
      }
      const focus =
        weightSum > 0
          ? Math.round(weighted / weightSum)
          : Math.floor(points.length / 2);
      const [carX, carY] = points[Math.min(points.length - 1, focus)];
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
      const unit = Math.max(1.2, columnWidth(0) / 5);
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
          // Knuth's multiplicative hash rather than a small modulus. The
          // fixed-seed principle was right — a fresh `Math.random` every
          // frame makes the field boil instead of fly — but ninety-seven
          // possible values across every column and depth meant the same
          // offsets recurred visibly along the axis, so the sky repeated.
          const seed = ((index * 2654435761 + depth * 40503) % 65536) / 65536;
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
      const width = columnWidth(2);
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
      const widest = columnWidth(1.5);
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
      const radius = Math.max(2, columnWidth(0) / 2);
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
      const width = columnWidth(1.5);
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
      // Painted, the plait is the room between its two rails rather than the
      // area under them — this form has no underside, it has a body, and that
      // body already swells where the signal does. Closing it to the floor
      // instead would bury the twist that is the whole form.
      if (filled) {
        const back = [...under].reverse();
        return `${polyline(over)} ${polyline(back).replace(/^M/, 'L')} Z`;
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

    /**
     * A zigzag threading the peaks, alternating above and below each one.
     *
     * The side a stitch falls on comes from the column's parity, which is
     * what makes it a weave. Its DEPTH used to come from parity as well —
     * a flat ±6px regardless of the music — so the one part of the figure
     * that could have carried a reading carried nothing, and the form
     * zigzagged identically through silence and through a chorus.
     *
     * Now the depth is the band's own level, so the plait opens where the
     * music is and closes to a nearly straight thread where it is not.
     */
    case 'weave': {
      /**
       * Threaded rather than sawn.
       *
       * The swings were joined corner to corner, which at any useful density
       * is a row of hard teeth — a saw blade, not a weave. Rounded through
       * the midpoints the same alternation reads as one thread crossing the
       * line and back, which is what the form is called.
       *
       * The alternation and the depth are untouched: the side still comes
       * from the column's parity and how far it goes still comes from how
       * loud that band is.
       */
      const woven: Projected[] = [];
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        const depth = 1.5 + Math.min(11, Math.max(0, baseline - y) * 0.055);
        // Doubled because these become control points, and a quadratic only
        // reaches halfway to its control — the same arithmetic `arches` does
        // above. Undoubled, rounding the corners silently halved the swing.
        const swing = 2 * depth;
        woven.push([x, y + (index % 2 === 0 ? -swing : swing)] as Projected);
      }
      /**
       * Closed down to the floor, like every other form that can be painted.
       *
       * An open path handed to a fill is closed for you, by a straight line
       * from its last point back to its first — which on a trace that starts
       * loud at 20Hz and ends quiet at 20k is a diagonal clean across the
       * graph, with an enormous wedge under it that means nothing. Nobody
       * drew that; it was the absence of a decision.
       *
       * Returning along the response instead, so each swing shuts into its
       * own lobe, is the geometry the name suggests and it looked wrong: at
       * any depth a thread can plausibly have, the plait is a thin band and
       * the form stops reading as a level at all.
       *
       * So the fill is the area under the thread, which is what filling a
       * spectrum means everywhere else in this catalogue. The thread is
       * still the top edge; only the way it shuts changed.
       */
      const [firstX] = figure[0];
      const [lastX] = figure[figure.length - 1];
      return `${smoothPolyline(woven)} L ${lastX.toFixed(
        1,
      )},${baseline.toFixed(1)} L ${firstX.toFixed(1)},${baseline.toFixed(
        1,
      )} Z`;
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
/**
 * The ways a peak can be marked.
 *
 * A lit peak is the one thing on the graph that is pure emphasis — it says
 * "this one" and nothing else — so which mark suits it is a question about
 * the form underneath and about taste, and neither is something this file
 * can answer. It is a choice.
 *
 * `wave` is the odd one and the reason the list is not all marks: it is not
 * a mark at all but a curve laid over the whole figure, which is what the
 * fluid is half made of. It stays exactly as it is.
 */
export type AccentStyle =
  | 'wave'
  | 'bead'
  | 'fall'
  | 'ghost'
  | 'ripple'
  | 'sparks'
  | 'beam'
  | 'ceiling'
  | 'comet'
  | 'drip';

export const ACCENT_STYLES: AccentStyle[] = [
  'bead',
  'fall',
  'ghost',
  'ripple',
  'sparks',
  'beam',
  'ceiling',
  'comet',
  'drip',
  'wave',
];

const ACCENTS: Partial<Record<GraphStyle, 'bead' | 'trace'>> = {
  stems: 'bead',
  /**
   * The wave line over the fluid's bars.
   *
   * Not decoration and not a peak mark — it is the form's second half. The
   * titlebar draws this one in two layers for a reason its comment gives:
   * a shared path cannot carry a gradient per bar, so the bars are painted
   * separately from the trace over them. The graph has the same seam, this
   * one, and using it means the two panes agree about what fluid is instead
   * of each assembling its own version.
   *
   * A `trace` accent has nothing to do with peaks, so it skips all of the
   * threshold work below and is simply the curve.
   */
  fluid: 'trace',
};

/**
 * The form a look's glow should be taken from, which is not always its own.
 *
 * Light comes off the outside of a thing. A wall of LED bricks glows as one
 * lit bar, not as forty separately haloed bricks; hatching glows along the
 * edge of the hatched region, not around each diagonal. Drawing the halo from
 * the real geometry gets that wrong in exactly the way that looks cheap — every
 * internal detail ringed in light, so the figure reads as embroidery rather
 * than as something glowing.
 *
 * It is also what makes the halo affordable. The ornate forms are hundreds of
 * pieces and a stroke has to be tessellated from every one of them; a
 * silhouette is one rectangle per band whatever is drawn inside it. Simplifying
 * for looks and simplifying for cost turn out to be the same edit, which is
 * usually the sign of the right one — and it buys back enough budget for the
 * halo to be drawn twice, which is what gives it a falloff instead of an edge.
 *
 * Forms already shaped like their own silhouette answer with themselves.
 */
/**
 * Where "too many pieces to light individually" begins, in characters of path.
 *
 * Measured rather than guessed, which matters because guessing got it wrong:
 * a hand-written list of which forms deserved a silhouette put a bar chart
 * behind the zipper, a form that turns out to be one of the cheapest here.
 *
 * The real spread is not close. Drawn over the same spectrum, the thin forms
 * land between 1,200 and 5,300 — slope 1.2k, zipper 2.3k, bars 2.4k, line 4.6k,
 * contour 5.1k — and the stacked ones are an order of magnitude past that:
 * hatch 14k, honeycomb 18k, matrix 28k, skyline 31k, ribs 33k, blocks 44k.
 * There is an empty gap between about 5k and 9k with almost nothing in it, so
 * the line goes there and no form sits near enough to flicker across it.
 *
 * The string's length is the measure because it is a fair proxy for the work a
 * wide stroke has to do — every command in it is a piece to tessellate — and it
 * is free, being already built. It also means the decision follows the look
 * rather than the form: turn a bar chart's density up to a hundred and sixty
 * and it crosses the line on its own.
 */
export const GLOW_COMPLEXITY_LIMIT = 8000;

/**
 * The silhouette to use when a figure is too intricate to light piece by piece.
 *
 * Only reached past the limit above. `pillars` for the skyline because towers
 * stand shoulder to shoulder and the gaps a bar chart leaves would read as
 * light between buildings that are not there.
 */
const GLOW_SILHOUETTES: Partial<Record<GraphStyle, GraphStyle>> = {
  skyline: 'pillars',
  /*
   * The wave family lights as its own body, not as the fallback.
   *
   * The fallback is `area` for a continuous form and `bars` for a discrete
   * one, and both of those stand on the floor. Under a figure that straddles
   * the centre line they would put the halo along the bottom of the plot with
   * the drawing floating above it — light coming from somewhere the shape is
   * not, which is the one thing a glow must never do.
   *
   * `wave-filled` is the family's silhouette because it is the family's
   * outline: every one of these is that body, drawn in pieces.
   */
  'wave-line': 'wave-filled',
  'wave-bars': 'wave-filled',
  'wave-mirror': 'wave-filled',
  'wave-dots': 'wave-filled',
  'wave-ribbon': 'wave-filled',
  'wave-spikes': 'wave-filled',
  'wave-outline': 'wave-filled',
  'wave-lattice': 'wave-filled',
  // The two that stand on the floor, so the floor-standing silhouette is the
  // right one for them.
  'wave-blocks': 'bars',
  fluid: 'bars',
};

export const getGlowStyle = (
  style: GraphStyle,
  pathLength: number,
): GraphStyle => {
  if (pathLength <= GLOW_COMPLEXITY_LIMIT) {
    // Few enough pieces that the light can follow the real thing, which always
    // looks better — it is the actual shape rather than an impression of it.
    return style;
  }
  return (
    GLOW_SILHOUETTES[style] ?? (isDiscreteGraphStyle(style) ? 'bars' : 'area')
  );
};

/**
 * Whether a form has lit tips to offer at all.
 *
 * For the designer, which would otherwise show a switch that does nothing on
 * thirty-five of the thirty-six forms. A control that is off because the form
 * has none is a different thing from one that is off because the user turned
 * it off, and the panel says so rather than leaving them to work it out.
 */
/**
 * Whether a form comes with a lit peak already on.
 *
 * Not whether it can have one — every form can, and the switch is there to
 * be pressed. This is the starting position, which is off for the forms the
 * mark says nothing on: a lit tip suits a stem and reads as damage on a
 * smooth curve, so those open without it rather than being denied it.
 */
/**
 * Which mark a form starts with.
 *
 * The fluid opens on its wave, because that is not decoration on it — it is
 * half of what the form is. Everything else opens on the box, which is the
 * mark this graph has always drawn.
 */
export const getDefaultAccentStyle = (style: GraphStyle): AccentStyle =>
  ACCENTS[style] === 'trace' ? 'wave' : 'bead';

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
/** As wide as a lit peak is ever allowed to be, whatever the density. */
const MAX_ACCENT_BEAD = 7;

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
/**
 * Where a form's drawing actually TOPS OUT, given a reading.
 *
 * A mark goes on the piece, and the piece is not always where the projected
 * point is. Two families put it somewhere else entirely:
 *
 *  - The fluid's bars fill 82% of the pane, because that is the proportion
 *    the titlebar draws them at. Marks taken from the raw point floated a
 *    fifth of the plot above the bars they were marking.
 *  - The mirrored wave forms straddle the centre line rather than standing
 *    on the floor, so their top is half the plot up from the middle — a
 *    completely different mapping, not a scale of the same one.
 *
 * A function per family rather than a fraction, because the second of those
 * cannot be written as a fraction of anything.
 */
const PEAK_ROWS: Partial<
  Record<GraphStyle, (baseline: number, energy: number) => number>
> = {
  fluid: (baseline, energy) => baseline - energy * baseline * 0.82,
  // Floor-standing in the titlebar too, and at full depth rather than 82%.
  'wave-bars': (baseline, energy) => baseline - energy * baseline,
  'wave-blocks': (baseline, energy) => baseline - energy * baseline,
};

/** The mirrored family, whose figure grows out of the middle. */
const MIRRORED_WAVE_FORMS: GraphStyle[] = [
  'wave-line',
  'wave-filled',
  'wave-ribbon',
  'wave-mirror',
  'wave-dots',
  'wave-spikes',
  'wave-outline',
  'wave-lattice',
];
MIRRORED_WAVE_FORMS.forEach((style) => {
  PEAK_ROWS[style] = (baseline, energy) => (baseline / 2) * (1 - energy);
});

/** A peak worth marking: where it is, and how big a mark suits it. */
export interface IGraphPeak {
  x: number;
  y: number;
  /** The piece's own width, capped to something a mark should be. */
  size: number;
  /** How tall it is as a fraction of the plot's depth. */
  energy: number;
}

/**
 * Which peaks are worth lighting, and where.
 *
 * Exported because the answer is the same whatever the mark is, and there are
 * ten of them now — several drawn by the renderer rather than as path data,
 * because they fall, expand or fade and none of that fits in one frame's
 * geometry. Three separate opinions about what counts as a peak is three
 * drawings disagreeing about where the music is.
 */
export const getGraphPeaks = (
  points: readonly Projected[],
  style: GraphStyle,
  baseline: number,
  columns?: number,
): IGraphPeak[] => {
  if (points.length < 3) {
    return [];
  }
  // The same density as the figure, or the marks land between the pieces they
  // are supposed to be sitting on.
  const figure = toColumns(
    points,
    columns === undefined ? getColumnCount(style) : clampGraphColumns(columns),
  );
  if (figure.length < 3) {
    return [];
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
    return [];
  }
  const size = Math.max(2.6, Math.min(MAX_ACCENT_BEAD, step * 0.5));
  const floor = tallest * ACCENT_THRESHOLD;
  const depth = Math.max(1, baseline);
  const peaks: IGraphPeak[] = [];
  let lastX = -Infinity;
  for (
    let index = 1;
    index < figure.length - 1 && peaks.length < MAX_ACCENTS;
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
      const energy = Math.max(0, Math.min(1, (baseline - y) / depth));
      const row = PEAK_ROWS[style];
      peaks.push({
        x,
        // The row the DRAWING reaches, which is not always the point's own.
        y: row ? row(baseline, energy) : y,
        size,
        energy,
      });
    }
  }
  return peaks;
};

export const createGraphAccent = (
  points: readonly Projected[],
  style: GraphStyle,
  baseline: number,
  /** The output envelope, which is what this accent is made of. */
  waveform?: readonly number[],
  /** Which mark. Left out, the form's own starting choice. */
  accentStyle?: AccentStyle,
): string => {
  /**
   * Only the wave is a path.
   *
   * The other nine hang, sink, expand, fly or trail, and none of that exists
   * inside one frame's geometry — so they are painted by the renderer, which
   * is the only place that has the last frame to compare against. See
   * `graphAccents`. This is the one that is simply a curve, and it is the
   * titlebar's own curve at that.
   */
  const accent = accentStyle ?? (ACCENTS[style] === 'trace' ? 'wave' : 'bead');
  if (accent !== 'wave' || points.length < 3) {
    return '';
  }
  const left = points[0][0];
  return createWaveformShape(
    waveform !== undefined && waveform.length >= 2
      ? waveform
      : toWaveSamples(toColumns(points, WAVE_SAMPLE_COUNT), baseline),
    'fluid',
    Math.max(1, points[points.length - 1][0] - left),
    baseline,
    baseline / 2,
    undefined,
    { x: left, y: 0 },
  ).line;
};
