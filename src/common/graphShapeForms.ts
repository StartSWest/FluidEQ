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
import {
  createGraphConnector,
  createGraphScatter,
  polyline,
  slopeArrows,
  smoothPolyline,
} from './graphShapeMarks';
import { createGraphPieces } from './graphShapePieces';
import { createGraphStems } from './graphStems';
import createGraphTerrace from './graphTerrace';
import createTrussRoad from './graphTruss';
import createGraphStalactites from './graphStalactites';

// Every form the graph draws its spectrum in, one case each, from the
// figures createGraphShape works out first. Its own file because the forms
// alone are eight hundred lines.

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
 * What every form in the switch reads: createGraphShape's arguments, and the
 * figures it works out once for all of them before a form is chosen.
 */
interface IGraphForm {
  points: readonly Projected[];
  style: GraphStyle;
  baseline: number;
  columns: number | undefined;
  gap: number;
  ceiling: number;
  filled: boolean;
  connectingLine: boolean;
  /** The points, or their columns for a form drawn per column. */
  figure: readonly Projected[];
  step: number;
  /** A trace shut against the floor. */
  closedUnder: (trace: string, fromX?: number, toX?: number) => string;
  /** A column's width at the form's gap, never under `floorPx`. */
  columnWidth: (floorPx: number) => number;
}

/**
 * The path a style draws, one case each: the body of createGraphShape once it
 * has the figures every form shares.
 */
const drawGraphForm = ({
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
}: IGraphForm): string => {
  switch (style) {
    case 'line':
      // Round the joins without inventing an oscillation between readings.
      // Sharp FFT-bin corners became a jagged wire at full-screen height.
      return filled
        ? closedUnder(smoothPolyline(points))
        : smoothPolyline(points);

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
      return createGraphPieces(points, style, baseline, columns, gap, ceiling)
        .map((piece) => piece.d)
        .join('');

    case 'dots': {
      const depth = Math.max(1, baseline - ceiling);
      const reach = Math.min(columnWidth(1.6) / 2, depth * 0.08);
      // A narrow filled ribbon shares the beads' paint and works even when
      // Edit disables borders. Joining centres leaves no gaps on steep slopes.
      const thread = Math.min(0.8, reach * 0.12);
      let path = connectingLine ? createGraphConnector(figure, thread) : '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        // A bead grows with its band, while the centre still reports the
        // actual level. Closed arcs stay round with both fill and border.
        const energy = Math.max(0, Math.min(1, (baseline - y) / depth));
        const radius = reach * (0.48 + 0.52 * Math.sqrt(energy));
        const r = radius.toFixed(2);
        const diameter = (radius * 2).toFixed(2);
        path += `M ${(x - radius).toFixed(2)},${y.toFixed(2)} a ${r},${r} 0 1,0 ${diameter},0 a ${r},${r} 0 1,0 -${diameter},0 Z`;
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
      return createGraphPieces(points, style, baseline, columns, gap, ceiling)
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

    case 'stems':
      return createGraphStems(figure, baseline, gap).shape;

    case 'terrace': {
      const terrace = createGraphTerrace(figure, baseline);
      return filled ? terrace.shape : terrace.outline;
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
      return createGraphScatter(points, figure.length, gap).shape;
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
      const pitch = 9;
      const thickness = Math.min(2.4, width * 0.4);
      const radius = thickness / 2;
      let path = '';
      for (let index = 0; index < figure.length; index += 1) {
        const [x, y] = figure[index];
        // Closed rounded rungs make Fill a real opacity control. Starting at
        // the crest also lets the top rung follow small musical changes.
        for (let at = y; at + thickness < baseline; at += pitch) {
          const left = x - width / 2;
          const span = (width - thickness).toFixed(1);
          const r = radius.toFixed(1);
          const h = thickness.toFixed(1);
          path += `M ${(left + radius).toFixed(1)},${at.toFixed(1)} h ${span} a ${r},${r} 0 0 1 0,${h} h -${span} a ${r},${r} 0 0 1 0,-${h} Z`;
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
      const weight = Math.max(1.5, Math.min(3, spacing * 0.3));
      const band = (from: number, to: number, level: number) => {
        const radius = Math.min(weight / 2, Math.max(0.2, (to - from) / 2));
        const span = Math.max(0, to - from - radius * 2).toFixed(1);
        const r = radius.toFixed(1);
        const h = (radius * 2).toFixed(1);
        return `M ${(from + radius).toFixed(1)},${(level - radius).toFixed(1)} h ${span} a ${r},${r} 0 0 1 0,${h} h -${span} a ${r},${r} 0 0 1 0,-${h} Z`;
      };
      for (let level = baseline - spacing; level > ceiling; level -= spacing) {
        let from: number | undefined;
        for (let index = 0; index < points.length; index += 1) {
          const [x, y] = points[index];
          const [previousX, previousY] = points[Math.max(0, index - 1)];
          // Interpolate the threshold crossing: snapping to a whole FFT bin
          // made contour ends jump sideways during an otherwise smooth fall.
          const crossing =
            previousY === y
              ? x
              : previousX +
                (x - previousX) *
                  Math.max(
                    0,
                    Math.min(1, (level - previousY) / (y - previousY)),
                  );
          if (y <= level && from === undefined) {
            from = crossing;
          } else if (y > level && from !== undefined) {
            path += band(from, crossing, level);
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
      // the pieces underneath it. With the plot's ceiling, as the pieces are
      // asked for and as the city tests a mast for its beacon: without it a
      // tower measured against the whole canvas grew no mast where the city
      // lit a beacon over its flat roof.
      return createGraphPieces(points, style, baseline, columns, gap, ceiling)
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
      const road = createTrussRoad(figure);
      const joints = road.filter((_point, index) => index % 8 === 0);
      let path = `${polyline(road)} M ${figure[0][0]},${baseline} H ${figure[figure.length - 1][0]}`;
      for (let index = 0; index < figure.length - 1; index += 1) {
        const [x, y] = joints[index];
        const [nextX, nextY] = joints[index + 1];
        path += ` M ${x.toFixed(1)},${y.toFixed(1)} V ${baseline.toFixed(1)}`;
        path +=
          index % 2 === 0
            ? ` M ${x.toFixed(1)},${y.toFixed(1)} L ${nextX.toFixed(1)},${baseline.toFixed(1)}`
            : ` M ${x.toFixed(1)},${baseline.toFixed(1)} L ${nextX.toFixed(1)},${nextY.toFixed(1)}`;
      }
      const last = joints[joints.length - 1];
      path += ` M ${last[0].toFixed(1)},${last[1].toFixed(1)} V ${baseline.toFixed(1)}`;
      // Filled or not, the truss is open: the bridge's "filled" variant is
      // its towers and piers going solid, and the water under the deck
      // stays in view.
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
      const { length, wing, spread, arrows } = slopeArrows(figure, gap);
      let path = '';
      for (let index = 0; index < arrows.length; index += 1) {
        const { x, y, ux, uy } = arrows[index];
        const halfX = ux * (length / 2);
        const halfY = uy * (length / 2);
        path += `M ${(x - halfX).toFixed(1)},${(y - halfY).toFixed(1)} L ${(
          x + halfX
        ).toFixed(1)},${(y + halfY).toFixed(1)} `;
        const tipX = x + halfX;
        const tipY = y + halfY;
        path += `M ${(tipX - ux * wing - uy * wing * spread).toFixed(1)},${(tipY - uy * wing + ux * wing * spread).toFixed(1)} L ${tipX.toFixed(1)},${tipY.toFixed(1)} L ${(tipX - ux * wing + uy * wing * spread).toFixed(1)},${(tipY - uy * wing - ux * wing * spread).toFixed(1)} `;
      }
      return path.trim();
    }

    // Hung from the ceiling rather than stood on the floor. The same numbers,
    // read upside down — loud is long, and the shape grows towards you from
    // the top of the plot instead of away from the bottom.
    case 'stalactites': {
      return createGraphStalactites(figure, baseline, ceiling, gap).shape;
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
      // Filled, the picker shows the storm's cloud bank as well: a band
      // along the top whose base hangs lower where the band is loud, which
      // is what the running scene makes of the same numbers.
      if (filled && figure.length >= 2) {
        const depth = Math.max(1, baseline - ceiling);
        let cloud = `M ${figure[0][0].toFixed(1)},${ceiling.toFixed(1)}`;
        for (let index = 0; index < figure.length; index += 1) {
          const [x, y] = figure[index];
          const hang = 0.06 + Math.max(0, (baseline - y) / depth) * 0.42;
          cloud += ` L ${x.toFixed(1)},${(ceiling + depth * hang).toFixed(1)}`;
        }
        cloud += ` L ${figure[figure.length - 1][0].toFixed(1)},${ceiling.toFixed(1)} Z`;
        path += cloud;
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

export default drawGraphForm;
