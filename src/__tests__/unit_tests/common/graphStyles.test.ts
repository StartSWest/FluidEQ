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

import {
  GRAPH_LOOKS,
  GRAPH_PALETTES,
  GRAPH_STYLES,
  getGraphLook,
  GraphStyle,
  Projected,
  createGraphShape,
  isFilledGraphStyle,
  nextGraphStyle,
} from 'common/graphStyles';

const BASELINE = 300;

/** A spectrum already projected into pixels, sloping down as spectra do. */
const points: Projected[] = Array.from(
  { length: 120 },
  (_value, index) => [index * 4, 60 + index * 1.6] as Projected,
);

const shapeOf = (style: GraphStyle) =>
  createGraphShape(points, style, BASELINE);

describe('the graph style cycle', () => {
  it('offers twenty distinct forms', () => {
    expect(GRAPH_STYLES).toHaveLength(20);
    expect(new Set(GRAPH_STYLES).size).toBe(20);
  });

  it('pairs every form with every palette, and no id repeats', () => {
    // Generated rather than listed, so a new form brings its whole row — the
    // failure this guards is a look that exists in the geometry but cannot be
    // chosen because nobody added it to the menu.
    expect(GRAPH_LOOKS).toHaveLength(
      GRAPH_STYLES.length * GRAPH_PALETTES.length,
    );
    expect(new Set(GRAPH_LOOKS.map((look) => look.id)).size).toBe(
      GRAPH_LOOKS.length,
    );
  });

  it('names every look, so the search has something to match', () => {
    GRAPH_LOOKS.forEach((look) => {
      expect(look.label.trim().length).toBeGreaterThan(0);
    });
  });

  it('falls back to the first look for an id it does not know', () => {
    expect(getGraphLook('nonsense')).toBe(GRAPH_LOOKS[0]);
  });

  it('comes back round', () => {
    let style: GraphStyle = GRAPH_STYLES[0];
    GRAPH_STYLES.forEach(() => {
      style = nextGraphStyle(style);
    });
    expect(style).toBe(GRAPH_STYLES[0]);
  });

  it('recovers from a style this build has never heard of', () => {
    expect(GRAPH_STYLES).toContain(
      nextGraphStyle('from-the-future' as GraphStyle),
    );
  });
});

describe('every graph style', () => {
  it.each(GRAPH_STYLES)('draws something for %s', (style) => {
    expect(shapeOf(style).length).toBeGreaterThan(0);
  });

  it.each(GRAPH_STYLES)('emits no NaN for %s', (style) => {
    // A single NaN blanks the whole path, which looks exactly like the live
    // output having stopped rather than like a drawing bug.
    expect(shapeOf(style)).not.toMatch(/NaN|Infinity|undefined/);
  });

  it.each(GRAPH_STYLES.filter(isFilledGraphStyle))(
    'closes its figure for %s, because it is painted',
    (style) => {
      // A painted style that is not closed leaves the fill to be guessed by
      // the renderer, which joins the gap in a straight line from wherever the
      // path happened to stop.
      expect(shapeOf(style)).toMatch(/Z/);
    },
  );

  it.each(GRAPH_STYLES.filter((style) => !isFilledGraphStyle(style)))(
    'is stroked rather than painted for %s',
    (style) => {
      expect(isFilledGraphStyle(style)).toBe(false);
    },
  );
});

describe('createGraphShape', () => {
  it('draws nothing when there is nothing to draw', () => {
    expect(createGraphShape([], 'area', BASELINE)).toBe('');
    expect(createGraphShape([[0, 0]], 'bars', BASELINE)).toBe('');
  });

  it('stands the filled styles on the baseline', () => {
    // The bars hang from their level down to the floor of the plot; a bar
    // measured from zero decibels instead would float in the middle of it.
    expect(shapeOf('area')).toContain(BASELINE.toFixed(1));

    // A bar carries its height rather than the floor's coordinate, so the
    // property is checked rather than the text: top plus height is the floor.
    const [firstBar] = [
      ...shapeOf('bars').matchAll(/M [\d.-]+,([\d.-]+) h [\d.-]+ v ([\d.-]+)/g),
    ];
    expect(Number(firstBar[1]) + Number(firstBar[2])).toBeCloseTo(BASELINE, 1);
  });

  it('keeps bars an even width across a logarithmic axis', () => {
    // Spacing is taken from the average rather than each neighbour: on a log
    // axis the gap at 20Hz is a fraction of the gap at 20kHz, so per-pair
    // widths would give hair-thin bars at one end and slabs at the other.
    const path = shapeOf('bars');
    const widths = [...path.matchAll(/h (-?[\d.]+)/g)]
      .map((match) => Math.abs(Number(match[1])))
      .filter((width) => width > 0);
    expect(new Set(widths).size).toBe(1);
  });

  it('says which styles are painted rather than stroked', () => {
    expect(isFilledGraphStyle('line')).toBe(false);
    expect(isFilledGraphStyle('comb')).toBe(false);
    expect(isFilledGraphStyle('steps')).toBe(false);
    expect(isFilledGraphStyle('area')).toBe(true);
    expect(isFilledGraphStyle('bars')).toBe(true);
  });
});
