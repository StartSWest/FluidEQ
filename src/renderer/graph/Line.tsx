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
 * Meter ballistics: quick to rise, slow to fall.
 *
 * The first attempt eased both directions at 70ms, which is longer than the
 * 45ms between measurements — so the curve never reached one target before the
 * next arrived and spent its whole life chasing. Smooth, and permanently
 * behind the music.
 *
 * Sound does not behave symmetrically and neither should a display of it. A
 * kick arrives all at once and decays over a beat, so the rise is nearly
 * immediate — most of the way inside a single frame — while the fall is
 * unhurried enough to leave the shape of the note behind it. That difference
 * is the entire reason a spectrum looks like it is being driven by music
 * rather than averaging it.
 */
const LIVE_CURVE_ATTACK_MS = 8;
const LIVE_CURVE_RELEASE_MS = 28;

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
  /**
   * How present this curve is.
   *
   * The response the user is actually editing is the subject; the layers under
   * it — voicing, driver, a measured correction, the live output — are context
   * for reading it. Drawing them all at full strength turns the graph into a
   * tangle where nothing is obviously the answer.
   */
  opacity?: number;
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
  opacity = 1,
  transform,
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
  }, [animation, d, isFirstRender, opacity, smooth]);

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
      const rise = getEaseFactor(deltaMs, LIVE_CURVE_ATTACK_MS);
      const fall = getEaseFactor(deltaMs, LIVE_CURVE_RELEASE_MS);
      let moving = false;
      for (let index = 0; index < eased.length; index += 1) {
        const distance = data[index].y - eased[index].y;
        // In decibels, and a twentieth of one is far below what a pixel on
        // this graph can show. Tighter than this and the loop never settles:
        // something among three hundred points is always drifting, so it
        // would rebuild the path sixty times a second through silence.
        if (distance > 0.05 || distance < -0.05) {
          eased[index].y += distance * (distance > 0 ? rise : fall);
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
