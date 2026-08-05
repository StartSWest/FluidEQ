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
  Projected,
  createGraphAccent,
  createGraphShape,
} from 'common/graphStyles';
import { useGraphLook } from 'renderer/utils/graphStyle';
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
  // Only the live trace has a style; every other curve is the user's own
  // tuning and has one right way to be drawn.
  const look = useGraphLook();
  const lookRef = useRef(look);
  lookRef.current = look;

  const easedRef = useRef<IChartPointData[]>([]);
  // The two halves of the peak glow. Always mounted for the live trace, empty
  // when nothing is loud enough — a path with no `d` costs nothing, and never
  // creating or destroying them keeps the promise the rest of this file makes
  // about the element count not moving.
  const haloRef = useRef<SVGPathElement>(null);
  const coreRef = useRef<SVGPathElement>(null);
  // Reused, so a frame projects into the same array rather than minting one.
  const projectedRef = useRef<Projected[]>([]);
  // The pixel row the filled styles stand on — the bottom of the plot, taken
  // from the scale itself so it follows a resize without being told.
  const baselineRef = useRef(0);
  const range = yScale.range?.();
  baselineRef.current = range ? Math.max(range[0], range[1]) : 0;
  const drawFrame = useCallback(
    (deltaMs: number) => {
      const eased = easedRef.current;
      // Each form moves in its own way — see the ballistics table for why a
      // bar snaps and a ridge does not. On a look the user has tuned these are
      // their numbers instead, which is the setting that changes a form's
      // character most and the reason the panel leads with them.
      const { tuning } = lookRef.current;
      const rise = getEaseFactor(deltaMs, tuning.attackMs);
      const fall = getEaseFactor(deltaMs, tuning.releaseMs);
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
      // Projected into pixels first: the axes are logarithmic in frequency and
      // decibel in level, so building bars or steps in data space and scaling
      // afterwards would put every edge in the wrong place.
      const projected = projectedRef.current;
      if (projected.length !== eased.length) {
        projectedRef.current = eased.map(() => [0, 0] as unknown as Projected);
      }
      const target = projectedRef.current as unknown as [number, number][];
      for (let index = 0; index < eased.length; index += 1) {
        target[index][0] = Number(xScale(eased[index].x)) || 0;
        target[index][1] = Number(yScale(eased[index].y)) || 0;
      }

      const chosen = lookRef.current.style;
      ref.current?.setAttribute(
        'd',
        // d3's own generator for the plain line: it is the one form where the
        // scales do the work, and going through the projection would only
        // round the same numbers twice.
        chosen === 'line'
          ? (line(eased) ?? '')
          : createGraphShape(
              target,
              chosen,
              baselineRef.current,
              tuning.columns,
            ),
      );
      // The lit peaks. Same frame, same numbers, written to two more paths
      // that are stroked faint-and-thick under bright-and-thin — a glow made
      // of strokes rather than of a filter, because a filter over geometry
      // that changes every frame re-rasterises its whole region every frame.
      //
      // The same column count as the figure, or the beads sit between the
      // stems they are marking rather than on them.
      const accent = tuning.accents
        ? createGraphAccent(target, chosen, baselineRef.current, tuning.columns)
        : '';
      haloRef.current?.setAttribute('d', accent);
      coreRef.current?.setAttribute('d', accent);
      return moving;
    },
    [data, line, xScale, yScale],
  );

  const kickFrames = useSmoothFrames(drawFrame, { isEnabled: Boolean(smooth) });

  // Only the live trace can be painted; every other curve is a line and the
  // style setting has nothing to say about it.
  const isLive = Boolean(smooth);
  const isPainted = isLive && look.tuning.filled;
  // Likewise the width: the EQ response, the voicing layer and the rest are the
  // user's own tuning drawn at the weight the chart chose for them, and only
  // the audio trace has a look attached that can say otherwise.
  const liveStrokeWidth = isLive ? look.tuning.strokeWidth : strokeWidth;
  // The rainbow palette paints from the full-spectrum gradient in the chart's
  // defs — deliberately not the EQ one, which only carries a stop per band and
  // so covers whatever slice of the axis the user's bands happen to occupy.
  // The style's palette paints the live trace; every other curve keeps the
  // colour its legend names it by. A rainbow across all five made the legend a
  // lie and left nothing to tell the layers apart.
  const paint =
    look.palette === 'rainbow' && smooth ? 'url(#chart-live-rainbow)' : color;

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
    // `look` is in here so that changing it redraws.
    //
    // The frame loop stops once the curve has settled, which through a pause or
    // a silent passage is immediately — and then nothing would repaint until
    // the audio moved again. Cycling styles that way looked like the setting
    // had not taken, and in the designer, where every slider is judged by what
    // the figure does, it would make the whole panel appear dead.
  }, [data, kickFrames, look, smooth]);

  return (
    <>
      {glow && gradientId && (
        <path
          name={`${name} glow`}
          className={smooth ? 'chart-live-trace' : undefined}
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
      {/* One element for every style. A filled style paints this same path
          rather than stroking it — which is a fill colour, not a second
          element, so cycling styles never creates or destroys anything. */}
      <path
        name={name}
        ref={ref}
        // `chart-live-trace` carries the transition between the trace's
        // supporting strength and its full one — see GraphTheme. Only the live
        // curve gets it: every other curve here is redrawn when a band moves,
        // and an opacity easing over that would smear one edit into the next.
        className={[
          // The rainbow belongs to the live trace alone.
          //
          // A style's palette describes how the *output* is drawn, and the
          // other curves here are not the output — they are the layers that
          // made it, and each is named by a legend in its own colour. Painting
          // them all rainbow made the legend a lie and the graph unreadable:
          // five curves, one palette, nothing to tell them apart.
          //
          // 'smooth' is what marks the live curve — it is the only one eased
          // between frames rather than redrawn on an edit — so it is the same
          // test the trace transition already uses.
          look.palette === 'rainbow' && smooth ? 'is-rainbow' : '',
          smooth ? 'chart-live-trace' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        stroke={isPainted ? 'none' : paint}
        strokeWidth={liveStrokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={isPainted ? paint : 'none'}
        fillOpacity={isPainted ? look.tuning.fillOpacity : undefined}
        opacity={0}
        transform={transform}
      />
      {/* Lit tips.

          Only the peaks, and only on the live trace — the point is that the
          loudest few bands in the current frame catch the light while the rest
          of the figure stays as it was. Two passes: a wide, faint one for the
          halo and a narrow, bright one for the core. That is a bloom done with
          stroke widths, which the compositor handles for free, rather than
          with a blur filter, which would re-rasterise this region sixty times
          a second for the same effect. */}
      {smooth && (
        <>
          <path
            ref={haloRef}
            name={`${name} peaks halo`}
            className="graph-peak-halo"
            stroke={paint}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={paint}
            opacity={0.28}
            clipPath="url(#chart-clip-path)"
            pointerEvents="none"
            transform={transform}
          />
          <path
            ref={coreRef}
            name={`${name} peaks`}
            className="graph-peak-core"
            stroke="white"
            strokeWidth={1}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="white"
            opacity={0.92}
            clipPath="url(#chart-clip-path)"
            pointerEvents="none"
            transform={transform}
          />
        </>
      )}
    </>
  );
};

export default Line;
