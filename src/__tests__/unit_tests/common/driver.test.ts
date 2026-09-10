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

import {
  DEFAULT_DRIVER_INTENSITY,
  DRIVER_PROFILES,
  getDriverFilters,
  getDriverPeakBoost,
  getDriverProfile,
  getDriverGraphicEq,
  scaleDriverFilters,
} from '../../../common/driver';
import en from '../../../common/i18n/en';
import { stateToString } from '../../../main/flush';
import {
  getCombinedLineData,
  getFilterLineData,
} from '../../../renderer/graph/utils';
import { IChartLineDataPointsById } from '../../../renderer/graph/ChartController';
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
      //
      // The ceiling was 0.6, which turned out to be below the point where the
      // choices differ from each other: at that depth eleven of the twelve
      // profiles drew the same faint droop and 48 of the 66 pairs sat under
      // half a decibel apart. Recoverable is the requirement, not inaudible —
      // and a new selection still starts at half strength.
      DRIVER_PROFILES.forEach((profile) => {
        profile.filters.forEach((filter) => {
          expect(Math.abs(filter.gain)).toBeLessThanOrEqual(1.2);
        });
      });
    });

    /**
     * The catalogue drawn the way the panel draws it, at full strength.
     *
     * Through the graph's own biquad code rather than a copy of it: what the
     * user compares is the curve, and a filter list can differ on paper while
     * the two curves it produces sit on top of each other.
     */
    const responseOf = (profileId: string) => {
      const lines: IChartLineDataPointsById = {};
      getDriverProfile(profileId)?.filters.forEach((filter, index) => {
        lines[String(index)] = getFilterLineData({
          id: String(index),
          frequency: filter.frequency,
          gain: filter.gain,
          quality: filter.quality,
          type: filter.type,
        });
      });
      return getCombinedLineData(0, lines).filter(
        (point) => point.x >= 20 && point.x <= 20000,
      );
    };

    /** The largest gap between two curves anywhere on the audible band. */
    const separation = (left: string, right: string) => {
      const a = responseOf(left);
      const b = responseOf(right);
      return a.reduce(
        (widest, point, index) =>
          Math.max(widest, Math.abs(point.y - b[index].y)),
        0,
      );
    };

    /**
     * Every profile audibly different from every other one.
     *
     * This is the case that was missing. A retune trimmed the whole catalogue
     * to a single shallow shelf each, all of them in the same treble region,
     * and every existing case still passed: the ids were unique, the filter
     * types were legal, the gains were conservative and the reasons were
     * translated. What nobody could see was that eleven of the twelve now drew
     * the same faint droop — 48 of these 66 pairs under half a decibel apart at
     * their most different point, the closest two 0.04 dB — so the picker had
     * twelve entries and one behaviour.
     *
     * Half a decibel of broadband tilt is about where a tonal change starts
     * being audible at all, so it is the floor for two entries being different
     * choices rather than the same one named twice.
     */
    it('draws a different curve for every entry', () => {
      // A profile against itself, so a failure of this case means the curves
      // really are alike and not that the measurement stopped working. Without
      // it, a `separation` that returned a large number for everything would
      // pass here for ever while saying nothing.
      expect(separation('hybrid-iem', 'hybrid-iem')).toBe(0);

      const ids = DRIVER_PROFILES.map((profile) => profile.id);
      const tooClose = ids
        .flatMap((left, index) =>
          ids.slice(index + 1).map((right) => ({
            pair: `${left} vs ${right}`,
            dB: Number(separation(left, right).toFixed(2)),
          })),
        )
        .filter((entry) => entry.dB < 0.5);

      // Listed rather than counted: when this fails, the pairs that collided
      // and by how much is the whole of what the next person needs.
      expect(tooClose).toEqual([]);
    });

    it('gives every entry something to hear at all', () => {
      // A curve that never leaves the middle of its own plot is an entry that
      // does nothing, whatever its filter list says.
      DRIVER_PROFILES.forEach((profile) => {
        const peak = responseOf(profile.id).reduce(
          (deepest, point) => Math.max(deepest, Math.abs(point.y)),
          0,
        );
        expect(peak).toBeGreaterThanOrEqual(0.5);
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
        expect(en[profile.note].length).toBeGreaterThan(20);
        profile.filters.forEach((filter) => {
          expect(en[filter.reason].length).toBeGreaterThan(20);
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
        // Hundredth-dB steps keep low-strength adjustments audible.
        expect(filter.gain).toBe(
          Math.round((full[index].gain / 2) * 100) / 100,
        );
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
      getDriverPeakBoost({ profileId: 'planar-headphone', intensity: 1 }),
    ).toBeGreaterThan(0);
  });

  it('defaults below full strength', () => {
    expect(DEFAULT_DRIVER_INTENSITY).toBeGreaterThan(0);
    expect(DEFAULT_DRIVER_INTENSITY).toBeLessThan(1);
  });

  it('keeps fine steps in sync with the preview and the APO output', () => {
    const profile = getDriverProfile('planar-headphone');
    expect(profile).toBeDefined();
    const filters = profile?.filters ?? [];
    const a = scaleDriverFilters(filters, 0.5);
    const b = scaleDriverFilters(filters, 0.52);
    expect(a).not.toEqual(b);
    expect(
      getDriverFilters({ profileId: 'planar-headphone', intensity: 0.52 }),
    ).toEqual(b);
    expect(scaleDriverFilters(filters, 0)).toHaveLength(filters.length);
  });

  it.each([NaN, Infinity, -Infinity])(
    'rejects invalid driver intensity %s',
    (intensity) => {
      const settings = { profileId: 'planar-headphone', intensity };
      expect(getDriverFilters(settings)).toEqual([]);
      expect(getDriverPeakBoost(settings)).toBe(0);
    },
  );

  it('reserves the sum of overlapping boosts and respects graphic overrides', () => {
    const filter = {
      id: 'a',
      type: FilterTypeEnum.PK,
      frequency: 1000,
      quality: 1,
      gain: 3,
    };
    const settings = {
      profileId: 'planar-headphone',
      intensity: 1,
      apoOverride: { filters: { a: filter, b: { ...filter, id: 'b' } } },
    };
    expect(getDriverPeakBoost(settings)).toBeGreaterThan(5.9);
    expect(getDriverPeakBoost(settings)).toBeLessThanOrEqual(6);
    const graphic = {
      ...settings,
      intensity: 0.5,
      apoOverride: {
        filters: {},
        graphicEq: [
          { frequency: 20, gain: 0 },
          { frequency: 1000, gain: 6 },
          { frequency: 20000, gain: 0 },
        ],
      },
    };
    expect(getDriverFilters(graphic)).toEqual([]);
    expect(getDriverGraphicEq(graphic)[1].gain).toBe(3);
    expect(getDriverPeakBoost(graphic)).toBeCloseTo(3, 1);
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
      // Read from the profile rather than typed here. This was a literal
      // 3000 Hz, so retuning the catalogue failed an ordering test that has
      // nothing to say about which frequency the filter sits at.
      const driverBand = config.indexOf(
        `Fc ${getDriverProfile('balanced-armature-iem')?.filters[0].frequency} Hz`,
      );

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
