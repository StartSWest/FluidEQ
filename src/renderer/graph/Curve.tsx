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

import * as d3 from 'd3';
import { memo } from 'react';
import { SecondaryColorEnum } from 'renderer/styles/color';
import { IChartCurveData } from './ChartController';
import Line, { AnimationOptionsEnum as LineAnimationOptionsEnum } from './Line';
import Point, {
  AnimationOptionsEnum as PointAnimationOptionsEnum,
} from './Point';

interface ICurveProps {
  xScale: d3.AxisScale<d3.NumberValue>;
  yScale: d3.AxisScale<d3.NumberValue>;
  data: IChartCurveData;
}

const Curve = ({ xScale, yScale, data }: ICurveProps) => {
  const { name, line, controlPoint, isContinuous } = data;

  return (
    <>
      <Line
        name={name}
        data={line.points}
        xScale={xScale}
        yScale={yScale}
        color={line.color}
        strokeWidth={line.strokeWidth}
        gradientId={line.gradientId}
        glow={line.glow}
        opacity={line.opacity}
        animation={
          isContinuous
            ? LineAnimationOptionsEnum.NONE
            : LineAnimationOptionsEnum.LEFT
        }
        // The continuous curve is the live trace, the only one fed by audio
        // rather than by the bands — so it is the only one with anything to
        // interpolate between.
        smooth={isContinuous}
      />
      {controlPoint && (
        <Point
          name={name}
          data={controlPoint}
          xScale={xScale}
          yScale={yScale}
          color={SecondaryColorEnum.DEFAULT}
          radius={4}
          animation={PointAnimationOptionsEnum.FADE_IN}
        />
      )}
    </>
  );
};

// Every curve is reconciled whenever the chart re-renders, which the live
// trace makes happen ~22 times a second. The band curves keep their object
// identity across those frames, so memoising skips their whole subtree and
// only the curve that actually changed is walked.
export default memo(Curve);
