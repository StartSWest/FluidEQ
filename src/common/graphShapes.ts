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
