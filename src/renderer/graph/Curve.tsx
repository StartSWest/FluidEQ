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
  const { name, line, controlPoint } = data;

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
        // Every curve that reaches here is the user's own tuning, so every one
        // of them is drawn on. The live trace used to arrive here too and had to
        // opt out of that animation; it is a canvas now and never comes this
        // way, so there is no longer a second answer to give.
        animation={LineAnimationOptionsEnum.LEFT}
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

// Every curve is reconciled whenever the chart re-renders, and one dragged band
// re-renders the chart. The other curves keep their object identity across that,
// so memoising skips their whole subtree and only the one that actually changed
// is walked — which matters most during a drag, where the chart re-renders as
// fast as the pointer moves.
export default memo(Curve);
