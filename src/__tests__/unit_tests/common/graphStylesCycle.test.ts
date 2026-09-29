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

import { isAnalysisStyle } from 'common/graphAnalysis';
import { isSceneViewStyle } from 'common/graphSceneViews';
import {
  DEFAULT_GRAPH_LOOK,
  GRAPH_LOOKS,
  canGraphFill,
  GRAPH_PALETTES,
  GRAPH_STYLES,
  SELECTABLE_GRAPH_STYLES,
  GRAPH_STYLE_LABELS,
  getGraphLook,
  GraphStyle,
  Projected,
  isFilledGraphStyle,
  nextGraphStyle,
} from 'common/graphStyles';
import { createGraphShape, createGraphPieces } from 'common/graphShapes';

const BASELINE = 300;

/** A spectrum already projected into pixels, sloping down as spectra do. */
const points: Projected[] = Array.from(
  { length: 120 },
  (_value, index) => [index * 4, 60 + index * 1.6] as Projected,
);

const shapeOf = (style: GraphStyle) =>
  createGraphShape(points, style, BASELINE);

/**
 * The forms this file's geometry actually draws.
 *
 * The measuring views are in the catalogue — they are looks, they are
 * picked, tuned and cycled like any other — but none of them is one path, so
 * none is built by `createGraphShape`: a raster, a stack of fifty-six
 * figures and a box of instruments have nothing to hand back. They are drawn
 * by `renderer/graph/analysis` and tested there. The drawn scenes are the
 * same: each is layers, lights and particles, drawn by
 * `renderer/graph/sceneViews`.
 */
const DRAWN_HERE = GRAPH_STYLES.filter(
  (style) => !isAnalysisStyle(style) && !isSceneViewStyle(style),
);

describe('the graph style cycle', () => {
  it('offers eighty-nine distinct forms', () => {
    expect(GRAPH_STYLES).toHaveLength(89);
    expect(new Set(GRAPH_STYLES).size).toBe(89);
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

  it('falls back to the default look for an id it does not know', () => {
    // Not "the first look", which is only whichever form happens to be
    // written first in the cycle order — a list people append to. A stored
    // preference naming a form this build does not have lands on the same
    // drawing a fresh install starts with.
    expect(getGraphLook('nonsense')).toBe(DEFAULT_GRAPH_LOOK);
    expect(DEFAULT_GRAPH_LOOK.style).toBe('analyzer');
    expect(DEFAULT_GRAPH_LOOK.palette).toBe('auto');
  });

  it('comes back round', () => {
    let style: GraphStyle = GRAPH_STYLES[0];
    SELECTABLE_GRAPH_STYLES.forEach(() => {
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
  it.each(DRAWN_HERE)('draws something for %s', (style) => {
    expect(shapeOf(style).length).toBeGreaterThan(0);
  });

  it.each(DRAWN_HERE)('emits no NaN for %s', (style) => {
    // A single NaN blanks the whole path, which looks exactly like the live
    // output having stopped rather than like a drawing bug.
    expect(shapeOf(style)).not.toMatch(/NaN|Infinity|undefined/);
  });

  it.each(DRAWN_HERE.filter(isFilledGraphStyle))(
    'closes its figure for %s, because it is painted',
    (style) => {
      // A painted style that is not closed leaves the fill to be guessed by
      // the renderer, which joins the gap in a straight line from wherever the
      // path happened to stop.
      expect(
        createGraphShape(
          points,
          style,
          BASELINE,
          undefined,
          undefined,
          0,
          0,
          true,
        ),
      ).toMatch(/Z/);
    },
  );

  it.each(DRAWN_HERE.filter((style) => !isFilledGraphStyle(style)))(
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
    expect(path).toMatch(/,0\.0 L/);
    expect(path).not.toContain(BASELINE.toFixed(1));
  });

  /**
   * The towers are solid silhouettes and the city scene paints the lit
   * windows onto them; punched-out windows took the colour of whatever was
   * behind the graph. A punched window is a counter-wound subpath, which
   * starts with a vertical — a tower never does.
   */
  it('stands the skyline towers solid, and keeps each roof from frame to frame', () => {
    expect(shapeOf('skyline')).not.toMatch(/M [\d.-]+,[\d.-]+ v /);

    // The same city at two levels, every tower well above the mast line.
    const city = (lift: number) =>
      createGraphPieces(
        points.map(([x]) => [x, 40 + lift] as Projected),
        'skyline',
        BASELINE,
        26,
        0.12,
        20,
      );
    const parts = (d: string) => (d.match(/M /g) ?? []).length;
    const roofs = city(0).map((piece) => parts(piece.d));
    // A building keeps its roof as the music moves it...
    expect(city(30).map((piece) => parts(piece.d))).toEqual(roofs);
    // ...and the city has more than one kind of roof.
    expect(new Set(roofs).size).toBeGreaterThan(1);
  });

  it('draws contours at levels, not at points', () => {
    // Every contour is a horizontal run at a fixed height. A diagonal in here
    // means it has gone back to tracing the curve, which is the one thing this
    // form is not. Either case of the horizontal command counts: the runs are
    // closed bands now rather than bare segments, so they are written
    // relative, and the letter is not the thing being tested.
    expect(shapeOf('contour')).toMatch(/h/i);
    expect(shapeOf('contour')).not.toMatch(/ L /i);
  });

  it('gives its contours area, so painting them draws something', () => {
    // Bare segments enclose nothing, so the look's Filled switch painted an
    // empty path and the form disappeared from the pane — which reads as the
    // capture having died rather than as a setting.
    const d = shapeOf('contour');
    expect(d).toMatch(/Z/);
    expect(d).toMatch(/a [1-9][\d.]*,[1-9][\d.]* 0 0 1 0,[1-9][\d.]*/);
  });

  it('leaves every fillable form something to paint', () => {
    // A path with no closed subpath in it paints nothing, and an empty pane
    // reads as the capture having died rather than as a switch having been
    // thrown. Whatever the form is, if the picker offers Filled for it then
    // asking for it has to draw.
    // The bridge is the one exception: its deck is a line over open water
    // in both variants, and Filled makes its towers and piers solid — the
    // renderer paints those, not the shape.
    DRAWN_HERE.filter(canGraphFill)
      .filter((style) => style !== 'truss')
      .forEach((style) => {
        expect(
          createGraphShape(
            points,
            style,
            BASELINE,
            undefined,
            undefined,
            0,
            0,
            true,
          ),
        ).toMatch(/Z/);
      });
  });

  it('does not frame the stroked forms in a box to achieve it', () => {
    // The positive control for the test above. Closing these to the floor
    // unconditionally would satisfy it while growing a hairline along the
    // bottom of the plot and a vertical up each side — a frame drawn round a
    // line nobody asked to frame. Stroked, they must still be open.
    (['line', 'steps', 'bezier', 'ecg', 'echo'] as GraphStyle[]).forEach(
      (style) => {
        expect(shapeOf(style)).not.toMatch(/Z/);
      },
    );
  });

  it('offers Filled only where a form has an inside', () => {
    // Marks have no inside: dashes float, ribs are rungs, hatching is the
    // absence of a fill by design. The wave three are stroke-only on the
    // titlebar's own authority, which is where those figures are defined.
    expect(canGraphFill('hatch')).toBe(false);
    expect(canGraphFill('dashes')).toBe(false);
    expect(canGraphFill('wave-lattice')).toBe(false);
    expect(canGraphFill('line')).toBe(true);
    expect(canGraphFill('bars')).toBe(true);
  });

  it('keeps the mirrored wave inside the plot it was given', () => {
    // The wave family is the only one that straddles a centre line, so it is
    // the only one that has to be told where the plot's ceiling is. Told
    // nothing, it centred itself on half the floor's distance from the top of
    // the card and its crest climbed above the plot, where it was cut off.
    const flat: [number, number][] = [];
    for (let index = 0; index < 96; index += 1) {
      // A full-scale reading, sitting right on the ceiling.
      flat.push([30 + index * 6, 40]);
    }
    const topOf = (d: string) =>
      Math.min(
        ...[...d.matchAll(/[-\d.]+,([-\d.]+)/g)]
          .map((match) => Number(match[1]))
          .filter((y) => Number.isFinite(y)),
      );
    // The positive control: the assumption this fixed, reproduced by making
    // it again. Without it, "stays below the ceiling" would also pass on a
    // form that had stopped drawing anything at all.
    expect(
      topOf(createGraphShape(flat, 'wave-line', 300, 64, undefined, 0, 0)),
    ).toBeLessThan(40);
    expect(
      topOf(createGraphShape(flat, 'wave-line', 300, 64, undefined, 0, 40)),
    ).toBeGreaterThanOrEqual(39);
  });

  it('sizes the bubbles by level rather than drawing them all alike', () => {
    const radii = [...shapeOf('bubbles').matchAll(/a ([\d.]+),/g)].map(
      (match) => Number(match[1]),
    );
    expect(radii.length).toBeGreaterThan(4);
    expect(new Set(radii).size).toBeGreaterThan(1);
  });
});
