/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { energyBandLabels } from '../../../../renderer/graph/analysis/energyView';

/**
 * The words under the Energy bands view's columns. At its default five the
 * columns are named; at any other count of pieces every column printed the
 * axis's first edge, "10", whatever it held.
 */
describe('the Energy bands view’s words', () => {
  it('names the five bands', () => {
    expect(energyBandLabels(5)).toEqual(['SUB', 'BASS', 'MID', 'PRES', 'AIR']);
  });

  it('gives any other count each slice’s own centre, low to high', () => {
    [3, 8, 24].forEach((count) => {
      const labels = energyBandLabels(count);
      expect(labels).toHaveLength(count);
      expect(new Set(labels).size).toBe(count);
      const hertz = labels.map((label) =>
        label.endsWith('k') ? Number(label.slice(0, -1)) * 1000 : Number(label),
      );
      hertz.slice(1).forEach((value, at) => {
        expect(value).toBeGreaterThan(hertz[at]);
      });
    });
    // Three equal slices of 10 Hz to 25 kHz, by their geometric centres.
    expect(energyBandLabels(3)).toEqual(['37', '500', '6.8k']);
  });
});
