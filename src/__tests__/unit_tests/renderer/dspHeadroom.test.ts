/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, clampDspSettings } from '../../../common/dsp/chain';
import {
  defaultCeilingDb,
  isHeadroomSufficient,
} from '../../../renderer/dsp/headroom';

describe('maximizer ceiling against the APO profile', () => {
  it('leaves room for the boost plus an inter-sample margin', () => {
    expect(defaultCeilingDb(6)).toBeCloseTo(-7, 6);
  });

  it('still leaves the inter-sample margin on a flat profile', () => {
    expect(defaultCeilingDb(0)).toBeCloseTo(-1, 6);
  });

  /**
   * A profile that only cuts needs no room made for it.
   *
   * Lowering the ceiling for a boost that does not exist would make every
   * track quieter for nothing, which reads as the maximizer being broken.
   */
  it('makes no room for a profile that only cuts', () => {
    expect(defaultCeilingDb(-8)).toBeCloseTo(-1, 6);
  });

  it('survives a non-finite boost rather than returning NaN', () => {
    expect(defaultCeilingDb(Number.NaN)).toBeCloseTo(-1, 6);
  });

  /**
   * Whatever this returns must be a value the settings can actually hold.
   *
   * A ceiling outside the range would be silently clamped on the way into
   * `IDspSettings`, and the number the panel showed would not be the number
   * the limiter used.
   */
  it('always returns a ceiling clampDspSettings will keep unchanged', () => {
    [-20, -1, 0, 3, 6, 11, 40, 1_000].forEach((boost) => {
      const ceilingDb = defaultCeilingDb(boost);
      const stored = clampDspSettings({
        ...DSP_DEFAULTS,
        maximizer: { ...DSP_DEFAULTS.maximizer, ceilingDb },
      });
      expect(stored.maximizer.ceilingDb).toBe(ceilingDb);
    });
  });

  it('reports honestly when the range cannot absorb the boost', () => {
    expect(isHeadroomSufficient(6)).toBe(true);
    expect(isHeadroomSufficient(11)).toBe(true);
    expect(isHeadroomSufficient(12)).toBe(false);
  });
});
