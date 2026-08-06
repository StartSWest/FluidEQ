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

import {
  DEFAULT_DRIVER_INTENSITY,
  DRIVER_PROFILES,
  getDriverFilters,
  getDriverPeakBoost,
  getDriverProfile,
} from '../../../common/driver';
import { stateToString } from '../../../main/flush';
import {
  FilterTypeEnum,
  MAX_GAIN,
  NO_GAIN_FILTER_TYPES,
  getDefaultState,
} from '../../../common/constants';

describe('driver compensation', () => {
  describe('the profile set', () => {
    it('has unique ids', () => {
      const ids = DRIVER_PROFILES.map((profile) => profile.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('only uses filter forms Equalizer APO can build', () => {
      const allowed = [
        FilterTypeEnum.PK,
        FilterTypeEnum.LSC,
        FilterTypeEnum.HSC,
      ];
      DRIVER_PROFILES.forEach((profile) => {
        profile.filters.forEach((filter) => {
          expect(allowed).toContain(filter.type);
        });
      });
    });

    it('keeps every gain conservative', () => {
      // The whole premise is that a wrong guess must stay recoverable. Nothing
      // here may be loud enough to ruin a listen on its own.
      DRIVER_PROFILES.forEach((profile) => {
        profile.filters.forEach((filter) => {
          expect(Math.abs(filter.gain)).toBeLessThanOrEqual(2);
        });
      });
    });

    it('gives every filter a finite, in-range set of numbers', () => {
      DRIVER_PROFILES.forEach((profile) => {
        profile.filters.forEach((filter) => {
          expect(Number.isFinite(filter.frequency)).toBe(true);
          expect(filter.frequency).toBeGreaterThan(0);
          expect(filter.frequency).toBeLessThanOrEqual(20000);
          expect(Number.isFinite(filter.gain)).toBe(true);
          expect(filter.quality).toBeGreaterThan(0);
        });
      });
    });

    it('explains every filter and every profile', () => {
      DRIVER_PROFILES.forEach((profile) => {
        expect(profile.note.length).toBeGreaterThan(20);
        profile.filters.forEach((filter) => {
          expect(filter.reason.length).toBeGreaterThan(20);
        });
      });
    });
  });

  describe('getDriverFilters', () => {
    it('returns nothing when no profile is selected', () => {
      expect(getDriverFilters(undefined)).toEqual([]);
      expect(getDriverFilters({ profileId: '', intensity: 1 })).toEqual([]);
    });

    it('returns nothing for an unknown profile', () => {
      expect(getDriverFilters({ profileId: 'nope', intensity: 1 })).toEqual([]);
    });

    it('returns nothing at zero intensity', () => {
      expect(
        getDriverFilters({ profileId: 'dynamic-headphone', intensity: 0 }),
      ).toEqual([]);
    });

    it('scales gains by intensity', () => {
      const full = getDriverFilters({
        profileId: 'balanced-armature-iem',
        intensity: 1,
      });
      const half = getDriverFilters({
        profileId: 'balanced-armature-iem',
        intensity: 0.5,
      });

      expect(half).toHaveLength(full.length);
      half.forEach((filter, index) => {
        // Gains quantise to 0.1 dB, which is the resolution written to the APO
        // config, so 1.5 dB halved lands on exactly 0.8 rather than 0.75. The
        // assertion mirrors that rounding rather than allowing a tolerance,
        // because the quantisation is the contract, not an approximation.
        expect(filter.gain).toBe(Math.round((full[index].gain / 2) * 10) / 10);
      });
    });

    it('drops filters whose scaled gain rounds away', () => {
      // A 0 dB peaking filter is inert; writing it would leave dead commands
      // in the APO config for no reason.
      const barely = getDriverFilters({
        profileId: 'dynamic-headphone',
        intensity: 0.01,
      });
      barely.forEach((filter) => {
        expect(
          NO_GAIN_FILTER_TYPES.includes(filter.type) || filter.gain !== 0,
        ).toBe(true);
      });
    });

    it('never exceeds the gain ceiling', () => {
      DRIVER_PROFILES.forEach((profile) => {
        getDriverFilters({ profileId: profile.id, intensity: 1 }).forEach(
          (filter) => {
            expect(Math.abs(filter.gain)).toBeLessThanOrEqual(MAX_GAIN);
          },
        );
      });
    });
  });

  it('reports the worst-case boost so headroom can be reserved', () => {
    // Only positive gains can clip, so a profile that only cuts reserves none.
    expect(getDriverPeakBoost({ profileId: 'hybrid-iem', intensity: 1 })).toBe(
      0,
    );
    expect(
      getDriverPeakBoost({ profileId: 'balanced-armature-iem', intensity: 1 }),
    ).toBeGreaterThan(0);
  });

  it('defaults below full strength', () => {
    expect(DEFAULT_DRIVER_INTENSITY).toBeGreaterThan(0);
    expect(DEFAULT_DRIVER_INTENSITY).toBeLessThan(1);
  });

  describe('as written into the APO config', () => {
    const configWith = (profileId: string) => {
      const state = getDefaultState();
      state.isFlat = false;
      state.filters = {
        a: {
          id: 'a',
          frequency: 100,
          gain: 4,
          quality: 1,
          type: FilterTypeEnum.PK,
        },
      };
      state.voicing = { profileId: 'music', intensity: 1 };
      state.driver = { profileId, intensity: 1 };
      return stateToString(state).replace(/\r/g, '');
    };

    it('numbers all three layers as one ascending chain', () => {
      // APO reads the file top to bottom; the bands, the voicing and the driver
      // layer share one filter counter and must not collide or skip.
      const indices = configWith('balanced-armature-iem')
        .split('\n')
        .filter((line) => line.startsWith('Filter'))
        .map((line) => Number(/^Filter (\d+)/.exec(line)?.[1]));

      expect(indices.length).toBeGreaterThan(3);
      indices.forEach((value, index) => {
        expect(value).toBe(index + 1);
      });
    });

    it('writes the driver layer before the user bands, beside the convolution', () => {
      const config = configWith('balanced-armature-iem');
      const userBand = config.indexOf('Fc 100 Hz Gain 4 dB');
      const driverBand = config.indexOf('Fc 3000 Hz');

      // Driver corrects the transducer, so it sits with the hardware layers at
      // the head of the chain rather than on top of a tuning. Nothing audible
      // depends on this — cascaded biquads add in dB whatever the order — but
      // the config should read physical, intended, taste, measured.
      expect(userBand).toBeGreaterThan(-1);
      expect(driverBand).toBeGreaterThan(-1);
      expect(driverBand).toBeLessThan(userBand);
    });

    it('survives every profile without emitting a malformed line', () => {
      DRIVER_PROFILES.forEach((profile) => {
        const config = configWith(profile.id);
        expect(config).not.toMatch(/NaN|Infinity|undefined/);
      });
    });

    it('leaves the config untouched when no driver is selected', () => {
      const state = getDefaultState();
      state.isFlat = true;
      state.driver = { profileId: '', intensity: 1 };
      expect(stateToString(state)).not.toMatch(/Filter/);
    });
  });

  it('resolves profiles by id', () => {
    expect(getDriverProfile('planar-headphone')?.name).toBe('Planar magnetic');
    expect(getDriverProfile('missing')).toBeUndefined();
  });
});
