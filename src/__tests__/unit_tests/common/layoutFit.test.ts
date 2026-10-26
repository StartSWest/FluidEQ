/**
 * A built-in band layout chosen over an EQ carries the curve the EQ played
 * (Ivan, 2026-10-25: "each time I change band size it resets the EQ, can't
 * happen … copy the settings from the current to the new one and adapt").
 */

import fitLayoutToCurve from 'common/layoutFit';
import {
  FilterTypeEnum,
  FixedBandSizeEnum,
  getDefaultFilters,
  type IFiltersMap,
} from 'common/constants';
import { getResponseGainAtFrequencies } from 'common/response';

/** A built-in layout with the given gains on the bands at those frequencies. */
const layoutWith = (
  size: FixedBandSizeEnum,
  gains: Record<number, number>,
): IFiltersMap =>
  Object.fromEntries(
    Object.entries(getDefaultFilters(size)).map(([id, band]) => [
      id,
      { ...band, gain: gains[band.frequency] ?? 0 },
    ]),
  );

const curveAt = (filters: IFiltersMap, frequencies: number[]) =>
  getResponseGainAtFrequencies(
    { filters: Object.values(filters) },
    frequencies,
  );

const frequenciesOf = (filters: IFiltersMap) =>
  Object.values(filters)
    .map((band) => band.frequency)
    .sort((left, right) => left - right);

// A curve with a low shelf of bells, a mid dip and a lifted top, on the
// fifteen-band layout the app opens on.
const FIFTEEN_GAINS: Record<number, number> = {
  25: 4,
  40: 3.5,
  63: 2.5,
  1000: -3,
  1600: -2,
  6300: 2,
  10000: 3,
  16000: 2.5,
};

describe('a new band layout over an EQ', () => {
  it('plays the same curve with more bands', () => {
    const current = layoutWith(FixedBandSizeEnum.FIFTEEN, FIFTEEN_GAINS);
    const target = getDefaultFilters(FixedBandSizeEnum.THIRTY_ONE);
    const fitted = fitLayoutToCurve(current, target);
    const centres = frequenciesOf(fitted);
    const before = curveAt(current, centres);
    const after = curveAt(fitted, centres);
    // Within a tenth and a half everywhere between the ends; the two end
    // bands average a stretch the old layout's edge bands only reached the
    // side of (measured 0.44 dB at 20 Hz, 0.35 at 20 kHz).
    after.forEach((gain, at) => {
      const isEnd = at === 0 || at === after.length - 1;
      expect(Math.abs(gain - before[at])).toBeLessThan(isEnd ? 0.5 : 0.15);
    });
  });

  it('keeps the shape with fewer bands, each band the curve over its stretch', () => {
    const current = layoutWith(FixedBandSizeEnum.FIFTEEN, FIFTEEN_GAINS);
    const target = getDefaultFilters(FixedBandSizeEnum.TEN);
    const fitted = fitLayoutToCurve(current, target);
    const centres = frequenciesOf(fitted);
    const before = curveAt(current, centres);
    const after = curveAt(fitted, centres);
    // Within half a decibel at every new centre (measured 0.48 at most).
    after.forEach((gain, at) => {
      expect(Math.abs(gain - before[at])).toBeLessThan(0.6);
    });
    // The lift at the bottom, the dip in the middle and the lift at the top
    // all survive, rather than the layout coming back flat.
    const byFrequency = Object.fromEntries(
      Object.values(fitted).map((band) => [band.frequency, band.gain]),
    );
    expect(byFrequency[31.5]).toBeGreaterThan(2);
    expect(byFrequency[1000]).toBeLessThan(-1);
    expect(byFrequency[8000]).toBeGreaterThan(1);
  });

  it('keeps the layout’s own frequencies, Q and band types, and only sets gains', () => {
    const current = layoutWith(FixedBandSizeEnum.FIFTEEN, FIFTEEN_GAINS);
    const target = getDefaultFilters(FixedBandSizeEnum.THIRTY_ONE);
    const fitted = fitLayoutToCurve(current, target);
    Object.entries(target).forEach(([id, band]) => {
      expect(fitted[id]).toEqual({ ...band, gain: fitted[id].gain });
    });
  });

  it('sets each gain to a tenth of a decibel, as the sliders show it', () => {
    const fitted = fitLayoutToCurve(
      layoutWith(FixedBandSizeEnum.FIFTEEN, FIFTEEN_GAINS),
      getDefaultFilters(FixedBandSizeEnum.TEN),
    );
    Object.values(fitted).forEach((band) => {
      expect(Math.round(band.gain * 10) / 10).toBe(band.gain);
    });
  });

  it('stays flat over a flat EQ, and hands the layout back when nothing plays', () => {
    const flat = fitLayoutToCurve(
      layoutWith(FixedBandSizeEnum.FIFTEEN, {}),
      getDefaultFilters(FixedBandSizeEnum.TEN),
    );
    Object.values(flat).forEach((band) => expect(band.gain).toBe(0));

    const allOff = Object.fromEntries(
      Object.entries(layoutWith(FixedBandSizeEnum.FIFTEEN, FIFTEEN_GAINS)).map(
        ([id, band]) => [id, { ...band, isEnabled: false }],
      ),
    );
    const target = getDefaultFilters(FixedBandSizeEnum.TEN);
    expect(fitLayoutToCurve(allOff, target)).toBe(target);
  });

  it('leaves out a band switched off and a filter that carries no gain', () => {
    const lifted = layoutWith(FixedBandSizeEnum.FIFTEEN, { 1000: 6 });
    const [liftedId] = Object.entries(lifted).find(
      ([, band]) => band.frequency === 1000,
    ) ?? [''];
    const switchedOff = {
      ...lifted,
      [liftedId]: { ...lifted[liftedId], isEnabled: false },
    };
    const withHighPass = {
      ...layoutWith(FixedBandSizeEnum.FIFTEEN, {}),
      cut: {
        id: 'cut',
        frequency: 200,
        gain: 0,
        quality: 0.7,
        type: FilterTypeEnum.HPQ,
      },
    };
    const target = getDefaultFilters(FixedBandSizeEnum.TEN);
    Object.values(fitLayoutToCurve(switchedOff, target)).forEach((band) =>
      expect(band.gain).toBe(0),
    );
    Object.values(fitLayoutToCurve(withHighPass, target)).forEach((band) =>
      expect(band.gain).toBe(0),
    );
  });
});
