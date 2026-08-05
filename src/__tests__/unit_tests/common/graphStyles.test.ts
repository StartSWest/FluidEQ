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
  GRAPH_STYLE_LABELS,
  getGraphBallistics,
  getGraphLook,
  GraphStyle,
  Projected,
  createGraphAccent,
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
  it('offers forty-six distinct forms', () => {
    expect(GRAPH_STYLES).toHaveLength(46);
    expect(new Set(GRAPH_STYLES).size).toBe(46);
  });

  it('gives every form a name of its own', () => {
    // Two forms sharing a label is a picker with a duplicate row in it, and
    // the one you cannot reach is whichever the search happens to list second.
    const labels = GRAPH_STYLES.map((style) => GRAPH_STYLE_LABELS[style]);
    expect(new Set(labels).size).toBe(labels.length);
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

  it('hangs the stalactites from the ceiling, not the floor', () => {
    // The whole idea of the form is that it is read upside down. Drawn from
    // the baseline it would be indistinguishable from spikes.
    const path = shapeOf('stalactites');
    expect(path).toMatch(/,0 L/);
    expect(path).not.toContain(BASELINE.toFixed(1));
  });

  it('punches the skyline windows the other way round', () => {
    // A window wound the same way as its building is painted over it rather
    // than cut out of it, and the towers come out solid. The counter-wound
    // subpath starts with a vertical, which the tower never does.
    expect(shapeOf('skyline')).toMatch(/M [\d.-]+,[\d.-]+ v [\d.]+ h/);
  });

  it('draws contours at levels, not at points', () => {
    // Every contour is a horizontal run at a fixed height, so the path is all
    // H commands. A diagonal in here means it has gone back to tracing the
    // curve, which is the one thing this form is not.
    expect(shapeOf('contour')).toMatch(/H/);
    expect(shapeOf('contour')).not.toMatch(/ L /);
  });

  it('keeps the islands above the waterline they are cut at', () => {
    // The land is whatever is louder than the frame's own average, so no part
    // of the figure may reach the floor of the plot.
    const path = shapeOf('islands');
    expect(path).toMatch(/Z/);
    expect(path).not.toContain(BASELINE.toFixed(1));
  });

  it('sizes the bubbles by level rather than drawing them all alike', () => {
    const radii = [...shapeOf('bubbles').matchAll(/a ([\d.]+),/g)].map(
      (match) => Number(match[1]),
    );
    expect(radii.length).toBeGreaterThan(4);
    expect(new Set(radii).size).toBeGreaterThan(1);
  });
});

describe('the lit peaks', () => {
  /** A spectrum with three clear humps in it, of decreasing height. */
  const humps: Projected[] = Array.from({ length: 180 }, (_value, index) => {
    const x = index * 3;
    const hump =
      Math.exp(-((index - 30) ** 2) / 90) * 200 +
      Math.exp(-((index - 90) ** 2) / 90) * 170 +
      Math.exp(-((index - 150) ** 2) / 90) * 60;
    return [x, BASELINE - 20 - hump] as Projected;
  });

  it('marks the peaks and not the slopes between them', () => {
    const marks = [
      ...createGraphAccent(humps, 'stems', BASELINE).matchAll(/M /g),
    ];
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.length).toBeLessThan(6);
  });

  it('ignores a hump that is not loud enough to be a peak', () => {
    // The third one is a third the height of the first. Lighting everything
    // that happens to be a local maximum would put a bead on every ripple in
    // the noise floor, which says nothing about where the music is.
    const path = createGraphAccent(humps, 'stems', BASELINE);
    const xs = [...path.matchAll(/M ([d.-]+),/g)].map((match) =>
      Number(match[1]),
    );
    expect(xs.every((x) => x < 400)).toBe(true);
  });

  it('lights nothing at all when there is nothing to light', () => {
    const silence: Projected[] = Array.from(
      { length: 60 },
      (_value, index) => [index * 8, BASELINE] as Projected,
    );
    expect(createGraphAccent(silence, 'stems', BASELINE)).toBe('');
  });

  it('caps how many can be lit at once', () => {
    // Pink noise makes every other column a local maximum. Without a ceiling
    // the accent becomes a second copy of the whole drawing.
    const noisy: Projected[] = Array.from(
      { length: 300 },
      (_value, index) =>
        [index * 2, BASELINE - 200 - (index % 2) * 20] as Projected,
    );
    const marks = [
      ...createGraphAccent(noisy, 'stems', BASELINE).matchAll(/M /g),
    ];
    expect(marks.length).toBeLessThanOrEqual(10);
  });

  it('is the stems and nothing else', () => {
    // The point of many drawings is that they do not all behave the same way.
    // A lit tip suits a stem and says nothing on a contour map, a slope field
    // or a bridge truss — so exactly one form has one, and this is the test
    // that stops a well-meaning refactor from handing it to everybody again.
    const lit = GRAPH_STYLES.filter(
      (style) => createGraphAccent(humps, style, BASELINE) !== '',
    );
    expect(lit).toEqual(['stems']);
  });

  it('emits no NaN for any form', () => {
    GRAPH_STYLES.forEach((style) => {
      expect(createGraphAccent(humps, style, BASELINE)).not.toMatch(
        /NaN|Infinity|undefined/,
      );
    });
  });
});

describe('graph ballistics', () => {
  it('gives every form a cadence', () => {
    GRAPH_STYLES.forEach((style) => {
      const { attackMs, releaseMs } = getGraphBallistics(style);
      expect(attackMs).toBeGreaterThan(0);
      expect(releaseMs).toBeGreaterThan(0);
    });
  });

  it('always falls slower than it rises', () => {
    // Asymmetry is the point of meter ballistics: catch the transient, then
    // let go of it slowly enough to be seen. A form that released faster than
    // it attacked would flicker rather than pump.
    GRAPH_STYLES.forEach((style) => {
      const { attackMs, releaseMs } = getGraphBallistics(style);
      expect(releaseMs).toBeGreaterThanOrEqual(attackMs);
    });
  });

  it('does not move every form at the same speed', () => {
    // The whole reason the table exists. If a refactor ever collapses it back
    // to one pair of constants, forty drawings go back to being one drawing in
    // forty costumes.
    const cadences = new Set(
      GRAPH_STYLES.map((style) => {
        const { attackMs, releaseMs } = getGraphBallistics(style);
        return `${attackMs}/${releaseMs}`;
      }),
    );
    expect(cadences.size).toBeGreaterThan(10);
  });

  it('lets the pulse and the slope field lead the slow landscapes', () => {
    expect(getGraphBallistics('ecg').attackMs).toBeLessThan(
      getGraphBallistics('contour').attackMs,
    );
    expect(getGraphBallistics('slope').releaseMs).toBeLessThan(
      getGraphBallistics('islands').releaseMs,
    );
  });
});
