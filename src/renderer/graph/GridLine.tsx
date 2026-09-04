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
import { useEffect, useRef } from 'react';
import { useIsFirstRender } from 'renderer/utils/utils';
import {
  GRAPH_ANIMATE_DURATION,
  INIT_ANIMATE_DURATION,
} from './ChartController';

interface IGridLineProps {
  type: 'vertical' | 'horizontal';
  scale: d3.AxisScale<d3.NumberValue>;
  tickValues: number[];
  size: number;
  transform?: string;
  color?: string;
  disableAnimation?: boolean;
}

const GridLine = ({
  type,
  scale,
  tickValues,
  size,
  transform,
  // Faint by default. A grid is a reference, not a subject — it exists so
  // the eye can place a curve, and the moment it competes with one it is
  // doing the opposite of its job.
  // The mist at the same alpha as the EQ face's major ticks, so the graph's
  // paper and the sliders' paper are ruled in one ink. See `$edge-tint`.
  color = 'rgba(214, 233, 247, 0.12)',
  disableAnimation,
}: IGridLineProps) => {
  const ref = useRef<SVGGElement>(null);

  // Stop any animation still in flight when this leaves the graph.
  //
  // A d3 transition is driven by a timer that holds the node it is animating,
  // so a band deleted mid-animation stays alive — along with its data and its
  // interpolators — until the transition would have finished. One is
  // negligible; a session of adding, deleting and dragging bands is not, and
  // nothing about it is visible while it accumulates.
  useEffect(
    () => () => {
      if (ref.current) {
        d3.select(ref.current).interrupt();
      }
    },
    [],
  );
  const isFirstRender = useIsFirstRender();

  useEffect(() => {
    const axisGenerator = type === 'vertical' ? d3.axisBottom : d3.axisLeft;
    const axis = axisGenerator(scale).tickValues(tickValues).tickSize(-size);

    if (ref.current) {
      const gridGroup = d3.select(ref.current);
      if (disableAnimation) {
        gridGroup.call(axis);
      } else {
        const duration = isFirstRender
          ? INIT_ANIMATE_DURATION
          : GRAPH_ANIMATE_DURATION;
        gridGroup
          .transition()
          .duration(duration)
          .ease(d3.easeLinear)
          .call(axis);
      }
      gridGroup.select('.domain').remove();
      gridGroup.selectAll('text').remove();
      gridGroup.selectAll('line').attr('stroke', color);
    }
  }, [scale, tickValues, size, disableAnimation, type, color, isFirstRender]);

  return <g ref={ref} transform={transform} />;
};

export default GridLine;
