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

import { IFilter } from 'common/constants';
import { IVoicingSettings, getVoicingFilters } from 'common/voicing';
import { getCombinedLineData, getFilterLineData } from '../graph/utils';
import { IChartLineDataPointsById } from '../graph/ChartController';
import { ISpectrumSample } from './autoBalance';

/**
 * Turn a voicing profile into a target curve for Smart EQ.
 *
 * The profile's filters are run through the same biquad magnitude code the
 * response graph uses, so the target is the voicing's true frequency response
 * rather than a sketch of it. Smart EQ then drives the measured output toward
 * this shape instead of merely flattening resonances.
 */
export const buildVoicingTargetCurve = (
  settings: IVoicingSettings | undefined,
): ISpectrumSample[] => {
  const filters = getVoicingFilters(settings);
  if (filters.length === 0) {
    return [];
  }

  const lines: IChartLineDataPointsById = {};
  filters.forEach((filter, index) => {
    const asFilter: IFilter = {
      id: String(index),
      frequency: filter.frequency,
      gain: filter.gain,
      quality: filter.quality,
      type: filter.type,
    };
    lines[asFilter.id] = getFilterLineData(asFilter);
  });

  return getCombinedLineData(0, lines).map((point) => ({
    frequency: point.x,
    level: point.y,
  }));
};
