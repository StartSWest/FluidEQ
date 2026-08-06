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

/**
 * One curve of the EQ, as a path.
 *
 * Every curve here is the user's own tuning — the response being edited, the
 * voicing, the driver, a measured correction, their sum — so each changes when
 * something is dragged and is otherwise still. That is what makes SVG the right
 * renderer for them: a handful of writes per edit, and the hit-testing and the
 * animations come free with the DOM.
 *
 * The live output trace is deliberately not one of these. It is replaced
 * between twenty-two and sixty times a second and is drawn on a canvas instead;
 * see `LiveTraceCanvas`, which is where the styles, the glow and the
 * orientations went with it.
 */

import * as d3 from 'd3';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useIsFirstRender } from 'renderer/utils/utils';
import {
  GRAPH_ANIMATE_DURATION,
  IChartPointData,
  INIT_ANIMATE_DURATION,
} from './ChartController';

export enum AnimationOptionsEnum {
  LEFT = 'left',
  FADE_IN = 'fadeIn',
  NONE = 'none',
}

interface ILineProps {
  name: string;
  xScale: d3.AxisScale<d3.NumberValue>;
  yScale: d3.AxisScale<d3.NumberValue>;
  color: string;
  strokeWidth: number;
  data: IChartPointData[];
  gradientId?: string;
  glow?: boolean;
  animation?: AnimationOptionsEnum;
  /**
   * How present this curve is.
   *
   * The response the user is actually editing is the subject; the layers under
   * it — voicing, driver, a measured correction, the live output — are context
   * for reading it. Drawing them all at full strength turns the graph into a
   * tangle where nothing is obviously the answer.
   */
  opacity?: number;
}

const Line = ({
  name,
  xScale,
  yScale,
  color = 'white',
  strokeWidth = 3,
  data = [],
  gradientId,
  glow = false,
  animation = AnimationOptionsEnum.NONE,
  opacity = 1,
}: ILineProps) => {
  const ref = useRef<SVGPathElement>(null);

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

  const line = useMemo(
    () =>
      d3
        .line<IChartPointData>()
        .x(({ x }) => xScale(x) || 0)
        .y(({ y }) => yScale(y) || 0),
    [xScale, yScale],
  );

  const d = useMemo(() => line(data), [data, line]);

  // Define different types of animation that we can use
  const animateLeft = useCallback(() => {
    const totalLength = ref.current ? ref.current.getTotalLength() : 100;
    d3.select(ref.current)
      .attr('opacity', opacity)
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(INIT_ANIMATE_DURATION)
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', 0);
  }, [opacity]);

  const animateFadeIn = useCallback(() => {
    d3.select(ref.current)
      .transition()
      .duration(INIT_ANIMATE_DURATION)
      .ease(d3.easeLinear)
      .attr('opacity', opacity);
  }, [opacity]);

  const noneAnimation = useCallback(() => {
    d3.select(ref.current).attr('opacity', opacity);
  }, [opacity]);

  // Set initial path attribute
  const initRender = useCallback(() => {
    d3.select(ref.current)
      .attr('d', d)
      .attr('clip-path', 'url(#chart-clip-path)');
  }, [d]);

  // Handle animation for the initial render
  useEffect(() => {
    if (isFirstRender) {
      initRender();
      switch (animation) {
        case AnimationOptionsEnum.LEFT:
          animateLeft();
          break;
        case AnimationOptionsEnum.FADE_IN:
          animateFadeIn();
          break;
        case AnimationOptionsEnum.NONE:
        default:
          noneAnimation();
          break;
      }
    }
  }, [
    animateLeft,
    animateFadeIn,
    noneAnimation,
    animation,
    isFirstRender,
    initRender,
  ]);

  // Handle animation for subsequent renders
  useEffect(() => {
    if (!ref.current || isFirstRender) {
      return;
    }
    const path = d3
      .select(ref.current)
      // Make sure initial animation is overwritten
      .attr('stroke-dasharray', null)
      .attr('stroke-offset', null)
      .attr('opacity', opacity);

    if (animation === AnimationOptionsEnum.NONE) {
      path.attr('d', d);
      return;
    }

    path.transition().duration(GRAPH_ANIMATE_DURATION).attr('d', d);
  }, [animation, d, isFirstRender, opacity]);

  return (
    <>
      {glow && gradientId && (
        <path
          name={`${name} glow`}
          d={d || undefined}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth + 7}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.42}
          filter="url(#chart-eq-neon-glow)"
          clipPath="url(#chart-clip-path)"
          pointerEvents="none"
          transform="translate(0 3)"
        />
      )}
      <path
        name={name}
        ref={ref}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0}
      />
    </>
  );
};

export default Line;
