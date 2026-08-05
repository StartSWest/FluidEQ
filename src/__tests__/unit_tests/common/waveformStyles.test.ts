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
  WAVEFORM_STYLES,
  WaveformStyle,
  createWaveformShape,
  nextWaveformStyle,
} from 'common/waveformStyles';

const WIDTH = 420;
const HEIGHT = 58;
const AMPLITUDE = 25;

/** A frame with something in it, so no style has an excuse to draw nothing. */
const samples = Array.from({ length: 96 }, (_value, index) =>
  Math.sin((index / 96) * Math.PI * 6),
);

const shapeOf = (style: WaveformStyle) =>
  createWaveformShape(samples, style, WIDTH, HEIGHT, AMPLITUDE);

describe('the style cycle', () => {
  it('offers ten', () => {
    expect(WAVEFORM_STYLES).toHaveLength(10);
    expect(new Set(WAVEFORM_STYLES).size).toBe(10);
  });

  it('comes back round', () => {
    const seen = new Set<WaveformStyle>();
    let style: WaveformStyle = WAVEFORM_STYLES[0];
    for (let step = 0; step < WAVEFORM_STYLES.length; step += 1) {
      seen.add(style);
      style = nextWaveformStyle(style);
    }
    // Every style reachable, and back to the start.
    expect(seen.size).toBe(10);
    expect(style).toBe(WAVEFORM_STYLES[0]);
  });

  it('recovers from a style this build has never heard of', () => {
    // A value left in storage by a build with a different set. Getting stuck
    // outside the cycle would mean a meter that cannot be changed back.
    expect(WAVEFORM_STYLES).toContain(
      nextWaveformStyle('from-the-future' as WaveformStyle),
    );
  });
});

describe('every style', () => {
  it.each(WAVEFORM_STYLES)('draws something for %s', (style) => {
    const shape = shapeOf(style);
    expect(
      shape.line.length + shape.mirror.length + shape.fill.length,
    ).toBeGreaterThan(0);
  });

  it.each(WAVEFORM_STYLES)('emits only valid path data for %s', (style) => {
    const shape = shapeOf(style);
    // NaN in a path silently blanks the whole element, which is the failure
    // mode worth guarding: it looks exactly like "the meter stopped working".
    [shape.line, shape.mirror, shape.fill].forEach((path) => {
      expect(path).not.toMatch(/NaN|Infinity|undefined/);
    });
  });

  it.each(WAVEFORM_STYLES)('stays inside its box for %s', (style) => {
    const shape = shapeOf(style);
    const numbers = `${shape.line} ${shape.mirror} ${shape.fill}`
      .split(/[^-\d.]+/)
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);
    // Generous, because a stroke has width and the bar styles measure from the
    // floor — but a coordinate wildly outside means the geometry is wrong.
    numbers.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(-HEIGHT);
      expect(value).toBeLessThanOrEqual(WIDTH + HEIGHT);
    });
  });
});

describe('createWaveformShape', () => {
  it('draws nothing at all when there is nothing to draw', () => {
    // One sample cannot describe a shape, and dividing by its zero-length step
    // would put NaN through every coordinate.
    const shape = createWaveformShape([0.5], 'line', WIDTH, HEIGHT, AMPLITUDE);
    expect(shape).toEqual({ line: '', mirror: '', fill: '' });
  });

  it('gives the filled styles a closed figure', () => {
    expect(shapeOf('filled').fill).toMatch(/Z\s*$/);
    expect(shapeOf('ribbon').fill).toMatch(/Z\s*$/);
  });

  it('leaves the line styles nothing to fill', () => {
    // A stroke-only style handing back fill data would paint a solid blob
    // under it.
    expect(shapeOf('line').fill).toBe('');
    expect(shapeOf('outline').fill).toBe('');
    expect(shapeOf('lattice').fill).toBe('');
  });

  it('grows with the signal', () => {
    const quiet = createWaveformShape(
      samples.map((sample) => sample * 0.1),
      'mirror-bars',
      WIDTH,
      HEIGHT,
      AMPLITUDE,
    );
    const loud = shapeOf('mirror-bars');
    // Same command count, different geometry: the bars are taller, so the
    // path is not identical.
    expect(loud.fill).not.toBe(quiet.fill);
  });
});
