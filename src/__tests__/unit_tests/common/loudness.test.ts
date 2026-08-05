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

import { FilterTypeEnum, NO_GAIN_FILTER_TYPES } from 'common/constants';
import {
  DEFAULT_LOUDNESS,
  getLoudnessFilters,
  getLoudnessImpression,
  getLoudnessIntensity,
} from 'common/loudness';

describe('the loudness layer', () => {
  it('writes nothing at all when it is off', () => {
    // A layer that is off must cost nothing: flush skips it and the preamp is
    // computed as though it never existed.
    expect(getLoudnessFilters(DEFAULT_LOUDNESS)).toHaveLength(0);
    expect(getLoudnessFilters(undefined)).toHaveLength(0);
  });

  it('writes nothing at zero intensity either', () => {
    expect(getLoudnessFilters({ isOn: true, intensity: 0 })).toHaveLength(0);
  });

  it('lifts both ends and leaves the middle alone', () => {
    // The whole idea. The ear loses bass and treble as level drops, so both
    // ends come up; the midrange comes down slightly so it does not sound
    // recessed by comparison.
    const filters = getLoudnessFilters({ isOn: true, intensity: 1 });
    const low = filters.find((f) => f.frequency < 200);
    const high = filters.find((f) => f.frequency >= 6000);
    const mid = filters.find((f) => f.frequency > 500 && f.frequency < 2000);

    expect(low!.gain).toBeGreaterThan(0);
    expect(high!.gain).toBeGreaterThan(0);
    expect(mid!.gain).toBeLessThan(0);
  });

  it('scales the whole curve together rather than switching presets', () => {
    // Half intensity is the same shape at half the gain, so the slider is a
    // continuous control rather than a set of steps with different characters.
    const full = getLoudnessFilters({ isOn: true, intensity: 1 });
    const half = getLoudnessFilters({ isOn: true, intensity: 0.5 });
    expect(half).toHaveLength(full.length);
    half.forEach((filter, index) => {
      expect(filter.frequency).toBe(full[index].frequency);
      expect(filter.gain).toBeCloseTo(full[index].gain / 2, 1);
    });
  });

  it('only uses filter forms that take a gain', () => {
    // Everything here is written with a Gain token, and APO rejects the line
    // outright if a pass or notch form carries one.
    getLoudnessFilters({ isOn: true, intensity: 1 }).forEach((filter) => {
      expect(NO_GAIN_FILTER_TYPES).not.toContain(filter.type);
    });
  });

  it('stays within the range the shelves are meant for', () => {
    // A loudness curve that doubles as a smiley-face EQ is why the feature got
    // a bad name. Nothing here should be a drastic move.
    getLoudnessFilters({ isOn: true, intensity: 1 }).forEach((filter) => {
      expect(Math.abs(filter.gain)).toBeLessThanOrEqual(7);
    });
  });

  it('uses shelves at the ends and a bell in the middle', () => {
    const filters = getLoudnessFilters({ isOn: true, intensity: 1 });
    expect(filters[0].type).toBe(FilterTypeEnum.LSC);
    expect(filters.some((f) => f.type === FilterTypeEnum.HSC)).toBe(true);
    expect(filters.some((f) => f.type === FilterTypeEnum.PK)).toBe(true);
  });

  it('clamps an intensity that has been stored out of range', () => {
    expect(getLoudnessIntensity({ isOn: true, intensity: 4 })).toBe(1);
    expect(getLoudnessIntensity({ isOn: true, intensity: -2 })).toBe(0);
  });

  it('reports nothing gained while it is off', () => {
    expect(getLoudnessImpression({ isOn: false, intensity: 1 })).toBe(0);
  });

  it('reports more at higher intensity', () => {
    expect(getLoudnessImpression({ isOn: true, intensity: 1 })).toBeGreaterThan(
      getLoudnessImpression({ isOn: true, intensity: 0.5 }),
    );
  });

  it('is off by default, because it changes how everything sounds', () => {
    expect(DEFAULT_LOUDNESS.isOn).toBe(false);
  });
});
