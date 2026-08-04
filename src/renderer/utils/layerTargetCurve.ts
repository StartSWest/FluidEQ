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

import { IFilter, IFiltersMap } from 'common/constants';
import { IVoicingSettings, getVoicingFilters } from 'common/voicing';
import { IDriverSettings, getDriverFilters } from 'common/driver';
import { getCombinedLineData, getFilterLineData } from '../graph/utils';
import { IChartLineDataPointsById } from '../graph/ChartController';
import { ISpectrumSample } from './autoBalance';

/** A band with a non-finite number cannot be turned into a biquad, and one NaN
 * anywhere poisons the whole summed curve rather than a single point. */
const isRenderable = ({
  frequency,
  gain,
  quality,
}: Pick<IFilter, 'frequency' | 'gain' | 'quality'>) =>
  Number.isFinite(frequency) &&
  Number.isFinite(gain) &&
  Number.isFinite(quality);

/**
 * The shape Smart EQ should steer the output towards, rather than flat.
 *
 * Every deliberate layer below Smart EQ is present in the capture, so without
 * a target the measurement reads all of them as error and cancels them out.
 * That is the whole of the target curve's job, and it is why *everything*
 * deliberate has to be in here — the user's own bands included.
 *
 * The bands were the omission that mattered. A headphone correction applied
 * from the AutoEQ panel lands in them, so leaving them out made every run read
 * that correction as error and invert it into the Smart EQ layer: the fixed
 * point of the loop was total cancellation, reached in a handful of runs, while
 * the band editor went on showing the correction at full value. They are as
 * deliberate as a voicing and belong in the goal for exactly the same reason.
 *
 * The Smart EQ layer itself is deliberately absent. It is in the measured
 * output on purpose — that is what makes the correction a residual and what
 * makes repeated runs converge instead of doubling.
 *
 * Filters run through the same biquad magnitude code as the response graph, so
 * this is the layers' true response rather than a sketch of it — and the bands
 * are summed exactly the way the graph sums them, rather than through a second
 * implementation of the same maths that could disagree with it.
 */
export const buildLayerTargetCurve = (
  bands: IFiltersMap | undefined,
  voicing: IVoicingSettings | undefined,
  driver: IDriverSettings | undefined,
): ISpectrumSample[] => {
  const filters = [
    ...Object.values(bands ?? {}),
    ...getVoicingFilters(voicing),
    ...getDriverFilters(driver),
  ].filter(isRenderable);
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
