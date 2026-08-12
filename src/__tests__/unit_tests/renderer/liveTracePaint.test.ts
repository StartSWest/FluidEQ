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

/**
 * The live trace's colours used to be decided by the cascade: a `paint`
 * computed in the component, a presentation attribute per path, and a
 * stylesheet rule that overrode some of them by specificity. On a canvas there
 * is no cascade left to appeal to, so those rules are functions now — and this
 * is what checks that they still resolve in the order the stylesheet did.
 *
 * The order is the part worth guarding. Every one of these cases was reachable
 * before and had a definite answer; a plausible-looking rewrite of the
 * conditions gets most of them right and one of them silently wrong.
 */

import {
  IEuphoriaPaint,
  ITraceGradient,
  euphoriaOutlineColour,
  euphoriaTraceColour,
  getWaveTransform,
  isEuphoriaFigureStroke,
  isSelfColouredLook,
  isTraceGradient,
  readEuphoriaHue,
  resolveAccentStroke,
  resolveFigureStroke,
  resolveFigureStrokeWidth,
  resolveGlowStroke,
  resolvePresentedStrokeWidth,
  resolveTracePaint,
} from 'renderer/graph/liveTracePaint';

/** A plot 600 wide and 300 deep, with the usual gutter down the left. */
const PLOT = { left: 50, right: 650, top: 10, bottom: 310 };

const OFF: IEuphoriaPaint = { isOn: false, hue: 0 };
const ON: IEuphoriaPaint = { isOn: true, hue: 200 };

const asGradient = (paint: unknown): ITraceGradient => {
  if (!isTraceGradient(paint as never)) {
    throw new Error('expected a gradient');
  }
  return paint as ITraceGradient;
};

describe('which colour the live trace is painted in', () => {
  it('uses the curve’s own colour when the look brings none', () => {
    expect(resolveTracePaint('signal', [], '#54ff8a', PLOT)).toBe('#54ff8a');
  });

  it('uses a single chosen colour flat, whatever the palette is called', () => {
    // A second stop cannot be painted on a flat fill, and falling through to
    // the curve's colour would silently discard a colour somebody chose.
    expect(resolveTracePaint('signal', ['#ff0000'], '#54ff8a', PLOT)).toBe(
      '#ff0000',
    );
    expect(resolveTracePaint('level', ['#ff0000'], '#54ff8a', PLOT)).toBe(
      '#ff0000',
    );
  });

  it('runs a level ramp up the decibel axis, quiet at the floor', () => {
    // The whole reason `level` means anything: pinned to the plot rather than
    // to the figure, so a colour says how loud a band is and not how loud it is
    // compared with whatever else is on screen this frame.
    const gradient = asGradient(
      resolveTracePaint('level', ['#00e5cf', '#ff4f4f'], '#54ff8a', PLOT),
    );
    expect(gradient.x1).toBe(0);
    expect(gradient.x2).toBe(0);
    expect(gradient.y1).toBe(PLOT.bottom);
    expect(gradient.y2).toBe(PLOT.top);
    expect(gradient.stops).toEqual([
      { offset: 0, colour: '#00e5cf' },
      { offset: 1, colour: '#ff4f4f' },
    ]);
  });

  it('runs a rainbow along the frequency axis, edge to edge', () => {
    const gradient = asGradient(
      resolveTracePaint('rainbow', ['#111111', '#222222'], '#54ff8a', PLOT),
    );
    expect([gradient.x1, gradient.x2]).toEqual([PLOT.left, PLOT.right]);
    expect([gradient.y1, gradient.y2]).toEqual([0, 0]);
  });

  it('spaces the user’s stops evenly, and never divides by zero', () => {
    const gradient = asGradient(
      resolveTracePaint(
        'level',
        ['#000000', '#444444', '#888888', '#ffffff'],
        '#54ff8a',
        PLOT,
      ),
    );
    expect(gradient.stops.map((stop) => stop.offset)).toEqual([
      0,
      1 / 3,
      2 / 3,
      1,
    ]);
  });

  it('falls back to the app’s own spectrum for an uncoloured rainbow', () => {
    // Deliberately not the EQ gradient, which carries a stop per band and so
    // covers whatever slice of the axis the user's bands happen to occupy.
    const gradient = asGradient(
      resolveTracePaint('rainbow', [], '#54ff8a', PLOT),
    );
    expect(gradient.stops.length).toBeGreaterThan(2);
    expect(gradient.stops[0].offset).toBe(0);
    expect(gradient.stops[gradient.stops.length - 1].offset).toBe(1);
  });
});

describe('whether euphoria is allowed to recolour a look', () => {
  it('leaves alone anything that says something with its colour', () => {
    expect(isSelfColouredLook('rainbow', [])).toBe(true);
    expect(isSelfColouredLook('level', ['#ff0000', '#00ff00'])).toBe(true);
    // Tested on the colours rather than the palette's name, so a flat look
    // somebody has deliberately coloured is covered too.
    expect(isSelfColouredLook('signal', ['#ff0000'])).toBe(true);
  });

  it('takes the plain signal trace, which has no scheme to throw away', () => {
    expect(isSelfColouredLook('signal', [])).toBe(false);
  });
});

describe('the stroke cascade, in the order the stylesheet resolved it', () => {
  it('does not stroke a painted form that asked for no border', () => {
    expect(
      resolveFigureStroke('#54ff8a', true, false, false, OFF),
    ).toBeUndefined();
  });

  it('strokes a stroked form in its own paint', () => {
    expect(resolveFigureStroke('#54ff8a', false, false, false, OFF)).toBe(
      '#54ff8a',
    );
  });

  it('gives a painted form an edge when it asked for the cycling border', () => {
    // There has to be something for the hue to run along, so the form that has
    // no stroke of its own grows one.
    expect(resolveFigureStroke('#54ff8a', true, true, true, ON)).toBe(
      euphoriaOutlineColour(ON.hue),
    );
  });

  it('recolours a trace with no colours of its own, fill or no fill', () => {
    // This is the case the old rule reached by specificity: it beat the
    // `stroke: none` attribute, which is why a filled look grows an outline in
    // the mode whether or not it asked for a border.
    expect(resolveFigureStroke('#54ff8a', true, false, false, ON)).toBe(
      euphoriaTraceColour(ON.hue),
    );
    expect(resolveFigureStroke('#54ff8a', false, false, false, ON)).toBe(
      euphoriaTraceColour(ON.hue),
    );
  });

  it('lets the sweep beat the border rule, as specificity did', () => {
    // Both rules matched a bordered, uncoloured look and the recolour won. Get
    // this the other way round and the outline is a different hue from the
    // figure it outlines.
    expect(resolveFigureStroke('#54ff8a', false, true, false, ON)).toBe(
      euphoriaTraceColour(ON.hue),
    );
  });

  it('leaves a self-coloured look its own paint when it wants no border', () => {
    const ramp = resolveTracePaint('rainbow', [], '#54ff8a', PLOT);
    expect(resolveFigureStroke(ramp, false, false, true, ON)).toBe(ramp);
  });
});

describe('whether the stroke is euphoria’s or the look’s own', () => {
  // Which decides where it is drawn, and that is the whole of it: the look's
  // own edge straddles the path the way it always has, and euphoria's is laid
  // outside the figure so the fill it decorates survives underneath. Answer
  // this wrong and a border eats half its width out of a spectrum.
  it('claims both of the cases the sweep reaches', () => {
    expect(isEuphoriaFigureStroke(false, false, ON)).toBe(true);
    expect(isEuphoriaFigureStroke(true, true, ON)).toBe(true);
  });

  it('leaves a self-coloured look that asked for no border alone', () => {
    expect(isEuphoriaFigureStroke(false, true, ON)).toBe(false);
  });

  it('claims nothing at all with the mode off', () => {
    // Including a look with the border switched on: the border is a euphoria
    // setting, so outside the mode there is no border to place anywhere.
    expect(isEuphoriaFigureStroke(true, false, OFF)).toBe(false);
    expect(isEuphoriaFigureStroke(true, true, OFF)).toBe(false);
  });
});

describe('how heavy that stroke is', () => {
  it('leaves the look’s weight alone while there is company on the grid', () => {
    expect(resolvePresentedStrokeWidth(2, false)).toBe(2);
  });

  it('brings the trace forward when it is the only thing drawn', () => {
    // The weight the old SVG path was given in solo, which is where the scale
    // comes from: a look nobody has tuned has to land exactly where it did.
    expect(resolvePresentedStrokeWidth(2, true)).toBeCloseTo(2.6);
  });

  it('scales the user’s own tuning rather than replacing it', () => {
    // The whole reason this is a multiplier. A fixed 2.6 would draw a hairline
    // and a slab as the same trace, so the mode would be quietly overriding a
    // setting the look designer exists to offer.
    const hairline = resolvePresentedStrokeWidth(1, true);
    const slab = resolvePresentedStrokeWidth(6, true);
    expect(hairline).toBeLessThan(slab);
    expect(slab / hairline).toBeCloseTo(6);
  });

  it('keeps the look’s own weight ordinarily', () => {
    expect(resolveFigureStrokeWidth(2.6, 8, false, false)).toBe(2.6);
    expect(resolveFigureStrokeWidth(2.6, 8, true, false)).toBe(2.6);
  });

  it('replaces it with the border’s, rather than adding to it', () => {
    expect(resolveFigureStrokeWidth(2.6, 8, true, true)).toBe(8);
  });
});

describe('the halo and the lit tips', () => {
  it('halos a look in its own paint, gradient and all', () => {
    // For a gradient look that is the very same ramp, so the glow round a
    // spectrum is a spectrum rather than one travelling hue.
    const ramp = resolveTracePaint('level', ['#000', '#fff'], '#54ff8a', PLOT);
    expect(resolveGlowStroke(ramp, true, ON)).toBe(ramp);
  });

  it('carries the trace’s opt-out, so the two never disagree', () => {
    expect(resolveGlowStroke('#54ff8a', false, ON)).toBe(
      euphoriaTraceColour(ON.hue),
    );
    expect(resolveGlowStroke('#54ff8a', false, OFF)).toBe('#54ff8a');
  });

  it('lets the mode reach the tips whatever the look is painted in', () => {
    // Unlike the figure and its halo, the accents never claimed to be
    // self-coloured — so the sweep took them even on a spectrum look.
    expect(resolveAccentStroke('#54ff8a', ON)).toBe(
      euphoriaTraceColour(ON.hue),
    );
    expect(resolveAccentStroke('#54ff8a', OFF)).toBe('#54ff8a');
  });
});

describe('which way up the wave is drawn', () => {
  const DEPTH = 300;

  it('leaves the ordinary trace standing on the floor', () => {
    expect(getWaveTransform({}, DEPTH)).toEqual({ translateY: 0, scaleY: 1 });
  });

  it('hangs a flipped trace from the ceiling without losing the plot', () => {
    // A bare flip would send it off the top of the viewport; the translate is
    // what puts it back, and it maps the plot exactly onto itself.
    const { translateY, scaleY } = getWaveTransform({ isFlipped: true }, DEPTH);
    expect(translateY + scaleY * 0).toBe(DEPTH);
    expect(translateY + scaleY * DEPTH).toBe(0);
  });

  it('grows the mirrored pair in from opposite edges', () => {
    // Baseline at the edges, peaks meeting in the middle.
    const upper = getWaveTransform({ isHalfHeight: true }, DEPTH);
    const lower = getWaveTransform(
      { isHalfHeight: true, isFlipped: true },
      DEPTH,
    );
    // Both baselines land on the centre line, and each peak reaches its own
    // edge — which is what makes it a reflection rather than two waves.
    expect(upper.translateY + upper.scaleY * 0).toBe(DEPTH / 2);
    expect(upper.translateY + upper.scaleY * DEPTH).toBe(DEPTH);
    expect(lower.translateY + lower.scaleY * 0).toBe(DEPTH / 2);
    expect(lower.translateY + lower.scaleY * DEPTH).toBe(0);
  });

  it('grows the centred pair out of the middle', () => {
    // The one that looks like a waveform in an editor: silence a flat line
    // across the centre, a loud frame reaching the top and the bottom together.
    const upper = getWaveTransform(
      { isHalfHeight: true, isFromCentre: true, isFlipped: true },
      DEPTH,
    );
    const lower = getWaveTransform(
      { isHalfHeight: true, isFromCentre: true },
      DEPTH,
    );
    expect(upper.translateY + upper.scaleY * DEPTH).toBe(DEPTH / 2);
    expect(upper.translateY + upper.scaleY * 0).toBe(0);
    expect(lower.translateY + lower.scaleY * DEPTH).toBe(DEPTH / 2);
    expect(lower.translateY + lower.scaleY * 0).toBe(DEPTH);
  });
});

describe('reading the sweep off an element that animates it', () => {
  const styleOf = (value: string) =>
    ({ getPropertyValue: () => value }) as unknown as CSSStyleDeclaration;

  it('takes the angle the compositor is currently at', () => {
    expect(readEuphoriaHue(styleOf('137.5deg'))).toBeCloseTo(137.5);
  });

  it('answers zero rather than NaN when there is nothing to read', () => {
    // A colour built from NaN is not a colour, and canvas would keep the
    // previous fill rather than complain — so the whole frame would silently
    // paint in whatever the last one used.
    expect(readEuphoriaHue(styleOf(''))).toBe(0);
    expect(readEuphoriaHue(styleOf('none'))).toBe(0);
  });
});
