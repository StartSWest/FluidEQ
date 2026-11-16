/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import { useRef } from 'react';
import type { AxisScale, NumberValue } from 'd3';
import { useSmartEqMeasurement } from '../audio/smartEqMeasurement';
import {
  getPresenceLine,
  presenceAllowance,
  usePresenceLines,
} from '../utils/presenceThreshold';
import { useSmartEqMode } from '../utils/smartEqMode';

/**
 * Red at nothing earned, green at everything, blended in between: how much
 * boost a range has earned right now, by the presence gate. Mixed here rather
 * than in CSS because it varies per range and per frame.
 */
const PRESENCE_TINT_LOW = [255, 90, 110];
const PRESENCE_TINT_HIGH = [84, 255, 138];

const presenceTint = (allowance: number): string => {
  const t = Math.max(0, Math.min(1, allowance));
  const channel = (index: number) =>
    Math.round(
      PRESENCE_TINT_LOW[index] +
        (PRESENCE_TINT_HIGH[index] - PRESENCE_TINT_LOW[index]) * t,
    );
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
};

/**
 * What Smart EQ has heard of each range so far, as one thin bar per range
 * along the plot's foot, filling left to right, tinted by how much boost the
 * range is earning. That is the whole of why a correction has not landed yet.
 *
 * The listening bands drawn over the plot - a shaded column per range, its
 * two presence lines to drag and the correction limit's pair of rules - and
 * the switches that showed and hid them are gone (Ivan, 2026-11-16: "we don't
 * have listening bands, so remove everything related to that in the menu and
 * the UI"). Smart EQ keeps its lines and its limit where they are set; only
 * the drawing of them over the music went.
 *
 * Its own component because the regions arrive with the analyser frames: down
 * here the subscription costs one component, where a prop threaded through
 * the chart woke all of it at frame rate. Nothing while the curves are off,
 * and faded rather than snatched away when the music stops, the last ranges
 * held while the group fades (in a ref, so the retained copy is never a
 * second reason to render).
 */
const CoverageOverlay = ({
  xScale,
  top,
  plotHeight,
  isResponseHidden,
}: {
  xScale: AxisScale<NumberValue>;
  top: number;
  plotHeight: number;
  /** No response layers are being presented, so the bars wait too. */
  isResponseHidden: boolean;
}) => {
  // What Smart EQ is hearing of the source, published by the measurement
  // itself rather than by the loopback the graph draws (`smartEqMeasurement`).
  const {
    progress: balanceProgress,
    presenceLevels,
    presenceTypical,
  } = useSmartEqMeasurement();
  const coverage = balanceProgress?.regions;
  // The tint reads the presence lines, which one store holds per mode.
  usePresenceLines();
  useSmartEqMode();
  const lastCoverage = useRef<typeof coverage>(undefined);

  const isGone = isResponseHidden || !coverage?.length;
  if (coverage?.length) {
    lastCoverage.current = coverage;
  }
  const shown = coverage?.length ? coverage : lastCoverage.current;
  if (!shown?.length || plotHeight <= top) {
    return null;
  }
  return (
    <g
      className={`chart-coverage${isGone ? ' is-leaving' : ''}`}
      pointerEvents="none"
    >
      {shown.map((region, index) => {
        const left = Number(xScale(region.lowFrequency));
        const right = Number(xScale(region.highFrequency));
        const width = Math.max(0, right - left - 2);
        const centre = Math.sqrt(region.lowFrequency * region.highFrequency);
        // The fast copies first, so the tint follows the music frame by frame.
        const typicalDb = presenceTypical?.[index] ?? region.typicalDb;
        const floorDb = getPresenceLine(
          'floor',
          region.label,
          centre,
          typicalDb,
        );
        const fullDb = getPresenceLine('full', region.label, centre, typicalDb);
        const liveDb = presenceLevels?.[index] ?? region.liveDb;
        const allowance = presenceAllowance(liveDb, floorDb, fullDb);
        return (
          <g key={region.label}>
            <rect
              className="chart-coverage__track"
              x={left + 1}
              y={plotHeight - 6}
              width={width}
              height={4}
              rx={2}
            />
            <rect
              className={`chart-coverage__fill${
                region.isCovered ? ' is-covered' : ''
              }`}
              x={left + 1}
              y={plotHeight - 6}
              width={width * Math.min(1, region.confidence)}
              height={4}
              rx={2}
              fill={region.isCovered ? undefined : presenceTint(allowance)}
            />
          </g>
        );
      })}
    </g>
  );
};

export default CoverageOverlay;
