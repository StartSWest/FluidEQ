/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IEqCuts } from 'common/constants';
import { eqCutFilters } from 'common/eqCuts';
import { EQ_GAIN_REACH, IChartPointData } from './ChartController';
import { getCombinedLineData, getDesignedFilterLineData } from './utils';

/**
 * The output curve with the cuts on it, drawn the way both engines play them:
 * from the cookbook, at the output's own rate (`eqCuts.ts`).
 *
 * The curve stops at the bottom of the plot. A cut goes all the way to nothing
 * at Nyquist, which is minus infinity in dB, and a path through a hundred
 * decibels of nothing — or through a NaN past a cut's zero — is a path the
 * plot cannot draw. So a cut takes the curve down to the bottom of the EQ's
 * axis (`eqGainScale`, whose compressed end reaches -60 dB) and no lower,
 * unless the curve without it was already lower.
 */
const withEqCuts = (
  points: IChartPointData[],
  cuts: IEqCuts | undefined,
  sampleRate: number | undefined,
): IChartPointData[] => {
  const filters = eqCutFilters(cuts);
  if (filters.length === 0) {
    return points;
  }
  const cut = getCombinedLineData(
    0,
    Object.fromEntries(
      filters.map((filter) => [
        filter.id,
        getDesignedFilterLineData(filter, false, sampleRate),
      ]),
    ),
  );
  return points.map((point, index) => {
    const lowered = point.y + cut[index].y;
    const floor = Math.min(-EQ_GAIN_REACH, point.y);
    // A comparison, not Math.max: past a cut's zero the rounding can leave
    // NaN, which compares false and lands on the floor like the rest.
    return { x: point.x, y: lowered > floor ? lowered : floor };
  });
};

export default withEqCuts;
