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
import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { useIsFirstRender } from 'renderer/utils/utils';
import { useSmoothFrames } from 'renderer/utils/useSmoothFrames';
import { getEaseFactor } from 'common/smoothing';
import {
  Projected,
  createGraphAccent,
  createGraphShape,
  getGlowStyle,
} from 'common/graphStyles';
import { useGraphLook } from 'renderer/utils/graphStyle';
import {
  GRAPH_ANIMATE_DURATION,
  IChartPointData,
  INIT_ANIMATE_DURATION,
} from './ChartController';

/**
 * The euphoria halo: one wide, faint copy of the figure behind itself.
 *
 * Three approaches were tried and two are recorded here so nobody spends an
 * afternoon rediscovering them.
 *
 * A *stack* of three widening strokes gives a proper falloff and is what light
 * actually looks like — and costs three tessellations of a figure that, on the
 * ornate forms, is hundreds of pieces, doubled again when a mirrored mode puts
 * a second live trace on the chart. Unaffordable.
 *
 * A cheap decimated *outline* fixes the cost and stops being light: it does not
 * follow the figure's geometry, so it reads as a second stray wave wandering
 * across the first.
 *
 * Swelling the trace itself is cheapest of all and is the wrong tool, because
 * it can only reach settings the look owns. A filled form has no stroke to
 * thicken; a look tuned to a light fill had that fill overridden to get the
 * effect. The mode ended up editing the drawing rather than lighting it.
 *
 * So: one pass, of the real figure, gated on the mode actually being on. A
 * single edge rather than a falloff is the compromise the budget buys, and
 * being the true shape in the true colour is worth more than the gradient.
 */
// Two passes, widest and faintest underneath, which is what turns a hard edge
// into a falloff. Affordable only because the halo is stroked from a silhouette
// rather than the figure — see `getGlowStyle`.
const GLOW_LAYERS = [
  { widen: 17, opacity: 0.1 },
  { widen: 7, opacity: 0.16 },
];
const GLOW_FLOOR = 0.3;
const GLOW_REACH = 2.4;
const GLOW_WIDTH_FLOOR = 0.45;
const GLOW_WIDTH_REACH = 1.1;

/**
 * How the halo answers the music.
 *
 * Deliberately lopsided, and that is the whole difference between a glow that
 * pumps and one that merely wobbles: it snaps to a hit almost instantly and
 * sags back over a quarter of a second, so a kick throws light out and the
 * light then falls away on its own. Matched attack and release would breathe
 * in and out symmetrically, which reads as a pulsing lamp rather than as
 * something being struck.
 *
 * The floor is what stops it dying between beats — at nothing at all the glow
 * would blink out completely in every gap, which flickers rather than pumps.
 */
const GLOW_ATTACK_MS = 4;
const GLOW_RELEASE_MS = 260;

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
  // The plot's depth, so the frame loop can say how full the figure is as a
  // fraction rather than in pixels — which is what keeps the pump reading the
  // same on a short card and a full-screen one.
  const plotHeightRef = useRef(1);
  plotHeightRef.current = range
    ? Math.max(1, Math.abs(range[0] - range[1]))
    : 1;
  // The halo's layers, always mounted for the live trace so the element count
  // never moves, and empty until there is a silhouette to echo.
  const glowRefs = useRef<(SVGPathElement | null)[]>([]);
  // How hard the halo is being driven, carried between frames.
  const pumpRef = useRef(0);
  // Whether the halo currently holds a figure, so it is emptied exactly once
  // when the mode goes out rather than on every frame afterwards.
  const glowWasLitRef = useRef(false);
  // The trace's own weight, which the halo is measured out from.
  const strokeWidthRef = useRef(strokeWidth);
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
      // d3's own generator for the plain line: it is the one form where the
      // scales do the work, and going through the projection would only round
      // the same numbers twice.
      const shape =
        chosen === 'line'
          ? (line(eased) ?? '')
          : createGraphShape(
              target,
              chosen,
              baselineRef.current,
              tuning.columns,
            );
      ref.current?.setAttribute('d', shape);

      // Nothing at all unless the light is going to be seen.
      //
      // Read off the root class rather than subscribed to: that class is
      // already the single source of truth for the mode, `contains` is a token
      // lookup with no style recalculation behind it, and it keeps this
      // component out of the euphoria store entirely.
      const wantsGlow =
        tuning.glow > 0 &&
        document.documentElement.classList.contains('is-euphoric');

      if (wantsGlow) {
        // How much of the plot the figure is filling, which is the loudness the
        // halo answers to. Read from the points already projected for the
        // drawing rather than measured again, so it is one pass over an array
        // that is still in cache.
        let filled = 0;
        for (let index = 0; index < target.length; index += 1) {
          filled += baselineRef.current - target[index][1];
        }
        const energy = Math.max(
          0,
          Math.min(1, filled / (target.length * plotHeightRef.current)),
        );
        // Snap up, sag back. See the ballistics above for why the two differ by
        // two orders of magnitude.
        const gap = energy - pumpRef.current;
        pumpRef.current +=
          gap *
          getEaseFactor(deltaMs, gap > 0 ? GLOW_ATTACK_MS : GLOW_RELEASE_MS);
        // Still settling counts as motion, or the loop would stop with the glow
        // halfway down and leave it stuck there until the next measurement.
        if (gap > 0.002 || gap < -0.002) {
          moving = true;
        }

        // The silhouette light comes off, which for most forms is not the form
        // — see `getGlowStyle`. Reused rather than rebuilt when the two are the
        // same shape, which is the common case for the simple forms.
        const glowStyle = getGlowStyle(chosen, shape.length);
        const halo =
          glowStyle === chosen
            ? shape
            : createGraphShape(
                target,
                glowStyle,
                baselineRef.current,
                tuning.columns,
              );

        const pump = pumpRef.current;
        const lit = (GLOW_FLOOR + pump * GLOW_REACH) * tuning.glow;
        const swell = GLOW_WIDTH_FLOOR + pump * GLOW_WIDTH_REACH;
        for (let layer = 0; layer < glowRefs.current.length; layer += 1) {
          const element = glowRefs.current[layer];
          if (element) {
            element.setAttribute('d', halo);
            element.setAttribute(
              'opacity',
              (GLOW_LAYERS[layer].opacity * lit).toFixed(3),
            );
            element.setAttribute(
              'stroke-width',
              (
                strokeWidthRef.current +
                GLOW_LAYERS[layer].widen * swell
              ).toFixed(1),
            );
          }
        }
        glowWasLitRef.current = true;
      } else if (glowWasLitRef.current) {
        // Emptied once on the way out, so the last figure is not left parked in
        // the halo waiting to flash back the moment the mode returns.
        for (let layer = 0; layer < glowRefs.current.length; layer += 1) {
          glowRefs.current[layer]?.setAttribute('d', '');
        }
        pumpRef.current = 0;
        glowWasLitRef.current = false;
      }
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
  strokeWidthRef.current = liveStrokeWidth;
  // The look's own gradient, when it has colours of its own.
  //
  // `useId` is per instance, so two charts on screen cannot collide — but React
  // puts colons in it and `url(#:r0:)` is not a selector any browser will
  // parse, so they come out again.
  const instanceId = useId().replace(/:/g, '');
  const lookGradientId = `look-gradient-${instanceId}`;

  // The plot's own edges, taken from the scales rather than from the props, so
  // the gradient follows a resize without being told.
  const xRange = xScale.range?.();
  const yRange = yScale.range?.();
  const plotLeft = xRange ? Math.min(xRange[0], xRange[1]) : 0;
  const plotRight = xRange ? Math.max(xRange[0], xRange[1]) : 0;
  const plotTop = yRange ? Math.min(yRange[0], yRange[1]) : 0;
  const plotBottom = yRange ? Math.max(yRange[0], yRange[1]) : 0;

  // One colour is a flat fill whatever the palette is called, and no colours at
  // all means "the ones already on screen" — neither needs a gradient built.
  const hasOwnGradient =
    isLive && look.palette !== 'signal' && look.colours.length > 1;

  const gradientStops = useMemo(
    () =>
      look.colours.map((colour, index) => ({
        colour,
        // Evenly spaced. Offsets are unique, which is what makes them usable as
        // keys where the colours themselves are not — the same colour twice is
        // a perfectly reasonable ramp.
        offset: index / Math.max(1, look.colours.length - 1),
      })),
    [look.colours],
  );

  // The style's palette paints the live trace; every other curve keeps the
  // colour its legend names it by. A rainbow across all five made the legend a
  // lie and left nothing to tell the layers apart.
  //
  // Without colours of its own a look paints exactly as it always has: the
  // full-spectrum gradient in the chart's defs for rainbow — deliberately not
  // the EQ one, which only carries a stop per band and so covers whatever slice
  // of the axis the user's bands happen to occupy — and the curve's own colour
  // for signal.
  // Whether the look carries a colour scheme of its own, which is what decides
  // if euphoria may recolour it. Rainbow counts even with no stops of its own:
  // its colours are the chart's shared spectrum gradient.
  const isSelfColoured =
    isLive && (look.colours.length > 0 || look.palette === 'rainbow');
  const [firstColour] = look.colours;
  let paint = color;
  if (isLive) {
    if (hasOwnGradient) {
      paint = `url(#${lookGradientId})`;
    } else if (firstColour) {
      // One stop, or a flat palette that has somehow been handed several. The
      // first is the answer either way — falling through to the curve's own
      // colour would silently discard a colour somebody chose.
      paint = firstColour;
    } else if (look.palette === 'rainbow') {
      paint = 'url(#chart-live-rainbow)';
    }
  }

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
      {/* Pinned to the plot, not to the figure.

          `userSpaceOnUse` against the scales' own ranges rather than the SVG
          default, which is the path's bounding box — and that default is what
          would make the level palette meaningless. Stretched to fit whatever
          shape the current frame happens to be, the top of the tallest bar
          would be fully red whether it was deafening or barely off the floor,
          and the colour would say "the loudest thing on screen right now"
          instead of "this many decibels". Against the axis, a level is a
          colour and stays that colour.

          Level runs up the decibel axis: first stop on the floor, last at the
          ceiling. Rainbow runs along the frequency axis, left to right. */}
      {hasOwnGradient && (
        <defs>
          <linearGradient
            id={lookGradientId}
            gradientUnits="userSpaceOnUse"
            x1={look.palette === 'level' ? 0 : plotLeft}
            x2={look.palette === 'level' ? 0 : plotRight}
            y1={look.palette === 'level' ? plotBottom : 0}
            y2={look.palette === 'level' ? plotTop : 0}
          >
            {gradientStops.map((stop) => (
              <stop
                key={stop.offset}
                offset={`${(stop.offset * 100).toFixed(1)}%`}
                stopColor={stop.colour}
              />
            ))}
          </linearGradient>
        </defs>
      )}
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
      {/* The halo, behind the figure it echoes.

          Stroked with the trace's own `paint`, which is the point: for a
          gradient look that is the very same gradient, so the glow round a
          spectrum is a spectrum and the glow round a level ramp reddens with
          it, without anything here having to know which.

          `d`, width and opacity are all written by the frame loop and none of
          them appear below — this component re-renders on every measurement,
          and a value set in JSX would stamp the resting one back over the live
          one twenty-two times a second. */}
      {smooth &&
        GLOW_LAYERS.map((layer, index) => (
          <path
            key={layer.widen}
            ref={(element) => {
              glowRefs.current[index] = element;
            }}
            name={`${name} halo ${layer.widen}`}
            // Carries the trace's own opt-out, and must: euphoria's rule matches
            // on the name prefix, so without it the sweep recolours the halo
            // while the figure keeps its gradient — a spectrum haloed in one
            // travelling hue. Sharing the flag keeps the two in step whichever
            // way it falls.
            className={`chart-live-glow${
              isSelfColoured ? ' is-self-coloured' : ''
            }`}
            stroke={paint}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            clipPath="url(#chart-clip-path)"
            pointerEvents="none"
            transform={transform}
          />
        ))}
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
          // Hands off — this trace already has colours of its own.
          //
          // Euphoria recolours the live trace with a travelling hue, which is
          // right for a look that is simply "the curve, in the curve's colour"
          // and wrong for every look that says something with its colour. A
          // spectrum ramp across the frequency axis and a level ramp up the
          // decibel axis are both *readings*, and overwriting them with a sweep
          // throws the reading away and leaves the setting looking broken.
          //
          // Tested on the colours rather than on the palette's name, so a flat
          // look somebody has deliberately coloured is covered too.
          isSelfColoured ? 'is-self-coloured' : '',
          // The look's own cycling outline, which euphoria draws on the figure
          // rather than round the card. Stroked even on a filled form, so the
          // fill keeps the look's colours and only the edge runs the hue.
          isLive && look.tuning.border ? 'has-euphoria-outline' : '',
          smooth ? 'chart-live-trace' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        // A filled form normally has no stroke at all. It gets one when the
        // look asks for the cycling outline, or there would be nothing for the
        // hue to run along — the colour comes from the stylesheet, so what is
        // set here only has to be something other than `none`.
        stroke={isPainted && !look.tuning.border ? 'none' : paint}
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
