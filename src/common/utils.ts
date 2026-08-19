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
  IFiltersMap,
  IFilter,
  MAX_FREQUENCY,
  MIN_FREQUENCY,
  RESERVED_FILE_NAMES_SET,
  FixedBandSizeEnum,
} from './constants';

export const roundToPrecision = (value: number, precision: number) => {
  const precisionFactor = 10 ** precision;
  return Math.round(value * precisionFactor) / precisionFactor;
};

export const computeAvgFreq = (
  leftFilter: IFilter | null,
  rightFilter: IFilter | null,
) => {
  const lo = leftFilter ? leftFilter.frequency : MIN_FREQUENCY;
  const hi = rightFilter ? rightFilter.frequency : MAX_FREQUENCY;
  const exponent = (Math.log10(lo) + Math.log10(hi)) / 2;
  return roundToPrecision(10 ** exponent, 0);
};

/**
 * Characters Windows will not put in a file name, plus the shape it silently
 * rewrites.
 *
 * The trailing dot or space is the subtle one: Windows accepts such a name and
 * stores it without the trailing character, so a profile saved as `Bass ` comes
 * back as `Bass` and the assignment naming it finds nothing.
 */
const UNWRITABLE_PRESET_NAME =
  // eslint-disable-next-line no-control-regex -- the control characters are the point
  /[<>:"/\\|?*\u0000-\u001f]|[. ]$/;

/**
 * A name no profile can be stored under, whatever the user meant by it.
 *
 * Two kinds, one answer. Even with case sensitivity set on a folder, Windows
 * will not accept a file of any case named as one of the reserved device names
 * — manually confirmed. And a name carrying `:` or `?` used to reach
 * `fs.renameSync` unchecked, where it failed as a generic "failed to read or
 * modify preset files" whose advice is to check that the installation directory
 * is writeable: the one message guaranteed to send somebody looking at folder
 * permissions for a problem that was in the name they typed.
 *
 * Asked in three places — the rename box as you type, and the save and rename
 * handlers before either touches the disk — so extending it here covers all of
 * them, and the message the user already gets for a reserved name is the right
 * one for this too.
 */
export const isRestrictedPresetName = (newName: string) =>
  RESERVED_FILE_NAMES_SET.has(newName.toUpperCase()) ||
  UNWRITABLE_PRESET_NAME.test(newName);

export const cloneFilters = (filters: IFiltersMap) => {
  const filtersClone: IFiltersMap = {};
  Object.entries(filters).forEach(([id, filter]) => {
    filtersClone[id] = { ...filter };
  });
  return filtersClone;
};

export const isFixedBandSizeEnumValue = (value: number) =>
  Object.values(FixedBandSizeEnum)
    .filter((key) => !Number.isNaN(Number(key)))
    .some((enumValue) => enumValue === value);
