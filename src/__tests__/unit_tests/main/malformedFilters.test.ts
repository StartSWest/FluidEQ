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

import { stateToString } from '../../../main/flush';
import {
  FilterTypeEnum,
  clampFrequency,
  clampGain,
  clampQuality,
  getDefaultState,
  IFilter,
} from '../../../common/constants';

const band = (over: Partial<IFilter>): IFilter => ({
  id: 'b',
  frequency: 1000,
  gain: 3,
  quality: 1,
  type: FilterTypeEnum.PK,
  ...over,
});

/**
 * Equalizer APO cannot build a biquad from `Fc NaN Hz`, and a bad measurement
 * import is a realistic way to get one: providers publish duplicate frequency
 * rows, interpolating across a zero-width span gives 0/0, and Math.min/max
 * clamps pass NaN straight through. Nothing malformed may reach the config.
 */
describe('malformed bands never reach Equalizer APO', () => {
  describe('clamps', () => {
    it('collapse non-finite input to a neutral value', () => {
      // Infinity deliberately becomes 0 rather than MAX_GAIN. An infinite gain
      // means something upstream already failed, and answering that with a
      // silent +20 dB boost would be a far worse thing to send to a speaker
      // than answering it with silence.
      expect(clampGain(NaN)).toBe(0);
      expect(clampGain(Infinity)).toBe(0);
      expect(clampGain(-Infinity)).toBe(0);
      expect(clampQuality(NaN)).toBe(1);
      expect(clampFrequency(NaN)).toBe(1);
    });

    it('leave good values exactly as they are', () => {
      expect(clampGain(5.5)).toBe(5.5);
      expect(clampQuality(1.4)).toBe(1.4);
      expect(clampFrequency(880)).toBe(880);
    });

    it('bound frequencies to what APO accepts', () => {
      expect(clampFrequency(0)).toBe(1);
      expect(clampFrequency(999999)).toBe(20000);
      expect(clampFrequency(440.6)).toBe(441);
    });
  });

  describe('the written config', () => {
    const configFor = (filters: IFilter[], preAmp = 0) => {
      const state = getDefaultState();
      state.isFlat = false;
      state.preAmp = preAmp;
      state.filters = Object.fromEntries(
        filters.map((filter, index) => [
          `f${index}`,
          { ...filter, id: `f${index}` },
        ]),
      );
      return stateToString(state);
    };

    it('never contains NaN or Infinity', () => {
      const config = configFor(
        [
          band({ frequency: NaN, gain: NaN, quality: NaN }),
          band({ frequency: Infinity, gain: 3 }),
          band({ gain: -Infinity }),
          band({ frequency: 880, gain: 3.5, quality: 1.4 }),
        ],
        NaN,
      );

      expect(config).not.toMatch(/NaN/);
      expect(config).not.toMatch(/Infinity/);
    });

    it('drops only the malformed bands and keeps the good one', () => {
      const config = configFor([
        band({ frequency: NaN, gain: NaN, quality: NaN }),
        band({ frequency: 880, gain: 3.5, quality: 1.4 }),
      ]);

      expect(config).toContain('Filter 1: ON PK Fc 880 Hz Gain 3.5 dB Q 1.4');
      // Renumbered from 1: the dropped band must not leave a gap, because APO
      // wants ordered indices.
      expect(config).not.toContain('Filter 2:');
    });

    it('writes a usable preamp when the stored one is corrupt', () => {
      expect(configFor([band({})], NaN)).toContain('Preamp: 0 dB');
    });

    it('is unchanged for an entirely healthy state', () => {
      const config = configFor([
        band({ frequency: 100, gain: 2, quality: 0.7 }),
        band({ frequency: 4000, gain: -3, quality: 2 }),
      ]);

      expect(config).toContain('Filter 1: ON PK Fc 100 Hz Gain 2 dB Q 0.7');
      expect(config).toContain('Filter 2: ON PK Fc 4000 Hz Gain -3 dB Q 2');
    });
  });
});
