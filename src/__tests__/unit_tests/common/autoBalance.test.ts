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

import { FilterTypeEnum, IFilter } from 'common/constants';
import {
  buildBalancedGains,
  fitSpectralTilt,
  sampleSpectrumAt,
  tiltLevelAt,
  ISpectrumSample,
} from 'renderer/utils/autoBalance';
import { REFERENCE_SLOPE_DB_PER_DECADE } from 'common/referenceCurve';

const band = (frequency: number, id = `b${frequency}`): IFilter => ({
  id,
  frequency,
  gain: 0,
  quality: 1,
  type: FilterTypeEnum.PK,
});

const TEN_BAND = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000].map(
  (frequency) => band(frequency),
);

/** 320 log-spaced points from 20 Hz to 20 kHz, like the live analyser. */
const buildSpectrum = (
  levelAt: (frequency: number) => number,
): ISpectrumSample[] =>
  Array.from({ length: 320 }, (_value, index) => {
    const frequency =
      10 **
      (Math.log10(20) + (index / 319) * (Math.log10(20000) - Math.log10(20)));
    return { frequency, level: levelAt(frequency) };
  });

describe('autoBalance', () => {
  describe('fitSpectralTilt', () => {
    it('recovers a known slope and intercept', () => {
      const samples = buildSpectrum(
        (frequency) => -6 * Math.log10(frequency) + 12,
      );
      const { slope, intercept } = fitSpectralTilt(samples);
      expect(slope).toBeCloseTo(-6, 5);
      expect(intercept).toBeCloseTo(12, 5);
    });

    it('is stable for degenerate input', () => {
      expect(fitSpectralTilt([])).toEqual({ slope: 0, intercept: 0 });
      expect(fitSpectralTilt([{ frequency: 100, level: 4 }])).toEqual({
        slope: 0,
        intercept: 0,
      });
    });
  });

  describe('sampleSpectrumAt', () => {
    const samples: ISpectrumSample[] = [
      { frequency: 100, level: 0 },
      { frequency: 1000, level: 10 },
    ];

    it('interpolates in the log-frequency domain', () => {
      // 316 Hz is the geometric midpoint of 100 Hz and 1 kHz.
      expect(sampleSpectrumAt(samples, Math.sqrt(100 * 1000))).toBeCloseTo(
        5,
        5,
      );
    });

    it('clamps to the ends of the measurement', () => {
      expect(sampleSpectrumAt(samples, 10)).toBe(0);
      expect(sampleSpectrumAt(samples, 20000)).toBe(10);
      expect(sampleSpectrumAt([], 1000)).toBe(0);
    });
  });

  describe('buildBalancedGains', () => {
    const filters = [band(63), band(250), band(1000), band(4000), band(10000)];

    it('leaves a spectrum that is already a clean tilt alone', () => {
      const spectrum = buildSpectrum(
        (frequency) => -8 * Math.log10(frequency) + 20,
      );
      const gains = buildBalancedGains(spectrum, filters);
      Object.values(gains).forEach((gain) =>
        expect(Math.abs(gain)).toBeLessThan(0.6),
      );
    });

    it('cuts a resonance and does not chase the overall tilt', () => {
      // A broad +9 dB bump centred on 1 kHz riding on a normal tilt.
      const spectrum = buildSpectrum((frequency) => {
        const tilt = -8 * Math.log10(frequency) + 20;
        const octavesFromPeak = Math.log2(frequency / 1000);
        return tilt + 9 * Math.exp(-(octavesFromPeak ** 2) / 0.5);
      });

      const gains = buildBalancedGains(spectrum, filters);
      expect(gains.b1000).toBeLessThan(-2);
      // Bands far from the bump are barely touched.
      expect(Math.abs(gains.b63)).toBeLessThan(Math.abs(gains.b1000));
      expect(Math.abs(gains.b10000)).toBeLessThan(Math.abs(gains.b1000));
    });

    it('boosts a dip', () => {
      const spectrum = buildSpectrum((frequency) => {
        const tilt = -8 * Math.log10(frequency) + 20;
        const octavesFromDip = Math.log2(frequency / 250);
        return tilt - 9 * Math.exp(-(octavesFromDip ** 2) / 0.5);
      });

      expect(buildBalancedGains(spectrum, filters).b250).toBeGreaterThan(2);
    });

    it('respects the boost and cut limits', () => {
      const spectrum = buildSpectrum((frequency) =>
        frequency > 800 && frequency < 1300 ? 40 : -40,
      );
      Object.values(buildBalancedGains(spectrum, filters)).forEach((gain) => {
        expect(gain).toBeLessThanOrEqual(6);
        expect(gain).toBeGreaterThanOrEqual(-9);
      });
    });

    it('returns nothing when there is not enough to measure', () => {
      expect(buildBalancedGains([], filters)).toEqual({});
      expect(
        buildBalancedGains(
          buildSpectrum(() => 0),
          [],
        ),
      ).toEqual({});
    });
  });

  describe('the reference a record is held to', () => {
    // The three continuous modes differ in one place and this is it: what a
    // record is held to. Fitted, its own tilt is correct by definition.
    it('holds a given slope instead of finding one, and still fits the level', () => {
      const samples = buildSpectrum(
        (frequency) => -6 * Math.log10(frequency) + 12,
      );

      // Fitted: the record's own tilt comes back.
      expect(fitSpectralTilt(samples).slope).toBeCloseTo(-6, 5);

      // Held: the slope is what was asked for, and the level is placed so the
      // line still sits through the middle of the measurement.
      const held = fitSpectralTilt(samples, -8);
      expect(held.slope).toBe(-8);
      const middle = 1000;
      expect(tiltLevelAt(held, middle)).toBeCloseTo(
        -6 * Math.log10(middle) + 12,
        0,
      );
    });

    it('leaves a record alone at its own tilt and lifts a duller one', () => {
      // Two records, one at the reference slope and one falling twice as fast.
      // Against a fitted line both are correct; against a held one only the
      // first is, which is the whole point of the mode.
      const atReference = buildSpectrum(
        (frequency) => REFERENCE_SLOPE_DB_PER_DECADE * Math.log10(frequency),
      );
      const duller = buildSpectrum(
        (frequency) =>
          REFERENCE_SLOPE_DB_PER_DECADE * 2 * Math.log10(frequency),
      );
      const reference = { slope: REFERENCE_SLOPE_DB_PER_DECADE };

      const settled = buildBalancedGains(atReference, TEN_BAND, { reference });
      const lifted = buildBalancedGains(duller, TEN_BAND, { reference });
      const top = TEN_BAND[TEN_BAND.length - 2].id;
      const bottom = TEN_BAND[1].id;

      // Already there: nothing worth doing.
      expect(Math.abs(settled[top] - settled[bottom])).toBeLessThan(1);
      // Too dark: the top has to come up relative to the bottom.
      expect(lifted[top] - lifted[bottom]).toBeGreaterThan(2);
    });
  });
});
