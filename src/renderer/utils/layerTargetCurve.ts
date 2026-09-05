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

import { IFilter } from 'common/constants';
import { getCombinedLineData, getFilterLineData } from '../graph/utils';
import { IChartLineDataPointsById } from '../graph/ChartController';
import { ISpectrumSample, sampleSpectrumAt } from './autoBalance';

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
 * The combined response of a set of filters, as a spectrum.
 *
 * Filters run through the same biquad magnitude code as the response graph, so
 * this is the layers' true response rather than a sketch of it.
 *
 * This file used to build a second curve from the same helper: a target of
 * layers the solver was told to leave alone — the voicing, the driver, the
 * headset correction — while the user's own bands were deliberately left out of
 * it so that Smart EQ would correct them. That is gone, and not into another
 * file. The measurement now subtracts the whole chain (see `buildChainGainDb`),
 * so nothing deliberate is in what the solver sees and nothing has to be
 * classified as excused or fair game. The user's bands are the reason: measured
 * from the output they read as error, and Smart EQ built their mirror image.
 */
const curveOf = (
  filters: Pick<IFilter, 'frequency' | 'gain' | 'quality' | 'type'>[],
): ISpectrumSample[] => {
  const renderable = filters.filter(isRenderable);
  if (renderable.length === 0) {
    return [];
  }

  const lines: IChartLineDataPointsById = {};
  renderable.forEach((filter, index) => {
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

/**
 * What the applied chain is doing at every point of the analyser's axis, in dB.
 *
 * Subtracted from the capture, this turns "what is coming out" into "what was on
 * the record" — see `accumulateBalanceFrame`, which is where the argument for
 * doing that lives.
 *
 * EVERY layer, deliberate or not, and that is the point rather than an
 * oversight. A voicing, a headphone correction and a slider somebody dragged are
 * all equally not part of the record, so all three come out and all three then
 * sit on top of the corrected source exactly as applied — nothing has to be
 * classified, and nothing can be classified wrongly.
 *
 * Sampled onto the caller's axis rather than returned as a curve, because it is
 * subtracted point by point from an FFT frame thirty times a second.
 *
 * AND COMPUTED ONCE PER CHAIN, NOT ONCE PER FRAME. The capture asks for this
 * on every frame, because the chain changes underneath a session that never
 * ends and the accumulator has no way to know when. But the chain changes when
 * somebody touches something — a band, a voicing, a headphone layer — and
 * between touches it is the same forty filters, so this was rendering the
 * same curve thirty times a second: a thousand biquad evaluations and a
 * thousand allocated points per filter, per frame. Measured at 2.4 ms a frame
 * with ten filters and 7.8 ms with forty — a quarter of a core for as long as
 * a continuous mode ran, on the thread that draws the graph, plus the garbage.
 *
 * So the last answer is kept, keyed on what the filters ARE and on the axis
 * they were sampled onto, and handed back for as long as neither has changed.
 * The key is built from the filters' values rather than their identity, so a
 * list rebuilt from the same profile on every frame still hits. One entry,
 * because there is one capture.
 */
const chainKeyOf = (
  filters: Pick<IFilter, 'frequency' | 'gain' | 'quality' | 'type'>[],
): string =>
  filters
    .map(
      (filter) =>
        `${filter.type}@${filter.frequency}/${filter.gain}/${filter.quality}`,
    )
    .join(',');

let lastChain: { key: string; axis: number[]; gainDb: number[] } | undefined;

// Named, like every other helper the engine imports; a default export would
// make this the one import in that list spelled differently.
// eslint-disable-next-line import/prefer-default-export
export const buildChainGainDb = (
  filters: Pick<IFilter, 'frequency' | 'gain' | 'quality' | 'type'>[],
  axis: number[],
): number[] => {
  const key = chainKeyOf(filters);
  if (lastChain && lastChain.key === key && lastChain.axis === axis) {
    return lastChain.gainDb;
  }
  const curve = curveOf(filters);
  const gainDb =
    curve.length === 0
      ? axis.map(() => 0)
      : axis.map((frequency) => sampleSpectrumAt(curve, frequency));
  lastChain = { key, axis, gainDb };
  return gainDb;
};
