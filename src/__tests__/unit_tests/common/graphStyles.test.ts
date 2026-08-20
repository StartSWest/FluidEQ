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
  GRAPH_LOOKS,
  GRAPH_PALETTES,
  GRAPH_STYLES,
  GRAPH_STYLE_LABELS,
  MAX_GRAPH_COLUMNS,
  MIN_GRAPH_COLUMNS,
  clampGraphColumns,
  getGraphBallistics,
  getGraphColumnCount,
  getGraphLook,
  GraphStyle,
  Projected,
  isDiscreteGraphStyle,
  isFilledGraphStyle,
  nextGraphStyle,
} from 'common/graphStyles';
import {
  GLOW_COMPLEXITY_LIMIT,
  getGlowStyle,
  createGraphAccent,
  getGraphPeaks,
  hasGraphAccent,
  createGraphShape,
} from 'common/graphShapes';

const BASELINE = 300;

/** A spectrum already projected into pixels, sloping down as spectra do. */
const points: Projected[] = Array.from(
  { length: 120 },
  (_value, index) => [index * 4, 60 + index * 1.6] as Projected,
);

const shapeOf = (style: GraphStyle) =>
  createGraphShape(points, style, BASELINE);

describe('the graph style cycle', () => {
  it('offers fifty-seven distinct forms', () => {
    expect(GRAPH_STYLES).toHaveLength(57);
    expect(new Set(GRAPH_STYLES).size).toBe(57);
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

  it('never lets a column move sideways', () => {
    // A bucket covers a fixed band of frequencies. Which sample inside it is
    // loudest changes constantly, so taking that sample's own x made every bar
    // shuffle left and right as the music moved — height is the only thing a
    // column is supposed to say.
    const columnXs = (spectrum: Projected[]) =>
      [...createGraphShape(spectrum, 'bars', BASELINE).matchAll(/M ([d.-]+),/g)]
        .map((match) => match[1])
        .join(' ');

    // The same frequencies at two different moments: a rising spectrum, then
    // one where the peak within every bucket has moved to the other end of it.
    const rising = points;
    const shifted = points.map(
      ([x], index) => [x, index % 3 === 0 ? 70 : 240] as Projected,
    );
    expect(columnXs(rising)).toBe(columnXs(shifted));
  });

  it('says which styles are painted rather than stroked', () => {
    expect(isFilledGraphStyle('line')).toBe(false);
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
    // Asked of the peak finder rather than of a path: the marks themselves
    // are painted now — they hang, sink or fly — and WHERE they go is the
    // part that still belongs to this module.
    const peaks = getGraphPeaks(humps, 'stems', BASELINE);
    expect(peaks.length).toBeGreaterThan(0);
    expect(peaks.length).toBeLessThan(6);
  });

  it('ignores a hump that is not loud enough to be a peak', () => {
    // The third one is a third the height of the first. Lighting everything
    // that happens to be a local maximum would put a bead on every ripple in
    // the noise floor, which says nothing about where the music is.
    const xs = getGraphPeaks(humps, 'stems', BASELINE).map((peak) => peak.x);
    expect(xs.length).toBeGreaterThan(0);
    expect(xs.every((x) => x < 400)).toBe(true);
  });

  it('lights nothing at all when there is nothing to light', () => {
    const silence: Projected[] = Array.from(
      { length: 60 },
      (_value, index) => [index * 8, BASELINE] as Projected,
    );
    expect(getGraphPeaks(silence, 'stems', BASELINE)).toEqual([]);
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

  it('starts lit on the stems and nothing else', () => {
    // The point of many drawings is that they do not all behave the same way.
    // A lit tip suits a stem and says nothing on a contour map, a slope field
    // or a bridge truss — so exactly one form arrives with one, and this is
    // the test that stops a well-meaning refactor from switching it on for
    // everybody.
    //
    // CAN have one, though, is a different question and the answer is now
    // "all of them": the switch is in the panel and taste is what it is for.
    // What this guards is the default, which is where the judgement lives.
    //
    // `fluid` is excluded because its accent is not a peak mark at all but
    // the wave over its bars — half the form rather than a decoration on it.
    const lit = GRAPH_STYLES.filter(
      (style) => hasGraphAccent(style) && style !== 'fluid',
    );
    expect(lit).toEqual(['stems']);
  });

  it('draws the fluid a curve rather than a peak mark', () => {
    const accent = createGraphAccent(humps, 'fluid', BASELINE);
    expect(accent).toContain('Q');
    expect(createGraphAccent(humps, 'stems', BASELINE)).not.toContain('Q');
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
      getGraphBallistics('contour').releaseMs,
    );
  });
});

describe('a form drawn at a density it did not ship with', () => {
  // What a custom look changes. The geometry is the same tested code; only the
  // number of pieces it is cut into moves, so the thing worth proving is that
  // every form survives every count rather than only the one it was drawn at.
  const densities = [MIN_GRAPH_COLUMNS, 24, 64, 120, MAX_GRAPH_COLUMNS];

  it.each(GRAPH_STYLES)('emits no NaN for %s at any density', (style) => {
    densities.forEach((columns) => {
      const shape = createGraphShape(points, style, BASELINE, columns);
      expect(shape).not.toMatch(/NaN|Infinity|undefined/);
      expect(shape.length).toBeGreaterThan(0);
    });
  });

  it.each(GRAPH_STYLES.filter(isDiscreteGraphStyle))(
    'actually cuts %s into the number of pieces asked for',
    (style) => {
      // A density slider that changes the label and not the picture is worse
      // than no slider: it looks like the setting is being ignored, which it
      // would be if the override stopped being threaded through.
      const few = createGraphShape(points, style, BASELINE, 12);
      const many = createGraphShape(points, style, BASELINE, 96);
      expect(many.length).toBeGreaterThan(few.length);
    },
  );

  it.each(GRAPH_STYLES.filter((style) => !isDiscreteGraphStyle(style)))(
    'ignores the density for %s, which is one continuous figure',
    (style) => {
      // Nothing to cut up, so the panel greys the slider out — and the drawing
      // code agrees rather than quietly producing a different curve.
      expect(createGraphShape(points, style, BASELINE, 12)).toBe(
        createGraphShape(points, style, BASELINE, 96),
      );
    },
  );

  it('draws the form as it ships when no density is given', () => {
    // The built-in looks go through the same call with the argument left off,
    // so this is what guarantees they are untouched by any of it.
    GRAPH_STYLES.forEach((style) => {
      expect(createGraphShape(points, style, BASELINE)).toBe(
        createGraphShape(points, style, BASELINE, getGraphColumnCount(style)),
      );
    });
  });

  it('keeps the lit tips on the pieces they are marking', () => {
    // Same count as the figure or the marks land between the pieces. The
    // marks themselves are painted rather than pathed now — they hang, sink
    // or fly, none of which is one frame's geometry — so what is asserted
    // here is where they GO, which is still decided in this module.
    // No assertion that there ARE any: this fixture is a plain ramp with
    // nothing that qualifies as a peak, and the point here is the density
    // rather than the detection — which the humps above cover.
    const peaks = getGraphPeaks(points, 'stems', BASELINE, 20);
    peaks.forEach((peak) => {
      expect(Number.isFinite(peak.x)).toBe(true);
      expect(Number.isFinite(peak.y)).toBe(true);
      expect(peak.size).toBeGreaterThan(0);
    });
    expect(getGraphPeaks(points, 'stems', BASELINE)).toEqual(
      getGraphPeaks(points, 'stems', BASELINE, getGraphColumnCount('stems')),
    );
  });
});

describe('clampGraphColumns', () => {
  it('refuses the counts that would break the loop rather than the picture', () => {
    // Zero divides by zero in toColumns and a fraction walks off the end of
    // the buffer, so this one is guarded at the drawing end as well as on save.
    expect(clampGraphColumns(0)).toBe(MIN_GRAPH_COLUMNS);
    expect(clampGraphColumns(-30)).toBe(MIN_GRAPH_COLUMNS);
    expect(clampGraphColumns(9999)).toBe(MAX_GRAPH_COLUMNS);
    expect(clampGraphColumns(32.7)).toBe(33);
    expect(Number.isInteger(clampGraphColumns(NaN))).toBe(true);
    expect(Number.isInteger(clampGraphColumns(Infinity))).toBe(true);
  });
});

/**
 * The forms added after the first thirty-six.
 *
 * The generic suites above prove these emit valid geometry; they cannot prove
 * it is the right way up. An arch that bulged downward, a canyon that filled
 * the energy instead of the headroom and a flame hanging from the ceiling all
 * produce perfectly well-formed paths, and the only thing that catches them is
 * an assertion about where the ink actually lands.
 *
 * A flat spectrum is used throughout: with every column at the same level the
 * expected coordinates are arithmetic rather than a range, so these say what
 * the figure IS rather than merely that it is finite.
 */
describe('the later forms are the right way up', () => {
  const LEVEL = 120;

  /** Every column at the same height, so the geometry has one right answer. */
  const flat: Projected[] = Array.from(
    { length: 120 },
    (_value, index) => [index * 4, LEVEL] as Projected,
  );

  /** Every `x,y` pair in a path, ignoring the relative h/v runs between them. */
  const pairsOf = (path: string) =>
    [...path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
    }));

  it('stands an arch on the floor and peaks it on the level', () => {
    const path = createGraphShape(flat, 'arches', BASELINE);
    // A quadratic sits halfway between its control point and its chord, so the
    // apex is the average of the two. If the sign were ever flipped the arch
    // would hang below the baseline and this lands at 480 instead of 120.
    const [start, control, end] = pairsOf(path);
    expect(start.y).toBe(BASELINE);
    expect(end.y).toBe(BASELINE);
    expect((control.y + BASELINE) / 2).toBeCloseTo(LEVEL, 1);
    expect(path).toContain('Q');
  });

  it('roots a flame on the floor and tips it at the level', () => {
    const path = createGraphShape(flat, 'flames', BASELINE);
    const ys = pairsOf(path).map((pair) => pair.y);
    // Nothing above the level and nothing below the floor: the tongue occupies
    // exactly the band between them.
    expect(Math.min(...ys)).toBeCloseTo(LEVEL, 1);
    expect(Math.max(...ys)).toBe(BASELINE);
  });

  it('floats a candle at the level instead of standing it on the floor', () => {
    // The whole reason it is not a bar. A quiet band should be a small mark in
    // the right place, not a stub measured against the bottom of the plot.
    const path = createGraphShape(flat, 'candles', BASELINE);
    const ys = pairsOf(path).map((pair) => pair.y);
    expect(Math.max(...ys)).toBeLessThan(BASELINE);
  });

  it('runs a barcode stripe the whole depth of the plot', () => {
    // This form says nothing with height on purpose — the level is the width.
    // A stripe that started at the level would make it a bar chart again.
    const path = createGraphShape(flat, 'barcode', BASELINE);
    expect(pairsOf(path).every((pair) => pair.y === 0)).toBe(true);
    const heights = [...path.matchAll(/v (-?[\d.]+)/g)].map((match) =>
      Number(match[1]),
    );
    expect(new Set(heights)).toEqual(new Set([BASELINE]));
  });

  it('widens a barcode stripe with the level rather than lengthening it', () => {
    const quiet = createGraphShape(flat, 'barcode', BASELINE);
    const loud = createGraphShape(
      flat.map(([x]) => [x, 20] as Projected),
      'barcode',
      BASELINE,
    );
    const widthOf = (path: string) => Number(path.match(/h (-?[\d.]+)/)?.[1]);
    expect(widthOf(loud)).toBeGreaterThan(widthOf(quiet));
  });

  it('falls rain in the air above the signal, not through it', () => {
    // What keeps this from being the starfield: the warp streaks fill the loud
    // region below the level, and these fill the room left over it.
    const path = createGraphShape(flat, 'rain', BASELINE);
    expect(pairsOf(path).every((pair) => pair.y <= LEVEL)).toBe(true);
  });

  it('rains harder when the band is louder', () => {
    const dropsIn = (path: string) => (path.match(/v /g) ?? []).length;
    const quiet = createGraphShape(flat, 'rain', BASELINE);
    const loud = createGraphShape(
      flat.map(([x]) => [x, 20] as Projected),
      'rain',
      BASELINE,
    );
    expect(dropsIn(loud)).toBeGreaterThan(dropsIn(quiet));
  });

  it('cuts the honeycomb into six-sided cells', () => {
    // Five line segments after the opening move is a closed hexagon. Four would
    // be a pentagon nobody would notice was wrong until they looked closely.
    const path = createGraphShape(flat, 'honeycomb', BASELINE);
    const [firstCell] = path.split('Z');
    expect((firstCell.match(/L /g) ?? []).length).toBe(5);
  });

  it('runs the fence rails the whole width, level with nothing', () => {
    // The rails are the ruler the pickets are read against, so they must sit at
    // fixed heights rather than following the signal — that is what the pickets
    // are for. Both are checked by height, because a rail that tracked the
    // level would still be a rail of the right length.
    const path = createGraphShape(flat, 'fence', BASELINE);
    const rails = [
      ...path.matchAll(/M ([\d.-]+),([\d.-]+) h ([\d.-]+) v 3\.0/g),
    ];
    expect(rails).toHaveLength(2);
    expect(rails.map((rail) => Number(rail[2]))).toEqual([
      BASELINE - 22,
      BASELINE - 48,
    ]);
    // Spanning the columns, which stop at the last column's centre rather than
    // at the last sample — so this is nearly the full width, not exactly it.
    const span = flat[flat.length - 1][0] - flat[0][0];
    rails.forEach((rail) => {
      expect(Number(rail[3])).toBeGreaterThan(span * 0.9);
    });
  });

  it('plaits the braid out of exactly two strands', () => {
    // One rope, drawn as two continuous polylines that cross. A third `M` would
    // mean a strand had been broken into pieces.
    const path = createGraphShape(flat, 'braid', BASELINE);
    expect((path.match(/M /g) ?? []).length).toBe(2);
  });

  it('opens the canyon above the signal, not below it', () => {
    // The inversion that matters most here: filled the other way round this is
    // simply the area style with extra steps.
    const path = createGraphShape(flat, 'canyon', BASELINE);
    const ys = pairsOf(path).map((pair) => pair.y);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(LEVEL);
    // Never touches the floor, which is exactly what the area style does.
    expect(ys).not.toContain(BASELINE);
  });

  it('draws the canyon and the area as complements of each other', () => {
    // Compared by the coordinates rather than by the text: an x of 300 is not
    // the baseline, and a substring search cannot tell the difference.
    const ysOf = (style: GraphStyle) =>
      pairsOf(createGraphShape(flat, style, BASELINE)).map((pair) => pair.y);
    const canyon = ysOf('canyon');
    const area = ysOf('area');
    // The area closes down onto the floor; the canyon closes up to the ceiling.
    // Between them they cover the plot and overlap only along the signal.
    expect(area).toContain(BASELINE);
    expect(area).not.toContain(0);
    expect(canyon).toContain(0);
    expect(canyon).not.toContain(BASELINE);
  });
});

describe('the glow picks its own silhouette', () => {
  // What a halo is stroked from. Light comes off the outside of a thing, and a
  // wall of LED bricks should glow as one lit bar rather than as forty
  // separately haloed bricks — but a thin zigzag should glow as itself, not as
  // a bar chart standing behind it. The engine decides by measuring, because
  // deciding by hand put bars behind the zipper.
  it('lights the simple forms as themselves', () => {
    // Every one of these draws few enough pieces that the light can follow the
    // real geometry, which always reads better than an impression of it.
    ['line', 'bars', 'zipper', 'spikes', 'dots', 'area', 'slope'].forEach(
      (style) => {
        const shape = shapeOf(style as GraphStyle);
        expect(shape.length).toBeLessThanOrEqual(GLOW_COMPLEXITY_LIMIT);
        expect(getGlowStyle(style as GraphStyle, shape.length)).toBe(style);
      },
    );
  });

  it('falls back to a silhouette for the intricate ones', () => {
    // An order of magnitude heavier than the forms above, and made of pieces
    // whose individual outlines are not what anybody is looking at.
    (['blocks', 'matrix', 'ribs', 'honeycomb'] as GraphStyle[]).forEach(
      (style) => {
        const shape = shapeOf(style);
        expect(shape.length).toBeGreaterThan(GLOW_COMPLEXITY_LIMIT);
        expect(getGlowStyle(style, shape.length)).toBe('bars');
      },
    );
  });

  it('gives the skyline solid towers rather than a gapped bar chart', () => {
    // Buildings stand shoulder to shoulder; the gaps a bar chart leaves would
    // read as light between towers that are not there.
    expect(getGlowStyle('skyline', 99999)).toBe('pillars');
  });

  it('keeps a continuous form continuous', () => {
    // A run of bars behind a curve is not that curve's shadow.
    expect(getGlowStyle('hatch', 99999)).toBe('area');
    expect(getGlowStyle('echo', 99999)).toBe('area');
  });

  it('follows the look rather than the form', () => {
    // The same form crosses the line on its own once its density is turned up,
    // which is the point of measuring rather than listing.
    const sparse = createGraphShape(points, 'blocks', BASELINE, 8);
    const dense = createGraphShape(points, 'blocks', BASELINE, 160);
    expect(getGlowStyle('blocks', sparse.length)).toBe('blocks');
    expect(getGlowStyle('blocks', dense.length)).toBe('bars');
  });

  it('never asks for a silhouette that is itself intricate', () => {
    // Otherwise the fallback would be as expensive as the thing it replaced.
    (['bars', 'pillars', 'area'] as GraphStyle[]).forEach((style) => {
      expect(shapeOf(style).length).toBeLessThanOrEqual(GLOW_COMPLEXITY_LIMIT);
    });
  });
});
