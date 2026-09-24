/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The two cuts on the Tone panel, as the file both engines read spells them.
 *
 * A slope is an order of Butterworth, one biquad per pair of poles at the
 * Butterworth Qs: a Q off by a digit is a bump or a sag at the corner that the
 * graph, drawing the same numbers, would not show either.
 */

import { FilterTypeEnum } from '../../../common/constants';
import {
  DEFAULT_EQ_CUTS,
  EQ_CUT_FREQUENCIES,
  EQ_CUT_SLOPES,
  eqCutFilters,
  eqCutsFileText,
  hasEqCut,
  isEqCutSlope,
  toEqCuts,
} from '../../../common/eqCuts';

/** A Butterworth of `order`, from its pole angles. */
const butterworth = (order: number) =>
  Array.from(
    { length: order / 2 },
    (_unused, index) =>
      1 / (2 * Math.cos(((2 * index + 1) * Math.PI) / (2 * order))),
  );

describe('eqCutFilters', () => {
  it('builds nothing while both cuts are off', () => {
    expect(eqCutFilters(undefined)).toEqual([]);
    expect(eqCutFilters(DEFAULT_EQ_CUTS)).toEqual([]);
    expect(hasEqCut(DEFAULT_EQ_CUTS)).toBe(false);
  });

  it.each(EQ_CUT_SLOPES.filter((slope) => slope > 0))(
    'builds a %i dB/oct cut as a Butterworth of that order',
    (slope) => {
      const low = eqCutFilters({ low: slope, high: 0 });
      const high = eqCutFilters({ low: 0, high: slope });
      // One biquad per 12 dB per octave, each end on its own corner.
      expect(low).toHaveLength(slope / 12);
      expect(high).toHaveLength(slope / 12);
      expect(low.every(({ type }) => type === FilterTypeEnum.HPQ)).toBe(true);
      expect(high.every(({ type }) => type === FilterTypeEnum.LPQ)).toBe(true);
      expect(low.every(({ frequency }) => frequency === 20)).toBe(true);
      expect(high.every(({ frequency }) => frequency === 20000)).toBe(true);
      butterworth(slope / 6).forEach((quality, section) => {
        expect(low[section].quality).toBeCloseTo(quality, 4);
        expect(high[section].quality).toBeCloseTo(quality, 4);
      });
    },
  );

  it('keeps the low cut first, as the file lists it', () => {
    const both = eqCutFilters({ low: 24, high: 12 });
    expect(both.map(({ type }) => type)).toEqual([
      FilterTypeEnum.HPQ,
      FilterTypeEnum.HPQ,
      FilterTypeEnum.LPQ,
    ]);
    expect(new Set(both.map(({ id }) => id)).size).toBe(both.length);
  });
});

describe('eqCutsFileText', () => {
  it('writes each section in the grammar of a layer file, with no Gain', () => {
    const lines = eqCutsFileText({ low: 24, high: 12 }).split('\r\n');
    expect(lines[0].startsWith('#')).toBe(true);
    expect(lines.slice(1)).toEqual([
      'Filter 1: ON HPQ Fc 20 Hz Q 0.5412',
      'Filter 2: ON HPQ Fc 20 Hz Q 1.3066',
      'Filter 3: ON LPQ Fc 20000 Hz Q 0.7071',
    ]);
  });
});

describe('toEqCuts', () => {
  it('reads every slope a dial offers as itself', () => {
    // POSITIVE CONTROL: without it, a reader that answered "no cut" for
    // everything would pass every case below that expects less.
    EQ_CUT_SLOPES.forEach((slope) => {
      expect(isEqCutSlope(slope)).toBe(true);
      expect(toEqCuts({ low: slope, high: slope })).toEqual(
        slope > 0 ? { low: slope, high: slope } : undefined,
      );
    });
  });

  it('loads a slope since taken off at the steepest one left', () => {
    // 36 and 48 were offered until they were found too aggressive; a state
    // saved with one keeps its cut, at 24, rather than losing it.
    expect(isEqCutSlope(36)).toBe(false);
    expect(isEqCutSlope(48)).toBe(false);
    expect(toEqCuts({ low: 48, high: 36 })).toEqual({ low: 24, high: 24 });
    expect(toEqCuts({ low: 30, high: 18 })).toEqual({ low: 24, high: 12 });
  });

  it('reads anything that is not a slope as no cut', () => {
    expect(toEqCuts({ low: true, high: false })).toBeUndefined();
    expect(toEqCuts({ low: -12, high: Number.NaN })).toBeUndefined();
    expect(toEqCuts(null)).toBeUndefined();
    expect(toEqCuts('24')).toBeUndefined();
    expect(toEqCuts({ low: 12 })).toEqual({ low: 12, high: 0 });
    expect(toEqCuts({ low: 12, high: 0, extra: 1 })).toEqual({
      low: 12,
      high: 0,
    });
  });

  it('puts the corners at the edges of hearing', () => {
    expect(EQ_CUT_FREQUENCIES).toEqual({ low: 20, high: 20000 });
  });
});
