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
} from './graphStyles';
import { createWaveformShape } from './waveformStyles';
import { createGraphScene, isGraphScene } from './graphScenes';
import toColumns from './graphColumns';
import {
  WAVE_FORMS,
  WAVE_SAMPLE_COUNT,
  toWaveSamples,
} from './graphShapeWaves';
import drawGraphForm from './graphShapeForms';

// What the graph's forms are made of lives in the modules beside this one;
// this module stays the one name the rest of the app draws them through.
export {
  ACCENT_STYLES,
  GLOW_COMPLEXITY_LIMIT,
  createGraphAccent,
  getDefaultAccentStyle,
  getGlowStyle,
  getGraphPeaks,
  hasGraphAccent,
} from './graphAccents';
export type { AccentStyle, IGraphPeak } from './graphAccents';
export {
  LED_CELL_BUDGET,
  createGraphPieces,
  createSkylineTowers,
  hasGraphPieces,
} from './graphShapePieces';
export type { IGraphPiece } from './graphShapePieces';
export {
  canConnectGraphMarks,
  createGraphConnector,
  createGraphScatter,
  slopeArrows,
} from './graphShapeMarks';
export type { ISlopeArrow } from './graphShapeMarks';

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
export { default as toColumns } from './graphColumns';

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
  seconds = 0,
  connectingLine = style === 'dots',
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
  if (isGraphScene(style)) {
    return createGraphScene({
      points: figure,
      style,
      top: ceiling,
      bottom: baseline,
      gap,
      filled,
      seconds,
    });
  }
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

  return drawGraphForm({
    points,
    style,
    baseline,
    columns,
    gap,
    ceiling,
    filled,
    connectingLine,
    figure,
    step,
    closedUnder,
    columnWidth,
  });
};
