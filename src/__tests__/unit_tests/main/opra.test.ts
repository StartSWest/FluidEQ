/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

import { FilterTypeEnum } from 'common/constants';
import { forgetOpraIndex, getOpraPreset, getOpraProductList } from 'main/opra';
import { addFileToPath } from 'main/flush';

const OPRA_DIR = addFileToPath('src/__tests__/data/read_only', 'opra');

describe('opra', () => {
  // The reader caches the index per directory, and every test here reads the
  // same fixture directory, so a stale cache would not show up as a failure —
  // it would show up as a test that passes without reading anything.
  beforeEach(() => {
    forgetOpraIndex();
  });

  describe('getOpraProductList', () => {
    it('lists products with their vendor and curve metadata', () => {
      const products = getOpraProductList(OPRA_DIR);

      expect(products.map((product) => product.id)).toEqual([
        'testbrand::model_one',
        'otherbrand::model_two',
      ]);
      expect(products[0]).toMatchObject({
        vendor: 'TestBrand',
        name: 'Model One',
        subtype: 'over_the_ear',
      });
      // The credit the licence requires travels with the curve, so the picker
      // never has to go and look it up separately.
      expect(products[0].curves[0]).toMatchObject({
        author: 'oratory1990',
        details: 'Harman Target',
        link: 'https://example.invalid/measurement',
      });
      // Most curves have no link, and the field is simply absent rather than
      // empty — the credit line renders it conditionally.
      expect(products[0].curves[1].link).toBeUndefined();
    });
  });

  describe('getOpraPreset', () => {
    it('maps every OPRA band type onto an APO filter', () => {
      const preset = getOpraPreset(
        'testbrand::model_one',
        'testbrand:model_one::oratory1990',
        OPRA_DIR,
      );

      expect(preset.preAmp).toBe(-6.7);
      const byFrequency = (frequency: number) =>
        Object.values(preset.filters).find(
          (band) => band.frequency === frequency,
        );

      expect(byFrequency(200)).toMatchObject({
        gain: 8.8,
        quality: 0.7,
        type: FilterTypeEnum.LSC,
      });
      expect(byFrequency(1000)).toMatchObject({
        gain: -3.2,
        type: FilterTypeEnum.PK,
      });
      expect(byFrequency(10000)).toMatchObject({
        type: FilterTypeEnum.HSC,
      });
      expect(byFrequency(18000)).toMatchObject({
        type: FilterTypeEnum.LPQ,
      });
    });

    it('derives a pass filter Q from its slope, and gives it no gain', () => {
      const preset = getOpraPreset(
        'testbrand::model_one',
        'testbrand:model_one::oratory1990',
        OPRA_DIR,
      );
      const lowPass = Object.values(preset.filters).find(
        (band) => band.frequency === 18000,
      );

      // Five bands in the published library are low-pass filters given as a
      // slope with no gain and no Q. Twelve dB per octave is second order, and
      // second order without ripple is Butterworth — 1/√2. Falling through to
      // the neutral default of 1 would put a ~1.2 dB lift below the corner.
      expect(lowPass?.quality).toBeCloseTo(Math.SQRT1_2, 6);
      expect(lowPass?.gain).toBe(0);
    });

    it('keys every band by its own id', () => {
      const preset = getOpraPreset(
        'testbrand::model_one',
        'testbrand:model_one::oratory1990',
        OPRA_DIR,
      );

      // Band ids come from uid(8). 2.31% of those are all digits, and 2.08% are
      // canonical array indices — the difference is a leading zero, which keeps
      // a key insertion-ordered. V8 enumerates the index-like keys first, so one
      // numeric id anywhere in the map silently moves a different band to the
      // front of Object.keys. Looking bands up by frequency rather than by
      // position is what keeps this suite from flaking; this states the
      // invariant that makes that safe.
      Object.entries(preset.filters).forEach(([id, band]) => {
        expect(band.id).toBe(id);
      });
    });

    it('rounds a fractional centre frequency instead of truncating it', () => {
      const preset = getOpraPreset(
        'testbrand::model_one',
        'testbrand:model_one::edge_cases',
        OPRA_DIR,
      );

      // Forty-nine bands in the published library sit on fractional centres,
      // the lowest at 8.5 Hz. The AutoEq parser this replaced used parseInt,
      // which would have moved every one of them down.
      const frequencies = Object.values(preset.filters).map(
        (band) => band.frequency,
      );
      expect(frequencies).toContain(9);
      expect(frequencies).not.toContain(8);
    });

    it('bounds a measured gain that is larger than a measurement should claim', () => {
      const preset = getOpraPreset(
        'testbrand::model_one',
        'testbrand:model_one::edge_cases',
        OPRA_DIR,
      );
      const byFrequency = (frequency: number) =>
        Object.values(preset.filters).find(
          (band) => band.frequency === frequency,
        );

      // -20 dB at 9 Hz is the rig, not the headphone: outside the trusted band
      // the limit is 8 dB.
      expect(byFrequency(9)?.gain).toBe(-8);
      // +18 dB at 500 Hz is inside it, where 12 dB is the limit.
      expect(byFrequency(500)?.gain).toBe(12);
    });

    it('falls back to a neutral Q when a band omits one', () => {
      const preset = getOpraPreset(
        'testbrand::model_one',
        'testbrand:model_one::edge_cases',
        OPRA_DIR,
      );
      const band = Object.values(preset.filters).find(
        (entry) => entry.frequency === 2000,
      );

      // Five bands in the published library have no q at all.
      expect(band?.quality).toBe(1);
    });

    it('skips a band type it does not understand rather than failing the curve', () => {
      const preset = getOpraPreset(
        'testbrand::model_one',
        'testbrand:model_one::edge_cases',
        OPRA_DIR,
      );

      // The importer rejects unknown types at build time, so this only happens
      // if the database on disk was not built by it. Losing one band beats
      // losing the correction.
      expect(Object.keys(preset.filters)).toHaveLength(3);
      expect(
        Object.values(preset.filters).find((band) => band.frequency === 4000),
      ).toBeUndefined();
    });

    it('refuses a product or curve it does not have', () => {
      expect(() =>
        getOpraPreset('testbrand::nothing', 'whatever', OPRA_DIR),
      ).toThrow();
      expect(() =>
        getOpraPreset('testbrand::model_one', 'no-such-curve', OPRA_DIR),
      ).toThrow();
    });
  });
});
