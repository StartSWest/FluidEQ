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
  MAX_GRAPH_COLUMNS,
  getGraphBallistics,
  getGraphColumnCount,
  Projected,
} from 'common/graphStyles';
import {
  GLOW_COMPLEXITY_LIMIT,
  getGlowStyle,
  hasGraphAccent,
  createGraphShape,
  createGraphPieces,
  getDefaultAccentStyle,
  LED_CELL_BUDGET,
} from 'common/graphShapes';

const BASELINE = 300;

/** A spectrum already projected into pixels, sloping down as spectra do. */
const points: Projected[] = Array.from(
  { length: 120 },
  (_value, index) => [index * 4, 60 + index * 1.6] as Projected,
);

describe('open trace glow', () => {
  it.each(['line', 'hatch', 'blocks', 'wave-outline'] as const)(
    'keeps a dense unfilled %s halo open instead of closing along the floor',
    (style) => {
      const glow = getGlowStyle(style, GLOW_COMPLEXITY_LIMIT + 1, false);
      const path = createGraphShape(points, glow, BASELINE);
      expect(path).toContain('Q');
      expect(path).not.toMatch(/Z|,300\.0(?:\s|$)/);
    },
  );

  it('rounds the trace while retaining its endpoints and explicitly closes only its fill', () => {
    const line = createGraphShape(points, 'line', BASELINE);
    expect(line).toMatch(/^M 0\.0,60\.0/);
    expect(line).toMatch(/L 476\.0,250\.4$/);
    expect(line).toContain('Q');
    expect(
      createGraphShape(
        points,
        'line',
        BASELINE,
        undefined,
        undefined,
        0,
        0,
        true,
      ),
    ).toMatch(/Z$/);
  });
});

describe('connected spectrum beads', () => {
  it('draws round closed beads and a filled link between every neighbour', () => {
    const columns = 24;
    const path = createGraphShape(
      points,
      'dots',
      BASELINE,
      columns,
      undefined,
      0.38,
      0,
      true,
    );
    const arcs = [...path.matchAll(/a ([\d.]+),([\d.]+)/g)];
    expect(arcs).toHaveLength(columns * 2);
    arcs.forEach(([, rx, ry]) => {
      expect(Number(rx)).toBeGreaterThan(0);
      expect(rx).toBe(ry);
    });
    expect(path.match(/ Z/g)).toHaveLength(columns * 2 - 1);
    expect(path.match(/ L /g)).toHaveLength((columns - 1) * 3);
  });

  it('grows with the level while still obeying the spacing setting', () => {
    const radius = (y: number, gap: number) => {
      const path = createGraphShape(
        [
          [0, y],
          [100, y],
        ],
        'dots',
        BASELINE,
        2,
        undefined,
        gap,
      );
      return Number(path.match(/a ([\d.]+),/)?.[1]);
    };
    expect(radius(40, 0.38)).toBeGreaterThan(radius(280, 0.38));
    expect(radius(40, 0.8)).toBeLessThan(radius(40, 0));
  });

  it('keeps a readable density and a slower fall than rise', () => {
    expect(getGraphColumnCount('dots')).toBe(48);
    const motion = getGraphBallistics('dots');
    expect(motion.releaseMs).toBeGreaterThanOrEqual(150);
    expect(motion.attackMs).toBeLessThan(motion.releaseMs);
  });
});

describe('readable LED columns', () => {
  /** Every column at full level, `columns` of them across `span` pixels. */
  const fullMeter = (depth: number, columns: number, span: number) => {
    const top = 50;
    return createGraphPieces(
      Array.from(
        { length: columns },
        (_value, index) =>
          [(index * span) / Math.max(1, columns - 1), top] as Projected,
      ),
      'blocks',
      top + depth,
      columns,
      0.26,
      top,
    );
  };
  const cellHeights = (d: string) =>
    Array.from(d.matchAll(/ v ([\d.]+) /g), (match) => Number(match[1]));

  /**
   * A cell is a cell: its shape comes from the column's width, so a taller
   * meter shows more of the same cells rather than stretched ones.
   */
  it.each([300, 900, 1440])(
    'keeps the cell the same landscape shape at a %i pixel depth',
    (depth) => {
      const pieces = fullMeter(depth, 2, 100);
      const reference = cellHeights(fullMeter(300, 2, 100)[0].d)[0];
      // Two columns a hundred pixels apart, less the form's 26% gap.
      const columnWidth = 100 * (1 - 0.26);
      pieces.forEach((piece) => {
        const heights = cellHeights(piece.d);
        expect(heights.length).toBeGreaterThan(0);
        heights.forEach((height) => expect(height).toBe(reference));
        // Wider than tall, which is what reads as an LED segment.
        expect(reference).toBeLessThan(columnWidth);
        expect(piece.energy).toBe(1);
      });
    },
  );

  it('answers a taller meter with more cells, not bigger ones', () => {
    const count = (depth: number) =>
      cellHeights(fullMeter(depth, 2, 100)[0].d).length;
    expect(count(900)).toBeGreaterThan(count(300));
    expect(count(1440)).toBeGreaterThan(count(900));
  });

  /**
   * The count grows with the square of the density: uncapped, the densest
   * setting on a full screen lit about 15,000 cells, six milliseconds a
   * frame just to build. Past the budget the cells grow instead.
   */
  it('keeps the whole meter within its budget at the densest setting', () => {
    const pieces = fullMeter(1900, MAX_GRAPH_COLUMNS, 3700);
    expect(pieces).toHaveLength(MAX_GRAPH_COLUMNS);
    const cells = pieces.reduce(
      (sum, piece) => sum + cellHeights(piece.d).length,
      0,
    );
    expect(cells).toBeLessThanOrEqual(LED_CELL_BUDGET);
    expect(cells).toBeGreaterThan(LED_CELL_BUDGET / 2);
  });

  it('keeps the landscape cell on a full screen well into the dense settings', () => {
    const columns = 64;
    const pieces = fullMeter(1900, columns, 3700);
    const columnWidth = (3700 / (columns - 1)) * (1 - 0.26);
    const heights = cellHeights(pieces[0].d);
    expect(heights.length).toBeGreaterThan(40);
    heights.forEach((height) => expect(height).toBeLessThan(columnWidth));
  });

  it('shares the same LED geometry across whole-figure and per-column palettes', () => {
    const top = 40;
    const whole = createGraphShape(
      points,
      'blocks',
      BASELINE,
      40,
      undefined,
      0.26,
      top,
    );
    const pieces = createGraphPieces(points, 'blocks', BASELINE, 40, 0.26, top);
    expect(whole).toBe(pieces.map((piece) => piece.d).join(''));
    expect(
      createGraphPieces(
        [
          [0, BASELINE],
          [100, BASELINE],
        ],
        'blocks',
        BASELINE,
      ).every((piece) => piece.d === ''),
    ).toBe(true);
  });

  it('starts with falling peak markers and fewer, broader columns', () => {
    expect(hasGraphAccent('blocks')).toBe(true);
    expect(getDefaultAccentStyle('blocks')).toBe('fall');
    expect(getGraphColumnCount('blocks')).toBe(40);
  });
});
