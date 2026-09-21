/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How wide a band opens, and the two rules behind it.
 *
 * Nothing in the test suite could see a band's width before this: it is not a
 * role, not a label and not a string, and every defect it has had — a
 * thirty-one-band rack at the fifteen-band's Q, half a converted rack keeping
 * the width of the rack it came from, a twenty-band rack given one number for
 * a spacing that changes along it — reached the window and was found by ear
 * or by eye.
 */
import {
  DEFAULT_BAND_QUALITY,
  qualitiesForRack,
  qualityForRack,
  qualityForSpacing,
} from '../../../common/bandQuality';
import {
  FIXED_BAND_FREQUENCIES,
  FixedBandSizeEnum,
  getDefaultFilters,
} from '../../../common/constants';

/** The ISO third-octave series this app's layouts are drawn from. */
const THIRD_OCTAVE = 1 / 3;
const TWO_THIRDS = 2 / 3;

describe('what width a band opens at', () => {
  describe('the textbook rule, which the DSP rack uses', () => {
    it('answers the graphic equaliser relation for each spacing', () => {
      // Q = 1 / (2^(n/2) - 2^(-n/2)): the skirts of neighbouring bands cross
      // at their half-power points.
      expect(qualityForSpacing(THIRD_OCTAVE)).toBeCloseTo(4.32, 2);
      expect(qualityForSpacing(TWO_THIRDS)).toBeCloseTo(2.14, 2);
      expect(qualityForSpacing(1)).toBeCloseTo(1.41, 2);
    });

    it('measures a rack by its own average spacing, in any order', () => {
      const octave = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
      expect(qualityForRack(octave)).toBeCloseTo(1.41, 1);
      expect(qualityForRack([...octave].reverse())).toBeCloseTo(1.41, 1);
    });

    it('falls back where there is no rack to measure', () => {
      expect(qualityForRack([])).toBe(DEFAULT_BAND_QUALITY);
      expect(qualityForRack([1000])).toBe(DEFAULT_BAND_QUALITY);
      expect(qualityForRack([1000, 1000])).toBe(DEFAULT_BAND_QUALITY);
      expect(qualityForSpacing(Number.NaN)).toBe(DEFAULT_BAND_QUALITY);
      expect(qualityForSpacing(0)).toBe(DEFAULT_BAND_QUALITY);
    });

    /**
     * A rack does not have to be one this app ships.
     *
     * Two bands at the ends of the spectrum are ten octaves apart, and the
     * honest answer is a filter so wide it tilts everything. The floor is
     * what stops a band added to such a rack from arriving as a tilt.
     */
    it('will not answer wider than a band can usefully be', () => {
      expect(qualityForRack([20, 20000])).toBeGreaterThanOrEqual(0.25);
    });
  });

  describe('the swept rule, which the main equaliser uses', () => {
    /**
     * Twice the spacing, because these filters are cascaded and their
     * decibels add. At the textbook width the sum is scalloped — a bump at
     * every centre, a dip between — which measured 2.8 dB away from what the
     * tone dials asked for.
     */
    it('is half the textbook width, band for band', () => {
      const octave = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
      const widths = qualitiesForRack(octave);
      widths.forEach((width) => {
        expect(width).toBeCloseTo(qualityForSpacing(1) / 2, 1);
      });
    });

    it('gives each band the distance to its own neighbours', () => {
      // The twenty-band runs third-octave at both ends and two-thirds through
      // the middle, so one number cannot serve it.
      const widths = qualitiesForRack(
        FIXED_BAND_FREQUENCIES[FixedBandSizeEnum.TWENTY],
      );
      const centres = FIXED_BAND_FREQUENCIES[FixedBandSizeEnum.TWENTY];
      const at = (frequency: number) => widths[centres.indexOf(frequency)];
      /**
       * From the neighbours themselves, not from the nominal spacing: the ISO
       * centres are rounded, so 80 to 100 is 0.3219 of an octave and not a
       * third, and a test written against the ideal would be off by more than
       * the thing it is checking.
       */
      const between = (below: number, above: number) =>
        qualityForSpacing(Math.log2(above / below));
      // 100 Hz sits between 80 and 125 — third-octave either side.
      expect(at(100)).toBeCloseTo(between(80, 125), 2);
      // 1 kHz sits between 630 and 1600 — two-thirds either side.
      expect(at(1000)).toBeCloseTo(between(630, 1600), 2);
      // And the wide middle is wider than the close-packed ends.
      expect(at(1000)).toBeLessThan(at(100));
    });

    it('answers in the order it was given, sorted or not', () => {
      const shuffled = [1000, 63, 16000, 250];
      const widths = qualitiesForRack(shuffled);
      const sorted = qualitiesForRack([...shuffled].sort((a, b) => a - b));
      expect(widths[1]).toBeCloseTo(sorted[0], 5);
      expect(widths[2]).toBeCloseTo(sorted[3], 5);
    });

    it('falls back where there is nothing to measure against', () => {
      expect(qualitiesForRack([])).toEqual([]);
      expect(qualitiesForRack([1000])).toEqual([DEFAULT_BAND_QUALITY]);
    });
  });

  /**
   * The failure this whole module exists to stop: a rack whose bands are not
   * the shape their spacing asks for.
   */
  describe('every layout the app ships', () => {
    it('opens with each band at its own spacing, not the app fallback', () => {
      Object.values(FixedBandSizeEnum)
        .filter((size): size is FixedBandSizeEnum => typeof size === 'number')
        .forEach((size) => {
          const bands = Object.values(getDefaultFilters(size)).sort(
            (one, other) => one.frequency - other.frequency,
          );
          const wanted = qualitiesForRack(bands.map((band) => band.frequency));
          bands.forEach((band, at) => {
            expect(band.quality).toBeCloseTo(wanted[at], 5);
          });
        });
    });

    it('gives a wider rack narrower bands, all the way down the list', () => {
      const width = (size: FixedBandSizeEnum) =>
        qualitiesForRack(FIXED_BAND_FREQUENCIES[size])[2];
      expect(width(FixedBandSizeEnum.SIX)).toBeLessThan(
        width(FixedBandSizeEnum.TEN),
      );
      expect(width(FixedBandSizeEnum.TEN)).toBeLessThan(
        width(FixedBandSizeEnum.FIFTEEN),
      );
      expect(width(FixedBandSizeEnum.FIFTEEN)).toBeLessThan(
        width(FixedBandSizeEnum.THIRTY_ONE),
      );
    });
  });
});
