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
  IFilter,
  IHeadphoneSettings,
  NO_GAIN_FILTER_TYPES,
  clampGain,
} from './constants';

/**
 * The published headphone correction as filters, scaled by its strength.
 *
 * Written the same way the voicing and the driver are, and deliberately so:
 * three layers that correct three different things should be three blocks of
 * anonymous `Filter N:` lines after the user's own bands, not one of them
 * hiding inside those bands.
 *
 * A peak or shelf at 0 dB is inert, so it is dropped rather than written as a
 * command that does nothing — the same rule every other layer follows. A
 * gainless type is kept, because it shapes the signal at 0 dB.
 */
export const getHeadphoneFilters = (
  settings: IHeadphoneSettings | undefined,
): Array<Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>> => {
  if (!settings?.filters) {
    return [];
  }
  const intensity = Number.isFinite(settings.intensity)
    ? Math.max(0, Math.min(1, settings.intensity))
    : 1;
  if (intensity === 0) {
    return [];
  }

  return Object.values(settings.filters)
    .filter(
      (filter) =>
        Number.isFinite(filter.frequency) &&
        Number.isFinite(filter.gain) &&
        Number.isFinite(filter.quality),
    )
    .map(({ type, frequency, gain, quality }) => ({
      type,
      frequency,
      // Rounded to a tenth, which is all Equalizer APO reads and all anybody
      // can hear. Without it, halving a correction writes gains like 2.8499999
      // into a file somebody may well open and read.
      gain: clampGain(Math.round(gain * intensity * 10) / 10),
      quality,
    }))
    .filter(
      (filter) =>
        NO_GAIN_FILTER_TYPES.includes(filter.type) || filter.gain !== 0,
    )
    .sort((left, right) => left.frequency - right.frequency);
};

/** Whether anything of this layer would actually reach Equalizer APO. */
export const hasHeadphoneLayer = (
  settings: IHeadphoneSettings | undefined,
): boolean => getHeadphoneFilters(settings).length > 0;
