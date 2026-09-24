/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The preamp's travel stands 0 at its middle, not three quarters of the way
 * along (Ivan, 2026-09-24: "center 0 on top not to the side, make 60 some how
 * compress"): -60 dB to +20, each side half the travel, the long side
 * compressed but as fine as the short one where it leaves 0.
 */
import centredSweep from 'renderer/widgets/centredSweep';

const preamp = centredSweep(-60, 0, 20);

describe('a travel centred on its rest', () => {
  it('stands the centre in the middle and the ends at the ends', () => {
    expect(preamp.toPosition(0)).toBe(0.5);
    expect(preamp.toPosition(-60)).toBe(0);
    expect(preamp.toPosition(20)).toBe(1);
    // Past either end is the end.
    expect(preamp.toPosition(-90)).toBe(0);
    expect(preamp.toPosition(35)).toBe(1);
  });

  it('keeps the short side even and compresses the long one', () => {
    expect(preamp.toPosition(10)).toBeCloseTo(0.75, 10);
    // The positive control for "compressed": an even lower half would put
    // -20 dB a third of the way down it, at 0.333. It sits deeper, because the
    // first decibels below 0 are given more of the travel.
    expect(preamp.toPosition(-20)).toBeCloseTo(0.22, 2);
    expect(preamp.toPosition(-20)).toBeLessThan(0.3);
    expect(preamp.toPosition(-10)).toBeCloseTo(0.324, 2);
  });

  it('moves as finely just below 0 as just above it', () => {
    const above = preamp.toValue(0.51) - 0;
    const below = 0 - preamp.toValue(0.49);
    expect(below / above).toBeCloseTo(1, 1);
  });

  it('gives back every value it placed', () => {
    [-60, -41.3, -20, -6, -0.2, 0, 0.3, 7.5, 20].forEach((value) => {
      expect(preamp.toValue(preamp.toPosition(value))).toBeCloseTo(value, 9);
    });
  });

  it('is the even travel for a range balanced on its centre', () => {
    const band = centredSweep(-20, 0, 20);
    [-20, -10, -2.5, 0, 5, 20].forEach((value) => {
      expect(band.toPosition(value)).toBeCloseTo((value + 20) / 40, 12);
    });
  });

  it('is the even travel when the centre is not inside the range', () => {
    const floor = centredSweep(0, 0, 10);
    expect(floor.toPosition(5)).toBe(0.5);
    expect(floor.toValue(0.25)).toBe(2.5);
  });
});
