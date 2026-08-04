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

import { useMemo } from 'react';
import { IFilter } from 'common/constants';
import { IDriverFilter } from 'common/driver';
import { getCombinedLineData, getFilterLineData } from '../graph/utils';
import { IChartLineDataPointsById } from '../graph/ChartController';

const WIDTH = 280;
const HEIGHT = 58;
/**
 * Half-scale of the preview in dB.
 *
 * Matched to the largest gain any driver profile uses, so a full-strength
 * filter reaches the top of the box. A wider range would be more "honest"
 * about absolute size but would draw every curve as a flat line, which tells
 * the user nothing — the axis is labelled so the scale is not a secret.
 */
const RANGE_DB = 1.5;
const MIN_HZ = 20;
const MAX_HZ = 20000;

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
  const path = useMemo(() => {
    if (filters.length === 0) {
      return '';
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

    const logMin = Math.log10(MIN_HZ);
    const logSpan = Math.log10(MAX_HZ) - logMin;

    return getCombinedLineData(0, lines)
      .filter((point) => point.x >= MIN_HZ && point.x <= MAX_HZ)
      .map((point, index) => {
        const x = ((Math.log10(point.x) - logMin) / logSpan) * WIDTH;
        const clamped = Math.max(
          -RANGE_DB,
          Math.min(RANGE_DB, Number(point.y) || 0),
        );
        const y = HEIGHT / 2 - (clamped / RANGE_DB) * (HEIGHT / 2 - 4);
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
      aria-label="Frequency response of this driver correction"
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
