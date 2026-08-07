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
  CONTINUOUS_MAX_DB,
  CONTINUOUS_MEMORY,
  CONTINUOUS_STEP_DB,
  CONTINUOUS_TRIGGER_DB,
  blendSmartEqTarget,
  SMART_EQ_MAX_FREQUENCY,
  SMART_EQ_MIN_FREQUENCY,
  SMART_EQ_QUALITY,
  buildSmartEqSettings,
  stepSmartEqGains,
  describeSmartEqLayer,
  getSmartEqBands,
  getSmartEqFilters,
  getSmartEqLayout,
  hasSmartEqLayer,
  sanitizeSmartEqSettings,
} from 'common/smartEq';
import { buildBalancedGains } from 'renderer/utils/autoBalance';

const layerOf = (gainsByFrequency: Record<number, number>) =>
  buildSmartEqSettings(
    getSmartEqLayout(),
    Object.fromEntries(
      getSmartEqLayout().map((band) => [
        band.id,
        gainsByFrequency[band.frequency] ?? 0,
      ]),
    ),
  );

describe('the Smart EQ layer', () => {
  describe('its fixed layout', () => {
    it('is peak bands only, at one Q, inside the correctable range', () => {
      const layout = getSmartEqLayout();

      expect(layout.length).toBeGreaterThan(20);
      layout.forEach((band) => {
        // A notch or a pass filter carries no gain in Equalizer APO, so a
        // layout containing one would have bands that can hold no correction.
        expect(band.type).toBe(FilterTypeEnum.PK);
        expect(band.quality).toBe(SMART_EQ_QUALITY);
        expect(band.frequency).toBeGreaterThanOrEqual(SMART_EQ_MIN_FREQUENCY);
        expect(band.frequency).toBeLessThanOrEqual(SMART_EQ_MAX_FREQUENCY);
        expect(band.gain).toBe(0);
      });
    });

    it('mints the same ids every time', () => {
      // The whole reason the layout is fixed. Band ids are regenerated whenever
      // the editor's layout is rebuilt, so a layer keyed on borrowed ids loses
      // its accumulated correction the moment somebody clears the EQ.
      expect(getSmartEqLayout().map((band) => band.id)).toEqual(
        getSmartEqLayout().map((band) => band.id),
      );
    });

    it('spaces the bands about a third of an octave apart', () => {
      // Narrower than that and the solver's overlapping-bell assumption fails;
      // wider and it cannot represent the half-octave residual it is given.
      const layout = getSmartEqLayout();
      layout.slice(1).forEach((band, index) => {
        const ratio = band.frequency / layout[index].frequency;
        expect(Math.log2(ratio)).toBeGreaterThan(0.2);
        expect(Math.log2(ratio)).toBeLessThan(0.5);
      });
    });
  });

  describe('what reaches Equalizer APO', () => {
    it('drops the neutral bands and orders the rest by frequency', () => {
      const written = getSmartEqFilters(layerOf({ 1000: 3, 100: -2 }));

      expect(written.map((filter) => filter.frequency)).toEqual([100, 1000]);
      expect(written.map((filter) => filter.gain)).toEqual([-2, 3]);
    });

    it('treats a correction of nothing as no layer at all', () => {
      // Otherwise a run that found nothing to fix would leave a chip on screen
      // claiming a correction that does not exist.
      expect(layerOf({})).toBeUndefined();
      expect(hasSmartEqLayer(undefined)).toBe(false);
    });

    it('keeps the neutral bands in storage even so', () => {
      // The stored map is the accumulator the next measurement adds to. A band
      // dropped from it would restart from zero rather than from where it is.
      const layer = layerOf({ 1000: 3 });
      expect(Object.keys(layer?.filters ?? {}).length).toBe(
        getSmartEqLayout().length,
      );
    });
  });

  describe('accepting a layer from outside the type system', () => {
    it('refuses anything that is not a set of bands', () => {
      expect(sanitizeSmartEqSettings(undefined)).toBeUndefined();
      expect(sanitizeSmartEqSettings('smart')).toBeUndefined();
      expect(sanitizeSmartEqSettings({})).toBeUndefined();
      expect(sanitizeSmartEqSettings({ filters: 7 })).toBeUndefined();
    });

    it('drops a band Equalizer APO could not build', () => {
      // NaN survives every numeric clamp and reaches APO as `Gain NaN dB`,
      // which takes out the whole chain rather than one band.
      const settings = sanitizeSmartEqSettings({
        filters: {
          good: {
            id: 'good',
            frequency: 1000,
            gain: 3,
            quality: 1.4,
            type: FilterTypeEnum.PK,
          },
          bad: {
            id: 'bad',
            frequency: Number.NaN,
            gain: 2,
            quality: 1.4,
            type: FilterTypeEnum.PK,
          },
        },
      });

      expect(Object.keys(settings?.filters ?? {})).toEqual(['good']);
    });

    it('keeps what the measurement said it covered', () => {
      const settings = sanitizeSmartEqSettings({
        filters: {
          a: {
            id: 'a',
            frequency: 1000,
            gain: 3,
            quality: 1.4,
            type: FilterTypeEnum.PK,
          },
        },
        status: 'partial',
        lowFrequency: 70,
        highFrequency: 8960,
      });

      expect(settings?.status).toBe('partial');
      expect(settings?.lowFrequency).toBe(70);
      expect(settings?.highFrequency).toBe(8960);
    });
  });

  describe('measuring against itself', () => {
    it('hands the solver the layer’s own gains, not the user’s bands', () => {
      const bands = getSmartEqBands(layerOf({ 1000: 3 }));
      const at1000 = bands.find((band) => band.frequency === 1000);

      expect(at1000?.gain).toBe(3);
      expect(bands.every((band) => band.quality === SMART_EQ_QUALITY)).toBe(
        true,
      );
    });

    it('adds each run’s residual to what the layer already holds', () => {
      // This is what makes repeated runs converge. The capture measures the
      // already-corrected output, so the answer is a residual; applying it to
      // the layer's own previous gain is the closed loop.
      const bands = getSmartEqBands(layerOf({ 1000: 4 }));
      const spectrum = Array.from({ length: 320 }, (_value, index) => {
        const frequency =
          10 **
          (Math.log10(20) +
            (index / 319) * (Math.log10(20000) - Math.log10(20)));
        // A 6 dB resonance an octave wide, centred at 1 kHz.
        return {
          frequency,
          level: 6 * Math.exp(-((Math.log2(frequency / 1000) / 0.5) ** 2)),
        };
      });

      const gains = buildBalancedGains(spectrum, bands);
      const solved = gains[bands.find((b) => b.frequency === 1000)?.id ?? ''];

      // Started at +4, measured a peak, so the band must end up below where it
      // was — but still carrying the history rather than being overwritten.
      expect(solved).toBeLessThan(4);
      expect(solved).toBeGreaterThan(0);
    });
  });

  describe('describing the layer', () => {
    it('compares on what will be heard, not on object identity', () => {
      const first = layerOf({ 1000: 3 });
      const second = layerOf({ 1000: 3 });
      const different = layerOf({ 1000: 3.1 });

      expect(first).not.toBe(second);
      expect(describeSmartEqLayer(first)).toBe(describeSmartEqLayer(second));
      expect(describeSmartEqLayer(different)).not.toBe(
        describeSmartEqLayer(first),
      );
      expect(describeSmartEqLayer(undefined)).toBe('');
    });
  });

  describe('stepping toward a solve, for Continuous EQ', () => {
    const bandsAt = (gainsByFrequency: Record<number, number>) =>
      getSmartEqBands(layerOf(gainsByFrequency));

    const bandAt = (bands: IFilter[], frequency: number) =>
      bands.find((candidate) => candidate.frequency === frequency);

    const solvedAt = (
      bands: IFilter[],
      gainsByFrequency: Record<number, number>,
    ) =>
      Object.fromEntries(
        bands
          .filter((band) => band.frequency in gainsByFrequency)
          .map((band) => [band.id, gainsByFrequency[band.frequency]]),
      );

    const gainAt = (
      bands: IFilter[],
      stepped: Record<string, number>,
      frequency: number,
    ) => stepped[bandAt(bands, frequency)?.id ?? ''];

    it('moves at most one step toward the answer, not all the way to it', () => {
      const bands = bandsAt({});
      const stepped = stepSmartEqGains(bands, solvedAt(bands, { 1000: 4 }));

      expect(gainAt(bands, stepped, 1000)).toBeCloseTo(CONTINUOUS_STEP_DB, 6);
    });

    it('holds completely still for a drift nobody could hear', () => {
      // The deadband is what makes the mode react to the sound rather than to
      // a clock. A measurement never lands on exactly the gain a band already
      // has, so without it every look would rewrite the whole correction for
      // fractions of a decibel, forever.
      const bands = bandsAt({ 1000: 2 });
      const stepped = stepSmartEqGains(bands, solvedAt(bands, { 1000: 2.1 }));

      expect(gainAt(bands, stepped, 1000)).toBe(2);
    });

    it('moves only the ranges that drifted, not the whole correction', () => {
      // What "per range" means in practice: one band out, one band right, and
      // only the first of them moves.
      const bands = bandsAt({ 100: 0, 1000: 2 });
      const stepped = stepSmartEqGains(
        bands,
        solvedAt(bands, { 100: 4, 1000: 2.2 }),
      );

      expect(gainAt(bands, stepped, 100)).toBeCloseTo(CONTINUOUS_STEP_DB, 6);
      expect(gainAt(bands, stepped, 1000)).toBe(2);
    });

    it('writes nothing at all when no range has drifted', () => {
      const bands = bandsAt({ 100: -2, 1000: 2 });
      const stepped = stepSmartEqGains(
        bands,
        solvedAt(bands, { 100: -2.3, 1000: 2.4 }),
      );

      expect(bands.every((band) => stepped[band.id] === band.gain)).toBe(true);
    });

    it('steps down as readily as up', () => {
      const bands = bandsAt({ 1000: 3 });
      const stepped = stepSmartEqGains(bands, solvedAt(bands, { 1000: -5 }));

      expect(gainAt(bands, stepped, 1000)).toBeCloseTo(
        3 - CONTINUOUS_STEP_DB,
        6,
      );
    });

    it('never accumulates past the cap, however long it runs', () => {
      let bands = bandsAt({});
      // Far more updates than it takes to cross the range, every one pulling
      // the same way — which is the shape of the failure the cap is there for:
      // a measurement that is confidently wrong for an hour.
      for (let pass = 0; pass < 200; pass += 1) {
        const stepped = stepSmartEqGains(bands, solvedAt(bands, { 1000: 40 }));
        bands = getSmartEqBands(buildSmartEqSettings(bands, stepped));
      }

      expect(bandAt(bands, 1000)?.gain).toBeCloseTo(CONTINUOUS_MAX_DB, 6);
    });

    it('averages the destination over windows, so one album cannot move it', () => {
      // What Continuous EQ converges on has to be the system, and the system
      // does not change. A bass-heavy album and a thin one are two steady,
      // confident, opposite answers, and acting on each in turn is a correction
      // that raises the bass and then lowers it for as long as anybody listens.
      const bassy = { b: 4 };
      const thin = { b: -4 };

      let target: Record<string, number> = {};
      // The first answer is taken whole: with no history, one measurement is
      // the estimate.
      target = blendSmartEqTarget(target, bassy);
      expect(target.b).toBe(4);

      // Then they cancel rather than accumulate.
      for (let pass = 0; pass < 20; pass += 1) {
        target = blendSmartEqTarget(target, pass % 2 === 0 ? thin : bassy);
      }
      expect(Math.abs(target.b)).toBeLessThan(1);
    });

    it('moves by a fraction, so a single disagreeing track writes nothing', () => {
      // Under the deadband on purpose: the two rules together are what stop it
      // writing at all once it is right.
      const target = blendSmartEqTarget({ b: 0 }, { b: 2 });
      expect(target.b).toBeCloseTo(2 * CONTINUOUS_MEMORY, 6);
      expect(target.b).toBeLessThan(CONTINUOUS_TRIGGER_DB);
    });

    it('keeps the destination of a band this window said nothing about', () => {
      // No evidence is not evidence of nothing, so it must not decay to zero.
      expect(blendSmartEqTarget({ b: 3 }, {}).b).toBe(3);
      expect(blendSmartEqTarget({ b: 3 }, { b: Number.NaN }).b).toBe(3);
    });

    it('leaves a band the solve said nothing about exactly where it is', () => {
      const bands = bandsAt({ 1000: 3 });
      const stepped = stepSmartEqGains(bands, {});

      // Not pulled toward flat: a passage with no energy at 1 kHz is not
      // evidence that 1 kHz needs no correction.
      expect(gainAt(bands, stepped, 1000)).toBeCloseTo(3, 6);
    });
  });
});
