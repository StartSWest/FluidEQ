/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import * as d3 from 'd3';
import { eqGainScale } from 'renderer/graph/ChartController';
import { gainPixelsOf } from 'renderer/graph/smartEqDustDraw';

/**
 * The forming curve's points are placed on the gain axis without asking the
 * axis for each one (`gainPixelsOf`): the same straight piece around 0 dB,
 * worked out directly, and the axis itself past it. Two things to hold: the
 * pixels are the axis's own, everywhere it reaches, and the axis is really
 * not asked inside that piece — the reason for it, measured as two thirds of
 * the dust's time in the dev window (2026-11-27).
 */

/** A scale that counts how often it is asked, beside the one it wraps. */
const counting = (scale: d3.ScaleLinear<number, number>) => {
  let calls = 0;
  const asked = Object.assign(
    (value: number) => {
      calls += 1;
      return scale(value);
    },
    {
      domain: () => scale.domain(),
      range: () => scale.range(),
    },
  );
  return { asked, calls: () => calls };
};

const decibels = Array.from(
  { length: 481 },
  (_unused, index) => -72 + index * 0.3,
);

describe("the dust's gain axis", () => {
  it.each([
    ['the EQ graph at a normal size', eqGainScale(420, 12, 30)],
    ['the EQ graph full screen', eqGainScale(1300, 18, 44)],
    ['a plain ±20 dB axis', d3.scaleLinear().domain([-20, 20]).range([300, 0])],
  ])('lands on the axis’s own pixels on %s', (_name, scale) => {
    const pixels = gainPixelsOf(scale);
    decibels.forEach((db) => {
      expect(pixels(db)).toBeCloseTo(scale(db), 9);
    });
  });

  it('works the middle piece out itself and asks the axis only past it', () => {
    const { asked, calls } = counting(eqGainScale(420, 12, 30));
    const pixels = gainPixelsOf(asked);
    // Control: the counter counts.
    asked(3);
    expect(calls()).toBe(1);

    [-20, -12.5, -0.1, 0, 4.2, 19.99, 20].forEach((db) => pixels(db));
    expect(calls()).toBe(1);

    [-20.01, 26, -60].forEach((db) => pixels(db));
    expect(calls()).toBe(4);
  });

  it('asks the axis for everything when no piece of it holds 0 dB', () => {
    const scale = d3.scaleLinear().domain([1, 10]).range([0, 100]);
    const { asked, calls } = counting(scale);
    const pixels = gainPixelsOf(asked);
    [0.5, 2, 9].forEach((db) => {
      expect(pixels(db)).toBeCloseTo(scale(db), 9);
    });
    expect(calls()).toBe(3);
  });
});
