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
  getDefaultState,
  IFiltersMap,
  RESERVED_FILE_NAMES_SET,
} from 'common/constants';
import {
  cloneFilters,
  computeAvgFreq,
  isFixedBandSizeEnumValue,
  isRestrictedPresetName,
  roundToPrecision,
} from 'common/utils';
import { sortHelper } from 'renderer/utils/utils';

describe('utils', () => {
  describe('roundToPrecision', () => {
    it('should round to two decimals', () => {
      expect(roundToPrecision(1.2345, 2)).toBe(1.23);
      expect(roundToPrecision(1.2, 2)).toBe(1.2);
      expect(roundToPrecision(9.8765, 2)).toBe(9.88);
    });

    it('should round to integer', () => {
      expect(roundToPrecision(1.2345, 0)).toBe(1);
      expect(roundToPrecision(101.81, 0)).toBe(102);
    });
  });

  // The numbers here are read off the default band set, which is the
  // 2/3-octave fifteen — 25, 40, 63, 100, 160, 250 … 16000 — rather than the
  // octave ten it used to be. Only the frequencies moved; what is being
  // checked is still the mean between one band and the next.
  describe('computeAvgFreq', () => {
    const filters = Object.values(getDefaultState().filters).sort(sortHelper);
    it('should compute average of first filter and min frequency for index 0', () => {
      expect(computeAvgFreq(null, filters[0])).toBe(5);
    });

    it('should compute average of last filter and max frequency for last index', () => {
      expect(computeAvgFreq(filters[filters.length - 1], null)).toBe(17889);
    });

    it('should compute average of neighbouring filters for intermediary indices', () => {
      // Between 40 Hz and 63 Hz
      expect(computeAvgFreq(filters[1], filters[2])).toBe(50);
      // Between 100 Hz and 160 Hz
      expect(computeAvgFreq(filters[3], filters[4])).toBe(126);
    });
  });

  describe('isRestrictedPresetName', () => {
    it('should return true for restricted names', () => {
      RESERVED_FILE_NAMES_SET.forEach((name) => {
        expect(isRestrictedPresetName(name)).toBe(true);
      });
    });

    it('should return false for non restricted names', () => {
      expect(isRestrictedPresetName('greatest preset of all time')).toBe(false);
    });

    it('refuses characters Windows will not put in a file name', () => {
      // These reached fs.renameSync unchecked and came back as a generic
      // preset file error advising the user to check that their installation
      // directory was writeable — for a problem that was in the name.
      [
        'Bass: boost',
        'What?',
        'a/b',
        'a\\b',
        'x*y',
        'q"r',
        'a<b',
        'a>b',
        'a|b',
      ].forEach((name) => {
        expect(isRestrictedPresetName(name)).toBe(true);
      });
    });

    it('refuses a name Windows would silently shorten', () => {
      // Stored without the trailing character, so the file on disk and the
      // assignment naming it stop agreeing.
      expect(isRestrictedPresetName('Bass ')).toBe(true);
      expect(isRestrictedPresetName('Bass.')).toBe(true);
    });

    it('still allows the names people actually use', () => {
      // The assertion that matters most here. A guard one character too wide
      // locks everybody out of every profile FluidEQ names for itself.
      expect(isRestrictedPresetName('Untitled profile 1')).toBe(false);
      expect(isRestrictedPresetName('Bass boost')).toBe(false);
      expect(isRestrictedPresetName("Ivan's mix (v2) - final!")).toBe(false);
      expect(isRestrictedPresetName('Écoute nocturne')).toBe(false);
      expect(isRestrictedPresetName('夜間リスニング')).toBe(false);
    });
  });

  describe('cloneFilters', () => {
    const filtersMap: IFiltersMap = getDefaultState().filters;
    const copy = cloneFilters(filtersMap);
    it('should have same values', () => {
      Object.entries(filtersMap).forEach(([id, filter]) => {
        expect(copy[id]).toStrictEqual(filter);
      });
      Object.entries(copy).forEach(([id, filter]) => {
        expect(filtersMap[id]).toStrictEqual(filter);
      });
    });

    it('should have distinct IFilter objects', () => {
      Object.entries(filtersMap).forEach(([id, filter]) => {
        filter.id = `${id}*`;
      });
      Object.entries(copy).forEach(([id, filter]) => {
        expect(filter.id).toBe(`${id}`);
      });
    });
  });

  describe('isFixedBandSizeEnumValue', () => {
    it('should be true for valid fixed band size values', () => {
      expect(isFixedBandSizeEnumValue(6)).toBeTruthy();
      expect(isFixedBandSizeEnumValue(10)).toBeTruthy();
      expect(isFixedBandSizeEnumValue(15)).toBeTruthy();
      expect(isFixedBandSizeEnumValue(31)).toBeTruthy();
    });

    it('should be false for invalid fixed band size values', () => {
      expect(isFixedBandSizeEnumValue(1)).toBeFalsy();
      expect(isFixedBandSizeEnumValue(-1)).toBeFalsy();
      expect(isFixedBandSizeEnumValue(16)).toBeFalsy();
    });
  });
});
