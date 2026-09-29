/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The bell a Ctrl-drag moves a group by (`bellDrag.ts`): the cookbook's
 * analogue peaking filter, centred on the grabbed band and as wide as its Q.
 */

import bellGainAt from 'renderer/graph/bellDrag';

describe('the bell a group is dragged by', () => {
  it('is the whole drag at its tip', () => {
    expect(bellGainAt(630, 630, 1.41, 6)).toBeCloseTo(6, 10);
    expect(bellGainAt(630, 630, 0.3, -9)).toBeCloseTo(-9, 10);
  });

  // Measured on the design: 6 dB, one octave from the tip.
  it('falls away as the Q says, one octave off', () => {
    expect(bellGainAt(1260, 630, 0.67, 6)).toBeCloseTo(2.99, 2);
    expect(bellGainAt(1260, 630, 1.41, 6)).toBeCloseTo(1.14, 2);
    expect(bellGainAt(1260, 630, 2.1, 6)).toBeCloseTo(0.58, 2);
  });

  it('falls the same either side, in octaves', () => {
    [0.5, 1, 4].forEach((quality) => {
      expect(bellGainAt(315, 630, quality, 6)).toBeCloseTo(
        bellGainAt(1260, 630, quality, 6),
        10,
      );
    });
  });

  it('dips as it rises: a cut is the rise turned over', () => {
    [200, 630, 3000].forEach((frequency) => {
      expect(bellGainAt(frequency, 630, 1.41, -6)).toBeCloseTo(
        -bellGainAt(frequency, 630, 1.41, 6),
        10,
      );
    });
  });

  it('moves nothing for no drag, and nothing where no band could be', () => {
    expect(bellGainAt(1000, 630, 1.41, 0)).toBe(0);
    expect(bellGainAt(0, 630, 1.41, 6)).toBe(0);
    expect(bellGainAt(1000, 0, 1.41, 6)).toBe(0);
    expect(bellGainAt(1000, 630, 0, 6)).toBe(0);
    // POSITIVE CONTROL: the same band with a drag does move.
    expect(bellGainAt(1000, 630, 1.41, 6)).toBeGreaterThan(0);
  });
});
