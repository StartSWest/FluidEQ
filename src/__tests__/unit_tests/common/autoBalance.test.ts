/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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
  MAX_NAMED_RANGES,
  buildBalancedGains,
  describeCorrectionShape,
  fitSpectralTilt,
  sampleSpectrumAt,
  tiltLevelAt,
  ISpectrumSample,
} from 'renderer/utils/autoBalance';
import {
  REFERENCE_SLOPE_DB_PER_DECADE,
  getReferenceShape,
} from 'common/referenceCurve';
import { LocaleCode, Translate, TranslationKey, translate } from 'common/i18n';

/**
 * A translator bound to one language, which is what the describers take.
 *
 * The assertions below build their expected sentence from the same keys the
 * code uses rather than quoting an English literal. That is not a way of making
 * the test agree with itself: what these tests are for is that the RIGHT range
 * is named and in the right direction, and quoting English froze that behaviour
 * to one dictionary — the next translator to reword "lifted" would have broken
 * a test about arithmetic.
 */
const translator =
  (locale: LocaleCode): Translate =>
  (key, vars) =>
    translate(locale, key, vars);

const t = translator('en');
/** A second language, to prove the sentence is not assembled in English. */
const t2 = translator('de');

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

  describe('describing what a correction did', () => {
    // The whole requirement is that these words are read off the gains that are
    // applied, so nothing here is allowed to say something the bands do not.
    const at = (frequency: number, gain: number) => ({
      ...band(frequency, `b${frequency}`),
      gain,
    });

    /** One clause, exactly as its dictionary writes it. */
    const clause = (
      locale: LocaleCode,
      key: 'eq.smart.shape.lifted' | 'eq.smart.shape.eased',
      range: TranslationKey,
    ) => translate(locale, key, { range: translate(locale, range) });

    /** Clauses joined and sentence-cased, the way the describer does it. */
    const line = (locale: LocaleCode, ...clauses: string[]) => {
      const said = clauses.join(translate(locale, 'eq.smart.range.separator'));
      return said.charAt(0).toUpperCase() + said.slice(1);
    };

    it('names the direction each range actually moved', () => {
      expect(describeCorrectionShape([at(10000, 3), at(100, -2)], t)).toBe(
        line(
          'en',
          clause('en', 'eq.smart.shape.lifted', 'eq.smart.range.air'),
          clause('en', 'eq.smart.shape.eased', 'eq.smart.range.bass'),
        ),
      );
    });

    it('takes the whole clause from the dictionary, not a verb and a noun', () => {
      // The one thing a translated readout can get wrong that an English one
      // cannot. German writes this range-first — "Luft: angehoben" — and the
      // only way the output can come out in that order is if the clause was
      // looked up whole with the range dropped into it. Gluing a translated
      // verb to a translated noun would produce English word order in German
      // words, which is the failure this exists to catch.
      const de = describeCorrectionShape([at(10000, 3), at(100, -2)], t2);

      expect(de).toBe(
        line(
          'de',
          clause('de', 'eq.smart.shape.lifted', 'eq.smart.range.air'),
          clause('de', 'eq.smart.shape.eased', 'eq.smart.range.bass'),
        ),
      );
      expect(de).toContain(translate('de', 'eq.smart.range.air'));
      expect(de).not.toContain('air');
    });

    it('says nothing about a range nobody could hear it in', () => {
      // Under a decibel on a broad band is not audible, and nine ranges each
      // reporting a fraction is a readout rather than a description.
      expect(describeCorrectionShape([at(1000, 0.5), at(100, -0.7)], t)).toBe(
        '',
      );
      expect(describeCorrectionShape([], t)).toBe('');
    });

    it('leads with the biggest and stops at three', () => {
      const said = describeCorrectionShape(
        [at(50, 1), at(200, -2), at(1000, 4), at(3000, -3), at(12000, 1.5)],
        t,
      );

      expect(
        said.split(translate('en', 'eq.smart.range.separator')),
      ).toHaveLength(MAX_NAMED_RANGES);
      // 1 kHz is in `upper mids` — the region edges are 560 and 1120, not the
      // round numbers the name suggests.
      expect(
        said.startsWith(
          line(
            'en',
            clause('en', 'eq.smart.shape.lifted', 'eq.smart.range.upperMids'),
          ),
        ),
      ).toBe(true);
    });

    it('averages a range rather than reporting its loudest band', () => {
      // Two bands in the same range pulling opposite ways is a range that has
      // not moved, and saying "more bass" for it would be the fake thing.
      expect(describeCorrectionShape([at(75, 4), at(120, -4)], t)).toBe('');
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

  /**
   * The four modes, and the fact that they are four.
   *
   * Detail and the one-shot used to aim at exactly the same destination —
   * `getReferenceShape` returns the bare fitted line for anything it does not
   * recognise, and 'detail' was not one of the names it recognised. Two modes,
   * one behaviour, and nothing on screen to say so.
   */
  describe('what each mode is held to', () => {
    const MODES = ['smart', 'detail', 'balance', 'target'];
    // A modern master: falls about fifteen decibels per decade, nothing wrong.
    const goodMaster = (frequency: number) => -15 * Math.log10(frequency) + 40;
    const gainsFor = (mode: string, levelAt: (f: number) => number) =>
      buildBalancedGains(buildSpectrum(levelAt), TEN_BAND, {
        reference: getReferenceShape(mode),
      });
    const at = (gains: Record<string, number>, frequency: number) =>
      gains[`b${frequency}`] ?? 0;

    it('gives all four of them different destinations', () => {
      const shapes = MODES.map((mode) =>
        TEN_BAND.map((filter) =>
          at(
            gainsFor(mode, goodMaster),
            filter.id.slice(1) as unknown as number,
          ),
        ),
      );
      const asText = shapes.map((shape) => shape.join(','));

      expect(new Set(asText).size).toBe(MODES.length);
    });

    /**
     * The slope is the number that decides whether a good record is left alone,
     * and it was wrong: at eight decibels per decade the reference was brighter
     * than any real master, so Balance thinned a perfectly good one — measured
     * at −3.3 dB in the bass and +4.5 dB at 12.5 kHz, which is the "only the air
     * ever moves" report. Eleven leaves it alone.
     */
    it('leaves a good modern master closer to alone than the old slope did', () => {
      const worstUnder = (slope: number) => {
        const gains = buildBalancedGains(buildSpectrum(goodMaster), TEN_BAND, {
          reference: { slope },
        });
        return Math.max(
          ...TEN_BAND.map((filter) => Math.abs(gains[filter.id] ?? 0)),
        );
      };

      // Balance imposes a tilt, so a record whose own tilt differs is tilted —
      // that is the mode working, not failing, and the extremes always move
      // most. What must be true is that the reference sits nearer to where real
      // music actually lives than it used to.
      expect(worstUnder(REFERENCE_SLOPE_DB_PER_DECADE)).toBeLessThan(
        worstUnder(-8) - 1,
      );
    });

    /**
     * Detail's whole promise, and the one the anchor would otherwise break: the
     * solver keeps the level still by subtracting a weighted mean, so a lift in
     * the mids is normally funded by a cut underneath it. Anchoring on the
     * bottom is what stops that.
     */
    it('lifts the mids and highs under Detail without cutting the bass', () => {
      const gains = gainsFor('detail', goodMaster);

      expect(at(gains, 32)).toBeGreaterThanOrEqual(-0.3);
      expect(at(gains, 64)).toBeGreaterThanOrEqual(-0.3);
      expect(at(gains, 2000)).toBeGreaterThan(at(gains, 64));
      expect(at(gains, 4000)).toBeGreaterThan(at(gains, 64));
    });

    /**
     * Every other mode holds the level still instead, so raising one region is
     * paid for by the rest — which is what makes adjusting any frequency
     * compensate across the others rather than turning the record up.
     */
    it('keeps the level still in the modes that are not Detail', () => {
      ['smart', 'balance', 'target'].forEach((mode) => {
        const gains = gainsFor(
          mode,
          (frequency) =>
            // Dull: needs a real correction, so there is something to centre.
            goodMaster(frequency) - 4 * Math.log10(frequency),
        );
        const mean =
          TEN_BAND.reduce(
            (total, filter) => total + (gains[filter.id] ?? 0),
            0,
          ) / TEN_BAND.length;

        expect(Math.abs(mean)).toBeLessThan(1.5);
      });
    });
  });
});
