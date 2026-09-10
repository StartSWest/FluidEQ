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

import { useMemo } from 'react';
import { IFilter } from 'common/constants';
import { DRIVER_PROFILES, IDriverFilter } from 'common/driver';
import { getCombinedLineData, getFilterLineData } from '../graph/utils';
import {
  IChartLineDataPointsById,
  IChartPointData,
} from '../graph/ChartController';
import { useTranslation } from '../utils/I18nContext';

const WIDTH = 280;
const HEIGHT = 58;
const MIN_HZ = 20;
const MAX_HZ = 20000;

/** The real combined response of a driver layer, on the graph's own sampling. */
const getCurvePoints = (
  filters: readonly IDriverFilter[],
): IChartPointData[] => {
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
  return getCombinedLineData(0, lines).filter(
    (point) => point.x >= MIN_HZ && point.x <= MAX_HZ,
  );
};

/**
 * Half-scale of the preview in dB, measured from the catalogue, not typed.
 *
 * This was a hardcoded 1.5 that outlived two retunings of the profiles. When
 * they were flattened the number stayed, so the deepest curve in the app only
 * ever reached a third of the way up a box labelled ±1.5 dB and every profile
 * drew as the same faint droop through the middle. Deriving it means the
 * deepest profile always touches the top edge and every other one keeps its
 * true size relative to that, which is the comparison the panel exists to make.
 * The label is filled in from the same number, so the zoom is never a secret.
 */
export const DRIVER_CURVE_RANGE_DB =
  Math.ceil(
    DRIVER_PROFILES.reduce(
      (widest, profile) =>
        getCurvePoints(profile.filters).reduce(
          (peak, point) => Math.max(peak, Math.abs(point.y)),
          widest,
        ),
      0.5,
    ) * 10,
  ) / 10;

interface IDriverCurveProps {
  filters: IDriverFilter[];
}

/**
 * What the selected driver correction actually does, drawn to scale.
 *
 * The shape comes from the same biquad magnitude code the main response graph
 * uses, so this is the real combined response of the layer rather than a
 * sketch of it — a list of numbers tells you a filter exists, a curve tells you
 * what it will sound like.
 */
export default function DriverCurve({ filters }: IDriverCurveProps) {
  const { t } = useTranslation();
  const path = useMemo(() => {
    if (filters.length === 0) {
      return '';
    }

    const logMin = Math.log10(MIN_HZ);
    const logSpan = Math.log10(MAX_HZ) - logMin;

    return getCurvePoints(filters)
      .map((point, index) => {
        const x = ((Math.log10(point.x) - logMin) / logSpan) * WIDTH;
        const clamped = Math.max(
          -DRIVER_CURVE_RANGE_DB,
          Math.min(DRIVER_CURVE_RANGE_DB, Number(point.y) || 0),
        );
        const y =
          HEIGHT / 2 - (clamped / DRIVER_CURVE_RANGE_DB) * (HEIGHT / 2 - 4);
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [filters]);

  return (
    <svg
      className="driver-curve"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={t('graph.driverCurve')}
    >
      <defs>
        <linearGradient id="driver-curve-stroke" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#4ff7d8" />
          <stop offset="1" stopColor="#8b5cff" />
        </linearGradient>
      </defs>

      {/* Decade rules, so the eye can place the bump in frequency. */}
      {[100, 1000, 10000].map((hz) => {
        const x =
          ((Math.log10(hz) - Math.log10(MIN_HZ)) /
            (Math.log10(MAX_HZ) - Math.log10(MIN_HZ))) *
          WIDTH;
        return (
          <path
            key={hz}
            className="driver-curve__grid"
            d={`M${x} 0 L${x} ${HEIGHT}`}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      <path
        className="driver-curve__zero"
        d={`M0 ${HEIGHT / 2} L${WIDTH} ${HEIGHT / 2}`}
        vectorEffect="non-scaling-stroke"
      />
      {path && (
        <path
          className="driver-curve__line"
          d={path}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
