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
 * The live spectrum, drawn on a canvas rather than as SVG paths.
 *
 * WHY THIS IS NOT A PATH ANY MORE. The figure is rebuilt between twenty-two and
 * sixty times a second, and the ornate forms are enormous: measured over the
 * same spectrum, `blocks` is a path string of 43,891 characters, `ribs` 32,851,
 * `skyline` 30,796, `matrix` 27,859. Writing one to a `d` attribute is not a
 * cheap assignment — it invalidates style, re-parses the whole string and
 * re-rasterises the region, and every one of those stages runs again on the
 * next measurement. A canvas draw is a resource update: the pixels are replaced
 * and nothing else in the document has an opinion about it.
 *
 * WHAT DID NOT CHANGE. `createGraphShape` still returns SVG path data, all
 * forty-six forms of it, because `new Path2D(d)` takes exactly that string in
 * Chromium. The shape engine, the column logic and the ballistics are untouched
 * — this is a renderer swap, not a redesign, and the geometry was never the
 * problem. Building the string is also still what measures a form's complexity
 * for the glow, which comes free because it has already been built.
 *
 * WHAT STAYS IN SVG. The grid, the axes, the band handles, the marquee. Those
 * are hit-tested and they change when something is dragged rather than when the
 * music moves, so putting them on a canvas would mean reimplementing hit
 * detection to save nothing. The hybrid is the point.
 *
 * The canvas sits BEHIND the chart's SVG. The trace used to be drawn over the
 * grid and under the band handles, which no single layer can be; of the two,
 * the handles matter more — they are controls, and a control that disappears
 * under a moving drawing is worse than a hairline grid crossing a wave.
 *
 * WHY THE POINTS ARE READ HERE RATHER THAN PASSED IN. This is the only thing on
 * the graph that wants a measurement, and it is the last component in the tree,
 * so it is the only one that should be subscribed to them. Handed down as a prop
 * they went through `FrequencyResponseChart` and `Chart` on the way, which
 * re-rendered both of those about twenty-two times a second — the chart for
 * nothing at all, since it does not draw the trace, and every d3 effect under it
 * for a frame it could not use. A renderer that draws outside React should be
 * subscribed outside React's tree as well, and this is as close as a context
 * gets: the component wakes up per frame, and nothing above it does.
 */

import type { AxisScale, NumberValue } from 'd3';
import { useCallback, useEffect, useRef } from 'react';
import { getEaseFactor } from 'common/smoothing';
import {
  createGraphAccent,
  createGraphShape,
  getGlowStyle,
} from 'common/graphStyles';
import { useSmoothFrames } from 'renderer/utils/useSmoothFrames';
import { useGraphLook } from 'renderer/utils/graphStyle';
import { useLiveAudioFrame } from '../audio/LiveAudioContext';
import { IChartPointData, ILiveCurveData } from './ChartController';
import {
  ACCENT_CORE_OPACITY,
  ACCENT_HALO_EUPHORIC_OPACITY,
  ACCENT_HALO_OPACITY,
  IEuphoriaPaint,
  TracePaint,
  getWaveTransform,
  isSelfColouredLook,
  isTraceGradient,
  readEuphoriaHue,
  resolveAccentStroke,
  resolveFigureStroke,
  resolveFigureStrokeWidth,
  resolveGlowStroke,
  resolveTracePaint,
} from './liveTracePaint';

/**
 * The euphoria halo: two wide, faint copies of the figure behind itself.
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
 * Two passes, widest and faintest underneath, which is what turns a hard edge
 * into a falloff. Affordable only because the halo is stroked from a silhouette
 * rather than the figure — see `getGlowStyle`.
 */
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

/**
 * How long the trace takes to come forward, and to go back.
 *
 * Wave only takes the trace from a supporting layer to the subject of the
 * graph: brighter, and a little heavier. Snapping between the two reads as a
 * glitch — the drawing is already moving with the music, so an instant change
 * of weight looks like a frame was dropped rather than like a mode changed.
 *
 * This was a 420ms CSS transition on the path's `opacity` and `stroke-width`.
 * A canvas has no cascade to transition, so the two are eased here instead, at
 * a half-life that arrives in about the same time. It is one of the few pieces
 * of this file that is a reimplementation rather than a move.
 */
const PRESENTATION_SETTLE_MS = 120;

/** Below these the eased presentation values have arrived and are snapped. */
const OPACITY_EPSILON = 0.002;
const STROKE_WIDTH_EPSILON = 0.01;

/** The two passes a lit tip is drawn in: wide and faint, then narrow and hot. */
const ACCENT_HALO_WIDTH = 7;
const ACCENT_CORE_WIDTH = 1;

interface ILiveTraceCanvasProps {
  /**
   * The live curves, in draw order.
   *
   * One ordinarily; two when the wave is mirrored or centred, in which case
   * both are the same measurement drawn a second way and differ only in which
   * way up they are. That is why the easing, the projection and the shape are
   * built once below and drawn once per curve — where the SVG version built the
   * whole figure twice.
   *
   * Configuration only. The measurement itself is read from the frame context
   * below; see the file comment for why it does not come down with these.
   */
  curves: ILiveCurveData[];
  xScale: AxisScale<NumberValue>;
  yScale: AxisScale<NumberValue>;
  /** The chart's own box, which this covers exactly. */
  width: number;
  height: number;
  /** Where that box starts inside the plot, i.e. the chart SVG's margins. */
  offsetLeft: number;
  offsetTop: number;
}

/**
 * Canvas ignores an alpha outside 0..1 and keeps the last one, which is worse
 * than clamping would be: a glow driven past full would silently leave every
 * later stroke at the previous frame's opacity.
 */
const setAlpha = (context: CanvasRenderingContext2D, alpha: number) => {
  context.globalAlpha = Math.max(0, Math.min(1, alpha));
};

/**
 * Hand the context a flat colour, or build the ramp one describes.
 *
 * Built inside the figure's own transform rather than once per frame, because a
 * gradient is painted through the matrix in force when it is used — so a
 * mirrored copy has to be given its own, or the level ramp would run the wrong
 * way up under the wave that is upside down.
 */
const toCanvasPaint = (
  context: CanvasRenderingContext2D,
  paint: TracePaint,
): string | CanvasGradient => {
  if (!isTraceGradient(paint)) {
    return paint;
  }
  const gradient = context.createLinearGradient(
    paint.x1,
    paint.y1,
    paint.x2,
    paint.y2,
  );
  paint.stops.forEach((stop) => {
    gradient.addColorStop(Math.max(0, Math.min(1, stop.offset)), stop.colour);
  });
  return gradient;
};

const LiveTraceCanvas = ({
  curves,
  xScale,
  yScale,
  width,
  height,
  offsetLeft,
  offsetTop,
}: ILiveTraceCanvasProps) => {
  // The measurement, straight from the analyser. This component re-renders with
  // every frame and nothing above it does — which is the entire arrangement.
  const { points } = useLiveAudioFrame();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Held rather than fetched per frame: the computed style is a live object
  // bound to the element, and it goes stale with the context if the canvas is
  // ever replaced, so the two are taken together.
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const computedRef = useRef<CSSStyleDeclaration | null>(null);

  // Only the live trace has a look; every other curve on this chart is the
  // user's own tuning and has one right way to be drawn.
  const look = useGraphLook();
  const lookRef = useRef(look);
  lookRef.current = look;

  // The points, eased toward each new measurement between measurements.
  //
  // The points are eased rather than the drawing, because the shape has to be
  // rebuilt from numbers that moved. Buffers are reused, so a frame allocates
  // nothing but the paths it hands to the rasteriser.
  const easedRef = useRef<IChartPointData[]>([]);
  const projectedRef = useRef<[number, number][]>([]);
  // How hard the halo is being driven, carried between frames.
  const pumpRef = useRef(0);
  // The trace coming forward and going back — see the constant above. Opacity
  // starts at nothing so the first frame fades in rather than appearing.
  const shownOpacityRef = useRef(0);
  const shownStrokeWidthRef = useRef(look.tuning.strokeWidth);

  const drawFrame = useCallback(
    (deltaMs: number) => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (!canvas || !context) {
        return false;
      }
      const data = points;
      const eased = easedRef.current;
      if (data.length < 2 || eased.length !== data.length) {
        return false;
      }

      // The backing store, in device pixels.
      //
      // Sized here rather than in an effect because the ratio is not only a
      // property of the element: dragging the window onto a display with a
      // different scale changes it with nothing to observe. Assigning either
      // dimension clears the canvas and resets the context, which is why the
      // base transform is re-established every frame rather than once.
      const ratio = window.devicePixelRatio || 1;
      const backingWidth = Math.max(1, Math.round(width * ratio));
      const backingHeight = Math.max(1, Math.round(height * ratio));
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }
      // Cleared in device pixels, so the rounding above cannot leave a seam of
      // last frame's drawing along an edge.
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

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
        // would redraw sixty times a second through silence.
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
      if (projectedRef.current.length !== eased.length) {
        projectedRef.current = eased.map(() => [0, 0] as [number, number]);
      }
      const projected = projectedRef.current;
      for (let index = 0; index < eased.length; index += 1) {
        projected[index][0] = Number(xScale(eased[index].x)) || 0;
        projected[index][1] = Number(yScale(eased[index].y)) || 0;
      }

      // The plot's own edges, taken from the scales rather than from props, so
      // everything measured against them follows a resize without being told.
      const xRange = xScale.range?.();
      const yRange = yScale.range?.();
      const plot = {
        left: xRange ? Math.min(xRange[0], xRange[1]) : 0,
        right: xRange ? Math.max(xRange[0], xRange[1]) : 0,
        top: yRange ? Math.min(yRange[0], yRange[1]) : 0,
        bottom: yRange ? Math.max(yRange[0], yRange[1]) : 0,
      };
      // The pixel row the filled styles stand on — the bottom of the plot, and
      // the row every orientation below is measured from.
      const baseline = plot.bottom;
      // The plot's depth, so the pump can say how full the figure is as a
      // fraction rather than in pixels — which is what keeps it reading the
      // same on a short card and a full-screen one.
      const depth = Math.max(1, plot.bottom - plot.top);

      const chosen = lookRef.current.style;
      const shape = createGraphShape(
        projected,
        chosen,
        baseline,
        tuning.columns,
      );
      const figure = new Path2D(shape);

      // Nothing at all unless the light is going to be seen.
      //
      // Read off the root class rather than subscribed to: that class is
      // already the single source of truth for the mode, `contains` is a token
      // lookup with no style recalculation behind it, and it keeps this
      // component out of the euphoria store entirely.
      const isEuphoric =
        document.documentElement.classList.contains('is-euphoric');
      const euphoria: IEuphoriaPaint = {
        isOn: isEuphoric,
        // Only read while the mode is on, because this is the one place in the
        // frame that touches computed style — and outside the mode the answer
        // is a constant nobody paints with.
        hue:
          isEuphoric && computedRef.current
            ? readEuphoriaHue(computedRef.current)
            : 0,
      };

      let halo: Path2D | undefined;
      let lit = 0;
      let swell = 0;
      if (isEuphoric && tuning.glow > 0) {
        // How much of the plot the figure is filling, which is the loudness the
        // halo answers to. Read from the points already projected for the
        // drawing rather than measured again, so it is one pass over an array
        // that is still in cache.
        let filled = 0;
        for (let index = 0; index < projected.length; index += 1) {
          filled += baseline - projected[index][1];
        }
        const energy = Math.max(
          0,
          Math.min(1, filled / (projected.length * depth)),
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
        lit = (GLOW_FLOOR + pumpRef.current * GLOW_REACH) * tuning.glow;
        swell = GLOW_WIDTH_FLOOR + pumpRef.current * GLOW_WIDTH_REACH;

        // The silhouette light comes off, which for most forms is not the form
        // — see `getGlowStyle`. Reused rather than rebuilt when the two are the
        // same shape, which is the common case for the simple forms.
        const glowStyle = getGlowStyle(chosen, shape.length);
        halo =
          glowStyle === chosen
            ? figure
            : new Path2D(
                createGraphShape(
                  projected,
                  glowStyle,
                  baseline,
                  tuning.columns,
                ),
              );
      } else {
        // Dropped on the way out, so the halo does not come back mid-pump the
        // moment the mode returns.
        pumpRef.current = 0;
      }
      const haloPath = halo;

      // The lit peaks. Same frame, same numbers, stroked faint-and-thick under
      // bright-and-thin — a glow made of strokes rather than of a filter,
      // because a filter over geometry that changes every frame re-rasterises
      // its whole region every frame.
      //
      // The same column count as the figure, or the beads sit between the stems
      // they are marking rather than on them.
      const accentShape = tuning.accents
        ? createGraphAccent(projected, chosen, baseline, tuning.columns)
        : '';
      const accent = accentShape ? new Path2D(accentShape) : undefined;

      // The trace's presence, eased rather than transitioned.
      const settle = getEaseFactor(deltaMs, PRESENTATION_SETTLE_MS);
      const targetOpacity = curves[0].opacity;
      const opacityGap = targetOpacity - shownOpacityRef.current;
      if (opacityGap > OPACITY_EPSILON || opacityGap < -OPACITY_EPSILON) {
        shownOpacityRef.current += opacityGap * settle;
        moving = true;
      } else {
        shownOpacityRef.current = targetOpacity;
      }
      const widthGap = tuning.strokeWidth - shownStrokeWidthRef.current;
      if (widthGap > STROKE_WIDTH_EPSILON || widthGap < -STROKE_WIDTH_EPSILON) {
        shownStrokeWidthRef.current += widthGap * settle;
        moving = true;
      } else {
        shownStrokeWidthRef.current = tuning.strokeWidth;
      }
      const opacity = shownOpacityRef.current;
      const strokeWidth = shownStrokeWidthRef.current;

      const isSelfColoured = isSelfColouredLook(
        lookRef.current.palette,
        lookRef.current.colours,
      );
      const figureStrokeWidth = resolveFigureStrokeWidth(
        strokeWidth,
        tuning.borderWidth,
        tuning.border,
        isEuphoric,
      );

      context.lineCap = 'round';
      context.lineJoin = 'round';

      curves.forEach((curve) => {
        const wave = getWaveTransform(curve, baseline);
        context.save();
        context.translate(0, wave.translateY);
        context.scale(1, wave.scaleY);
        // Clipped in the figure's own space, exactly as the SVG clip path was:
        // it was referenced from inside the same transform, so a half-height
        // wave was already bounded to the half it is drawn in.
        context.beginPath();
        context.rect(plot.left, 0, plot.right - plot.left, baseline);
        context.clip();

        // One descriptor, built once, so the halo and the tips can be tested
        // against it by identity and reuse the gradient the figure already has.
        const basePaint = resolveTracePaint(
          lookRef.current.palette,
          lookRef.current.colours,
          curve.colour,
          plot,
        );
        const canvasPaint = toCanvasPaint(context, basePaint);
        const paintFor = (paint: TracePaint) =>
          paint === basePaint ? canvasPaint : toCanvasPaint(context, paint);

        // Behind the figure it echoes.
        if (haloPath) {
          context.strokeStyle = paintFor(
            resolveGlowStroke(basePaint, isSelfColoured, euphoria),
          );
          GLOW_LAYERS.forEach((layer) => {
            setAlpha(context, layer.opacity * lit);
            context.lineWidth = strokeWidth + layer.widen * swell;
            context.stroke(haloPath);
          });
        }

        // One drawing for every style. A filled style paints the same shape
        // rather than stroking it — which is a fill, not a second figure, so
        // cycling styles never changes what is drawn, only how.
        if (tuning.filled) {
          // The fill and the stroke are composited separately here, where SVG
          // composited the element as a group. The only place the two differ is
          // the sliver where a translucent stroke sits over its own fill, and
          // buying that back would mean an offscreen layer per frame.
          setAlpha(context, opacity * tuning.fillOpacity);
          context.fillStyle = canvasPaint;
          context.fill(figure);
        }
        const figureStroke = resolveFigureStroke(
          basePaint,
          tuning.filled,
          tuning.border,
          isSelfColoured,
          euphoria,
        );
        if (figureStroke !== undefined && figureStrokeWidth > 0) {
          setAlpha(context, opacity);
          context.strokeStyle = paintFor(figureStroke);
          context.lineWidth = figureStrokeWidth;
          context.stroke(figure);
        }

        // Lit tips. Only the peaks, and only on the forms that have them — the
        // point is that the loudest few bands in the current frame catch the
        // light while the rest of the figure stays as it was.
        if (accent) {
          const accentStroke = paintFor(
            resolveAccentStroke(basePaint, euphoria),
          );
          setAlpha(
            context,
            isEuphoric ? ACCENT_HALO_EUPHORIC_OPACITY : ACCENT_HALO_OPACITY,
          );
          context.fillStyle = canvasPaint;
          context.strokeStyle = accentStroke;
          context.lineWidth = ACCENT_HALO_WIDTH;
          context.fill(accent);
          context.stroke(accent);

          setAlpha(context, ACCENT_CORE_OPACITY);
          context.fillStyle = 'white';
          context.strokeStyle = isEuphoric ? accentStroke : 'white';
          context.lineWidth = ACCENT_CORE_WIDTH;
          context.fill(accent);
          context.stroke(accent);
        }

        context.restore();
      });

      return moving;
    },
    [curves, height, points, width, xScale, yScale],
  );

  const kickFrames = useSmoothFrames(drawFrame, { isEnabled: true });

  /**
   * Take the context when the element arrives, and let everything go when it
   * leaves.
   *
   * A callback ref rather than a mount effect because the element comes and goes
   * with the music: silence takes it out of the tree entirely — see the render
   * below — and an effect keyed on nothing would hold the context of a canvas
   * that no longer exists.
   *
   * Going away also resets what the drawing had settled into. The component
   * itself stays mounted through the gap, so without this the trace would come
   * back at whatever opacity, weight and glow it was at when the music stopped,
   * where it used to arrive fresh — it is a first appearance again, and it
   * should fade in like one.
   */
  const attachCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    contextRef.current = canvas ? canvas.getContext('2d') : null;
    computedRef.current = canvas ? window.getComputedStyle(canvas) : null;
    if (!canvas) {
      easedRef.current = [];
      pumpRef.current = 0;
      shownOpacityRef.current = 0;
      shownStrokeWidthRef.current = lookRef.current.tuning.strokeWidth;
    }
  }, []);

  useEffect(() => {
    if (easedRef.current.length !== points.length) {
      // First measurement, or the analyser changed size. The curve arrives
      // whole rather than growing out of a flat line.
      easedRef.current = points.map((point) => ({ ...point }));
    }
    kickFrames();
    // `look` is in here so that changing it redraws, and so is the box.
    //
    // The frame loop stops once the curve has settled, which through a pause or
    // a silent passage is immediately — and then nothing would repaint until
    // the audio moved again. Cycling styles that way looked like the setting
    // had not taken, and in the designer, where every slider is judged by what
    // the figure does, it would make the whole panel appear dead. A resize is
    // the same argument with a worse symptom: resizing the backing store clears
    // it, so a settled trace would simply vanish rather than merely go stale.
  }, [curves, height, kickFrames, look, points, width]);

  // Silence takes the canvas out of the document rather than leaving an empty
  // one behind it. An element that is drawing nothing still costs something to
  // keep: in euphoria it carries the keyframes that sweep the hue, which is a
  // style recalculation several times a second for a drawing nobody can see.
  // This is also what makes the trace disappear the moment the music does — the
  // pixels go with the element, so there is nothing to clear.
  if (points.length === 0) {
    return null;
  }

  return (
    <canvas
      ref={attachCanvas}
      className="chart-live-canvas"
      // The chart's own box, to the pixel. The backing store is sized in the
      // frame loop; these are CSS pixels and only say where the drawing sits.
      style={{ left: offsetLeft, top: offsetTop, width, height }}
      // A drawing of something the legend already names, with nothing in it to
      // reach with a pointer or a reader.
      aria-hidden
    />
  );
};

export default LiveTraceCanvas;
