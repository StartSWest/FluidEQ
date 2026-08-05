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
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useIsFirstRender } from 'renderer/utils/utils';
import { useSmoothFrames } from 'renderer/utils/useSmoothFrames';
import { getEaseFactor } from 'common/smoothing';
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

/**
 * How long the distance to the newest measurement takes to halve.
 *
 * Slower than the titlebar meter, because the graph is a shape people read
 * rather than a level they glance at — a considered glide suits it where on a
 * meter the same easing would look like lag.
 */
const LIVE_CURVE_HALF_LIFE_MS = 70;

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
   * Ease this curve between measurements instead of stepping to each one.
   *
   * Only meaningful for a trace driven by live audio; a curve that changes
   * when a band is dragged has nothing to interpolate between.
   */
  smooth?: boolean;
  transform?: string;
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
  smooth = false,
  transform,
}: ILineProps) => {
  const ref = useRef<SVGPathElement>(null);
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
      .attr('opacity', 1)
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(INIT_ANIMATE_DURATION)
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', 0);
  }, []);

  const animateFadeIn = useCallback(() => {
    d3.select(ref.current)
      .transition()
      .duration(INIT_ANIMATE_DURATION)
      .ease(d3.easeLinear)
      .attr('opacity', 1);
  }, []);

  const noneAnimation = useCallback(() => {
    d3.select(ref.current).attr('opacity', 1);
  }, []);

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
      .attr('opacity', 1);

    if (animation === AnimationOptionsEnum.NONE) {
      // A trace that is replaced faster than a transition lasts, so d3's
      // easing is the wrong tool — it would interpolate every coordinate on
      // every tick and still never arrive.
      //
      // When `smooth` is set, the animation frames below own this path
      // instead: they ease it toward each new measurement at display rate,
      // which is the only way a shape that updates twenty-two times a second
      // reads as continuous. Writing `d` here as well would stamp the raw
      // measurement over the eased one on every re-render, which is exactly
      // the stepping being removed.
      if (!smooth) {
        path.attr('d', d);
      }
      return;
    }

    path.transition().duration(GRAPH_ANIMATE_DURATION).attr('d', d);
  }, [animation, d, isFirstRender, smooth]);

  // Ease toward each new measurement, between measurements.
  //
  // Only for the live trace, which is the one curve here fed by audio rather
  // than by the user's own bands — everything else changes when something is
  // dragged and has nothing to interpolate between.
  //
  // The points are eased rather than the path string, because a path is text
  // and text cannot be interpolated; the shape has to be rebuilt from numbers
  // that moved. Two buffers, reused, so a frame allocates nothing.
  const easedRef = useRef<IChartPointData[]>([]);
  const drawFrame = useCallback(
    (deltaMs: number) => {
      const eased = easedRef.current;
      const factor = getEaseFactor(deltaMs, LIVE_CURVE_HALF_LIFE_MS);
      let moving = false;
      for (let index = 0; index < eased.length; index += 1) {
        const distance = data[index].y - eased[index].y;
        if (distance > 0.001 || distance < -0.001) {
          eased[index].y += distance * factor;
          moving = true;
        } else {
          eased[index].y = data[index].y;
        }
      }
      ref.current?.setAttribute('d', line(eased) ?? '');
      return moving;
    },
    [data, line],
  );

  const kickFrames = useSmoothFrames(drawFrame, { isEnabled: Boolean(smooth) });

  useEffect(() => {
    if (!smooth) {
      return;
    }
    if (easedRef.current.length !== data.length) {
      // First measurement, or the analyser changed size. The curve arrives
      // whole rather than growing out of a flat line.
      easedRef.current = data.map((point) => ({ ...point }));
    }
    kickFrames();
  }, [data, kickFrames, smooth]);

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
        transform={transform}
      />
    </>
  );
};

export default Line;
