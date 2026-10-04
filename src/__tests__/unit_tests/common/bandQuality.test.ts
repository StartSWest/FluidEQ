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
 * the width of the rack it came from — reached the window and was found by ear
 * or by eye. The main equaliser opens every band of a layout at one Q, from
 * the layout's span and count (Ivan, 2026-10-03), so every band of it moves
 * the same way; the DSP rack keeps the textbook rule.
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

    it.each([
      [FixedBandSizeEnum.SIX, 0.35],
      [FixedBandSizeEnum.TEN, 0.67],
      [FixedBandSizeEnum.FIFTEEN, 1.05],
      [FixedBandSizeEnum.TWENTY, 1.44],
      [FixedBandSizeEnum.THIRTY_ONE, 2.15],
    ])('starts all %i main bands at Q %s, including the ends', (size, q) => {
      expect(
        Object.values(getDefaultFilters(size)).map((band) => band.quality),
      ).toEqual(Array.from({ length: size }, () => q));
    });

    it('answers one Q for every band, from the span and the count alone', () => {
      // The same span and count in any order and with any gaps between: the
      // Q of a layout is the layout's, never a band's neighbours'.
      const even = qualitiesForRack([63, 250, 1000, 4000]);
      const uneven = qualitiesForRack([4000, 63, 2000, 125]);
      expect(new Set(even).size).toBe(1);
      expect(uneven).toEqual(even);
      // Positive control: a wider span is a different, wider Q.
      expect(qualitiesForRack([31.5, 250, 1000, 16000])[0]).toBeLessThan(
        even[0],
      );
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
    it('opens with its rack’s Q, never the app’s fallback', () => {
      Object.values(FixedBandSizeEnum)
        .filter((size): size is FixedBandSizeEnum => typeof size === 'number')
        .forEach((size) => {
          const bands = Object.values(getDefaultFilters(size));
          expect(
            bands.every((band) => band.quality !== DEFAULT_BAND_QUALITY),
          ).toBe(true);
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
