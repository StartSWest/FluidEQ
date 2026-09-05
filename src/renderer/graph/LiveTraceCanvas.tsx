/*
<FluidEQ: System-wide parametric audio equalizer interface>
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
import { DEFAULT_GLOW } from 'common/customLooks';
import { canGraphFill, heatHue } from 'common/graphStyles';
import { easeTowards, getEaseFactor } from 'common/smoothing';
import {
  createGraphAccent,
  createGraphPieces,
  createGraphShape,
  getGlowStyle,
  getGraphPeaks,
  hasGraphPieces,
} from 'common/graphShapes';
import { useSmoothFrames } from 'renderer/utils/useSmoothFrames';
import { useGraphGridHidden, useGraphLook } from 'renderer/utils/graphStyle';
import { useLiveAudioFrame } from '../audio/LiveAudioContext';
import { createAccentState, paintGraphAccent } from './graphAccents';
import { useLookPreviewPoints } from './lookPreview';
import { IChartPointData, ILiveCurveData } from './ChartController';
import {
  IEuphoriaPaint,
  TracePaint,
  getWaveTransform,
  isEuphoriaFigureStroke,
  isSelfColouredLook,
  isTraceGradient,
  readEuphoriaHue,
  resolveAccentStroke,
  resolveFigureStroke,
  resolveFigureStrokeWidth,
  resolveGlowStroke,
  resolvePresentedStrokeWidth,
  resolveTracePaint,
} from './liveTracePaint';
import {
  TRACE_CYAN_STOPS,
  TRACE_RAINBOW_STOPS,
  SPECTRUM_BAR_ATTACK_MS,
  SPECTRUM_BAR_RELEASE_MS,
  SPECTRUM_HUE_BY_PALETTE,
  advanceSpectrumBars,
  paintSpectrumBars,
  spectrumBarsPath,
} from '../waveformPaint';
import { LEVEL_FLOOR_DB } from './outputLevel';
import { readAccentLight } from '../utils/theme';

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

/**
 * How much brighter the fluid's bars are drawn here than in the titlebar.
 *
 * The plot is several times deeper, so the same alphas cover far more area
 * and the drawing reads as a ghost — barely there in a screen recording.
 * This lifts the LIT TOP and leaves the fade alone, because the fade is the
 * effect: raising the foot instead flattens every bar into a slab.
 */
const GRAPH_BAR_LIFT = 1.7;

/** Below these the eased presentation values have arrived and are snapped. */
const OPACITY_EPSILON = 0.002;
const STROKE_WIDTH_EPSILON = 0.01;

/**
 * The fluid's wave, stroked the titlebar's way and only the titlebar's way.
 *
 * One heavy round-capped line over a soft shadow — no halo pass under it. A
 * pair of strokes was tried and is what the wide grey aura came from: two
 * widths of the same curve read as a line with a second, blurrier line
 * around it rather than as a lit one. The shadow does that job properly and
 * costs one stroke.
 *
 * Rainbow gets the wider line and the SMALLER blur: the gradient is already
 * doing the work there, so the glow does not have to.
 */
const TRACE_WIDTH_RAINBOW = 4.2;
const TRACE_WIDTH_CYAN = 3.2;
const TRACE_BLUR_RAINBOW = 14;
const TRACE_BLUR_CYAN = 18;
const TRACE_GLOW_RAINBOW = 'rgba(255, 60, 172, 0.55)';
const traceGlowCyan = () => readAccentLight(0.66, 'rgba(156, 255, 244, 0.66)');

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
  /** Whether this is the subject of the graph rather than a supporting layer. */
  isForeground: boolean;
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
  isForeground,
}: ILiveTraceCanvasProps) => {
  // The measurement, straight from the analyser. This component re-renders with
  // every frame and nothing above it does — which is the entire arrangement.
  const { points: livePoints, waveform } = useLiveAudioFrame();

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

  // Whether the trace has the response plot to itself. This is true both in the
  // user's Wave only mode and when APO is off, because in either case there is
  // no applied response for the wave to sit behind.
  const isForegroundRef = useRef(isForeground);
  isForegroundRef.current = isForeground;

  // Whether there is a frequency axis left for the trace to be honest about.
  // Read here rather than derived from the props, because the margins the chart
  // drops when the grid goes are not the same question as whether anything on
  // the plot is still measured against 16Hz — see the stretch in the frame loop.
  const isGridHidden = useGraphGridHidden();
  const isGridHiddenRef = useRef(isGridHidden);
  isGridHiddenRef.current = isGridHidden;

  // Picking a look against silence shows nothing, so changing one plays a
  // single frame of spectrum and then lets go. Placed here rather than at the
  // source because it is a property of the drawing, not of the measurement:
  // nothing else reading the analyser — the meter, the Smart EQ solver, the
  // rhythm game — should ever see an invented frame.
  const points = useLookPreviewPoints(livePoints, look.id);

  // The points, eased toward each new measurement between measurements.
  //
  // The points are eased rather than the drawing, because the shape has to be
  // rebuilt from numbers that moved. Buffers are reused, so a frame allocates
  // nothing but the paths it hands to the rasteriser.
  const easedRef = useRef<IChartPointData[]>([]);
  const projectedRef = useRef<[number, number][]>([]);
  /**
   * The output envelope, for the one form built from both readings.
   *
   * Held in a ref and deliberately NOT eased. The spectrum is smoothed so it
   * can be read; this is the reading that is supposed to be raw, and easing
   * it would erase the difference in speed that the combined form exists to
   * show. See `fluid` in `graphShapes.ts`.
   */
  const waveformRef = useRef<readonly number[]>(waveform);
  waveformRef.current = waveform;
  /**
   * The fluid's spectrum bars, carried between frames.
   *
   * They have their own ballistics — snap up, ease back — run per frame so
   * the bars keep moving between the analyser's publishes. The eased points
   * above cannot serve: those are the graph's own ballistics, which every
   * other form shares and this one is not supposed to.
   */
  const fluidBarsRef = useRef<number[]>([]);
  /**
   * The wave's samples, eased toward each frame rather than drawn raw.
   *
   * This is what the titlebar does and the graph did not, and it is the
   * whole difference between a line that moves and one that shivers: the
   * envelope arrives about twenty-two times a second, so each frame lands
   * as a visible jump. The rates are the bars' own — snap up on the frame a
   * hit lands, ease back over a tenth of a second — because a symmetric
   * rate that quick tracks the waveform's own oscillation rather than the
   * shape of the sound.
   */
  const fluidWaveRef = useRef<number[]>([]);
  /**
   * What the lit peaks remember between frames.
   *
   * Per graph rather than per look, so changing the mark mid-song changes
   * what is drawn on the peaks already held rather than throwing them away —
   * which is the difference between a setting and a restart.
   */
  const accentStateRef = useRef(createAccentState());
  // How hard the halo is being driven, carried between frames.
  const pumpRef = useRef(0);
  // The trace coming forward and going back — see the constant above. Opacity
  // starts at nothing so the first frame fades in rather than appearing.
  const shownOpacityRef = useRef(0);
  // The width, unlike the opacity, starts where it belongs: opening the graph
  // already soloed should draw the heavier trace, not ease up to it from the
  // supporting weight for no reason anybody watching could name.
  const shownStrokeWidthRef = useRef(
    resolvePresentedStrokeWidth(look.tuning.strokeWidth, isForeground),
  );

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

      /**
       * Edge to edge, but only when there is nothing left to lie to.
       *
       * The axis runs 16Hz to 25kHz and the analyser only reaches 20Hz to
       * 20kHz — a matched pair chosen so the audible marks are not sitting on
       * the frame, which costs the trace about 3% of the plot at each end. On a
       * ruled graph that gap is correct and is the whole point. Expanded or
       * full screen, with the grid off and the wave on its own, it is a strip
       * of empty card down both sides of a drawing that is supposed to fill the
       * screen — sixty pixels at each end of a two-thousand pixel plot,
       * measured — and there is no label, no curve and no handle left anywhere
       * on the plot for it to be measured against.
       *
       * Not gated on the mode, though those are the two it is wanted in. Both
       * flags it reads are per view already, so a pane between the sliders and
       * the editor only reaches this if somebody asked for a gridless wave
       * there too, which is the same request and deserves the same answer.
       *
       * BOTH CONDITIONS, and neither is decoration. Soloed but ruled, the
       * frequency labels underneath would name the wrong columns. Gridless with
       * the curves still up, the trace would cross an EQ response drawn on the
       * real axis and the two would disagree about where 1kHz is. Only "wave
       * only" plus no grid leaves the drawing alone on the card, and only then
       * is stretching it free.
       *
       * Measured from the data's own ends rather than from the analyser's
       * constants: the top of the axis is `min(20kHz, nyquist)`, so an endpoint
       * running below 40kHz reaches less far and would keep a gap that the
       * constants say is not there.
       */
      const firstX = Number(xScale(eased[0].x)) || 0;
      const lastX = Number(xScale(eased[eased.length - 1].x)) || 0;
      const dataSpan = lastX - firstX;
      const stretch =
        isForegroundRef.current && isGridHiddenRef.current && dataSpan > 0
          ? (plot.right - plot.left) / dataSpan
          : 1;

      // Projected into pixels first: the axes are logarithmic in frequency and
      // decibel in level, so building bars or steps in data space and scaling
      // afterwards would put every edge in the wrong place.
      if (projectedRef.current.length !== eased.length) {
        projectedRef.current = eased.map(() => [0, 0] as [number, number]);
      }
      const projected = projectedRef.current;
      for (let index = 0; index < eased.length; index += 1) {
        const x = Number(xScale(eased[index].x)) || 0;
        projected[index][0] =
          stretch === 1 ? x : plot.left + (x - firstX) * stretch;
        projected[index][1] = Number(yScale(eased[index].y)) || 0;
      }

      // The pixel row the filled styles stand on — the bottom of the plot, and
      // the row every orientation below is measured from.
      const baseline = plot.bottom;
      // The plot's depth, so the pump can say how full the figure is as a
      // fraction rather than in pixels — which is what keeps it reading the
      // same on a short card and a full-screen one.
      const depth = Math.max(1, plot.bottom - plot.top);

      const chosen = lookRef.current.style;
      /**
       * The fluid is painted rather than pathed, exactly as the titlebar
       * paints it — a bar every eleven pixels, each with its own hue and its
       * own vertical gradient, which is what no single fillStyle on a shared
       * path can express. Advanced once per frame here rather than inside the
       * curve loop below, which runs twice when the wave is mirrored.
       */
      /**
       * The titlebar's ten, which are drawn there in one colour system
       * whatever the style is: a ramp across the pane, cyan at rest and
       * rainbow in euphoria. That is what `signal` should mean for these —
       * the form's own colouring, the same reading the fluid's bars got —
       * and it is most of why they did not look like the titlebar's.
       *
       * The other three palettes still reach them, because a look is a form
       * AND a colouring and this only decides what the unmarked case is.
       */
      const isWaveForm = chosen.startsWith('wave-');
      const isFluidForm = chosen === 'fluid';
      /**
       * Filled, but only where filling draws something.
       *
       * The look's switch is honoured through here rather than read directly,
       * so a look saved with it on before the picker learned to hide it still
       * draws its form instead of an empty pane.
       */
      const isFilled = tuning.filled && canGraphFill(chosen);
      /**
       * The bars span the READING, not the plot.
       *
       * The axis runs 16Hz to 25kHz and the analyser only reaches 20Hz to
       * 20kHz — a deliberate pair, so the audible marks are not sitting on
       * the frame — which costs the drawing about three per cent of the plot
       * at each end. The wave already respects that, because it is built
       * from the points; the bars were laid out edge to edge and so ran past
       * both ends of the data, out over the axis labels.
       */
      const fluidLeft = projected[0][0];
      const fluidRight = projected[projected.length - 1][0];
      if (isFluidForm) {
        // Whatever Pieces says, like every other form. The catalogue's
        // default for this one is set near the titlebar's eleven-pixel
        // spacing — see `COLUMN_OVERRIDES`.
        const barCount = tuning.columns;
        const bars = fluidBarsRef.current;
        if (bars.length !== barCount) {
          bars.length = barCount;
          bars.fill(0);
        }
        advanceSpectrumBars(bars, easedRef.current, LEVEL_FLOOR_DB, deltaMs);
        easeTowards(
          fluidWaveRef.current,
          waveformRef.current,
          getEaseFactor(deltaMs, SPECTRUM_BAR_ATTACK_MS),
          getEaseFactor(deltaMs, SPECTRUM_BAR_RELEASE_MS),
        );
        // Still settling counts as motion, or the loop stops with the bars
        // halfway down and leaves them there until the next measurement.
        moving = true;
      }

      /**
       * The fluid's figure is the bars it actually paints.
       *
       * Everything that traces the drawing — the border, the mask that keeps
       * that border outside its own fill — works on a path, and a painted
       * figure has none. Taking one from the shape module instead gave a
       * different count at a different width, so the rainbow border was
       * drawn around bars it had never seen. Same geometry, same rectangles.
       */
      const shape = isFluidForm
        ? spectrumBarsPath(
            {
              x: fluidLeft,
              y: 0,
              width: fluidRight - fluidLeft,
              height: baseline,
            },
            fluidBarsRef.current,
            tuning.gap,
          )
        : createGraphShape(
            projected,
            chosen,
            baseline,
            tuning.columns,
            // Read through a ref rather than closed over: this loop runs on
            // its own frames, and the envelope arrives on the pump's.
            waveformRef.current,
            tuning.gap,
            plot.top,
            isFilled,
          );
      const figure = new Path2D(shape);

      /**
       * The figure again, as one path per piece — but only when something is
       * going to colour them differently.
       *
       * It is a `Path2D` per piece and a fill call per piece, which is the
       * cost the single path exists to avoid, so it is built for the one
       * palette that cannot be expressed any other way and for nothing else.
       */
      const piecePaths =
        lookRef.current.palette === 'heat' && hasGraphPieces(chosen)
          ? createGraphPieces(
              projected,
              chosen,
              baseline,
              tuning.columns,
              tuning.gap,
            ).map((piece) => ({
              path: new Path2D(piece.d),
              energy: piece.energy,
            }))
          : undefined;

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

      /**
       * How much of the plot the figure is filling, which is the loudness.
       *
       * Read from the points already projected for the drawing rather than
       * measured again, so it is one pass over an array still in cache.
       *
       * Hoisted out of the euphoria branch below because two things want it
       * now: the halo, which pumps with it, and the `heat` palette, whose
       * entire colour IS it. Left inside, heat would have been cyan forever
       * outside the mode — a palette that only works in euphoria is not a
       * palette, it is part of euphoria.
       */
      let filled = 0;
      for (let index = 0; index < projected.length; index += 1) {
        filled += baseline - projected[index][1];
      }
      const energy = Math.max(
        0,
        Math.min(1, filled / (projected.length * depth)),
      );

      let halo: Path2D | undefined;
      let lit = 0;
      let swell = 0;
      if (isEuphoric && tuning.glow > 0) {
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
                  // The halo has to be the same figure it sits behind, which
                  // includes standing in the same box.
                  waveformRef.current,
                  tuning.gap,
                  plot.top,
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
        ? createGraphAccent(
            projected,
            chosen,
            baseline,
            fluidWaveRef.current,
            tuning.accentStyle,
          )
        : '';
      const accent = accentShape ? new Path2D(accentShape) : undefined;

      /**
       * What the painted marks read: the peaks worth lighting, and every
       * column's height and position.
       *
       * Built once per frame rather than per curve — the mirrored modes draw
       * the same measurement twice and would otherwise find the peaks twice
       * and, worse, advance what they remember twice, which halves every
       * fall rate and doubles every spark.
       *
       * Only when a painted mark is on, since it is a pass over the frame.
       */
      const wantsPaintedAccent =
        tuning.accents && tuning.accentStyle !== 'wave';
      const accentPeaks = wantsPaintedAccent
        ? getGraphPeaks(projected, chosen, baseline, tuning.columns)
        : [];
      const accentHeights: number[] = [];
      const accentPositions: number[] = [];
      if (wantsPaintedAccent) {
        const accentDepth = Math.max(1, baseline);
        for (let index = 0; index < projected.length; index += 1) {
          accentPositions.push(projected[index][0]);
          accentHeights.push(
            Math.max(
              0,
              Math.min(1, (baseline - projected[index][1]) / accentDepth),
            ),
          );
        }
      }

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
      // Heavier as well as brighter when it is the only thing drawn, and eased
      // through the same settle as the opacity so the two arrive together.
      const targetStrokeWidth = resolvePresentedStrokeWidth(
        tuning.strokeWidth,
        isForegroundRef.current,
      );
      const widthGap = targetStrokeWidth - shownStrokeWidthRef.current;
      if (widthGap > STROKE_WIDTH_EPSILON || widthGap < -STROKE_WIDTH_EPSILON) {
        shownStrokeWidthRef.current += widthGap * settle;
        moving = true;
      } else {
        shownStrokeWidthRef.current = targetStrokeWidth;
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
      // Whose edge this is, which decides where it is allowed to sit.
      const isEuphoriaEdge = isEuphoriaFigureStroke(tuning.border, euphoria);

      /**
       * Everywhere the figure is not, for the euphoria border to be stroked in.
       *
       * A canvas stroke straddles its path, so half of every border landed
       * inside the shape and painted over the fill — which on the discrete forms
       * is most of the shape. Bars at the default sixty-four columns are about
       * six pixels wide on a full-width plot and the border goes to eight, so
       * the fill the border was decorating did not survive at all. That is the
       * bug: a rainbow or a level ramp says something, and the decoration was
       * erasing it.
       *
       * Chromium has no `stroke-alignment`, and neither SVG nor canvas offers
       * one, so the stroke is drawn at twice the weight through a clip that
       * excludes the figure — the inner half is masked away and exactly
       * `figureStrokeWidth` is left standing outside the edge. The alternatives
       * were both worse: stroking under the fill leaks through, because the fill
       * is translucent by default and `fillOpacity` goes as low as 0.15; and
       * `destination-over` leaks for the same reason, since it composites on
       * alpha rather than on geometry.
       *
       * Even-odd is what makes the figure a hole in the surrounding rectangle
       * rather than being swallowed by it. The figure itself is filled non-zero,
       * so a form whose pieces overlap each other has a small disagreement
       * between the two in the overlap — no built-in form does, and the worst it
       * could cost is a sliver of border over a fill that is already doubled.
       *
       * Built once per frame rather than per curve: it is expressed in the same
       * space as the figure, and the mirrored copy's transform is applied when
       * the clip is set rather than when it is built.
       */
      /**
       * Not on the fluid, which is the one form it neither suits nor can
       * afford.
       *
       * The mask is an even-odd clip built from the whole figure, and this
       * figure is a hundred and twenty-eight rectangles that change every
       * frame — so it is a fresh path of that size, tessellated as a clip,
       * sixty times a second. And the result is not worth it: a border round
       * every bar at that density is not an edge on a shape, it is a grid,
       * and the bars stop being readable behind their own outlines. The wave
       * is where this form's light belongs.
       */
      const needsOutside =
        isEuphoriaEdge && isFilled && figureStrokeWidth > 0 && !isFluidForm;
      let outside: Path2D | undefined;
      if (needsOutside) {
        const bleed = figureStrokeWidth + 1;
        outside = new Path2D();
        outside.rect(
          plot.left - bleed,
          -bleed,
          plot.right - plot.left + bleed * 2,
          baseline + bleed * 2,
        );
        outside.addPath(figure);
      }

      context.lineCap = 'round';
      context.lineJoin = 'round';

      curves.forEach((curve) => {
        const wave = getWaveTransform(curve, baseline, plot.top);
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
          // Only `heat` reads it, and for that one the loudness IS the colour.
          energy,
        );
        const waveRamp =
          isWaveForm && lookRef.current.palette === 'signal'
            ? (() => {
                const ramp = context.createLinearGradient(
                  plot.left,
                  0,
                  plot.right,
                  0,
                );
                (isEuphoric ? TRACE_RAINBOW_STOPS : TRACE_CYAN_STOPS).forEach(
                  (stop) => {
                    ramp.addColorStop(stop.offset, stop.colour);
                  },
                );
                return ramp;
              })()
            : undefined;
        const canvasPaint = waveRamp ?? toCanvasPaint(context, basePaint);
        const paintFor = (paint: TracePaint) =>
          paint === basePaint ? canvasPaint : toCanvasPaint(context, paint);

        /**
         * Behind the figure it echoes — except on the fluid, where Glow
         * belongs to the wave and to nothing else.
         *
         * One setting lighting two things at once is not one setting: the
         * bars would have taken a halo of their own from the same slider
         * that sets the line's, and turning the line down would have dimmed
         * a row of ghosts nobody was looking at. Glow means the wave here.
         */
        // The wave family is lit by its own shadow instead — see below, and
        // see the titlebar's `SOFT_GLOW_WAVEFORM_STYLES`, which drops the
        // halo for exactly these. Two lights on one figure is not twice as
        // lit, it is a smear with no edge left.
        if (haloPath && !isFluidForm && !isWaveForm) {
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
        /**
         * The wave family is lit by a soft shadow, not by the neon halo.
         *
         * That is how the titlebar lights them, and its own comment gives
         * the reason: a multi-stroke halo does not suit a figure made of
         * separate pieces — it outlines each one rather than lighting the
         * drawing. Scaled by the look's Glow like everything else, so the
         * setting still means something here and zero is flat.
         */
        if (isWaveForm && tuning.glow > 0) {
          context.shadowColor = isEuphoric
            ? TRACE_GLOW_RAINBOW
            : traceGlowCyan();
          context.shadowBlur =
            (isEuphoric ? TRACE_BLUR_RAINBOW : TRACE_BLUR_CYAN) *
            (tuning.glow / DEFAULT_GLOW);
        }

        if (isFluidForm && isFilled) {
          // The titlebar's own bars, from the titlebar's own painter. The hue
          // sweep is the form's own fill — it is what makes this drawing this
          // drawing — but WHETHER it is filled, and how solidly, are settings
          // like anywhere else.
          setAlpha(context, opacity * tuning.fillOpacity);
          paintSpectrumBars(
            context,
            {
              x: fluidLeft,
              y: 0,
              width: fluidRight - fluidLeft,
              height: baseline,
            },
            fluidBarsRef.current,
            isEuphoric,
            /**
             * All three keep the form's treatment and differ in what the
             * hue is taken FROM — position at two widths, or the bar's own
             * loudness. A palette that filled flat instead stopped being
             * this drawing.
             */
            SPECTRUM_HUE_BY_PALETTE[lookRef.current.palette],
            tuning.gap,
            // Brighter at the top than the titlebar, and faded identically —
            // see the constant's own note.
            GRAPH_BAR_LIFT,
            // Level is a meter: the ramp is pinned to the plot and each bar
            // shows its own slice of it, so a colour is a decibel.
            lookRef.current.palette === 'level' ? canvasPaint : undefined,
          );
        } else if (isFilled && piecePaths) {
          /**
           * A colour per piece, for the palette that has one to give.
           *
           * Heat's colour is how loud a thing is, and on a form made of
           * pieces the thing is the piece — so one fill for the whole figure
           * answers a question nobody asked and lights every bar at once.
           * That is the difference the fluid always had over the rest, and
           * it had it only because it is painted rather than pathed.
           *
           * Asked for only here, and only for this palette: the other three
           * colour by POSITION, which a gradient over one path already does
           * correctly and far more cheaply.
           */
          setAlpha(context, opacity * tuning.fillOpacity);
          piecePaths.forEach((piece) => {
            context.fillStyle = `hsl(${heatHue(piece.energy)}, 92%, 60%)`;
            context.fill(piece.path);
          });
        } else if (isFilled) {
          // The fill and the stroke are composited separately here, where SVG
          // composited the element as a group. The only place the two differ is
          // the sliver where a translucent stroke sits over its own fill, and
          // buying that back would mean an offscreen layer per frame.
          setAlpha(context, opacity * tuning.fillOpacity);
          context.fillStyle = canvasPaint;
          context.fill(figure);
        }
        // The euphoria sweep does not take the fluid's border either — see
        // `needsOutside`. Its bars are lit by their own hue and the wave over
        // them; a travelling edge on each of a hundred-odd of them is noise.
        // Put away before the outline and the marks: a shadow set for the
        // figure would otherwise light everything drawn after it in the same
        // save block, and a lit peak wearing the figure's glow reads as a
        // smudge rather than as a mark.
        const clearWaveGlow = () => {
          if (isWaveForm) {
            context.shadowBlur = 0;
            context.shadowColor = 'transparent';
          }
        };

        const figureStroke = resolveFigureStroke(
          basePaint,
          isFilled,
          tuning.border,
          isSelfColoured,
          euphoria,
        );
        /**
         * The fluid is not stroked at all.
         *
         * A stroke follows the whole path, and this path is rectangles
         * standing on the floor — so it drew a line along the bottom of
         * every bar, brighter than the fade above it, and the plot grew a
         * lit rail across its foot that nothing had asked for. The form's
         * edges are its own fade and the wave over it.
         */
        clearWaveGlow();
        if (
          figureStroke !== undefined &&
          figureStrokeWidth > 0 &&
          !isFluidForm
        ) {
          setAlpha(context, opacity);
          context.strokeStyle = paintFor(figureStroke);
          if (outside) {
            // A painted form: the border goes round the outside of the fill,
            // double weight through the mask built above. See the note there.
            context.save();
            context.clip(outside, 'evenodd');
            context.lineWidth = figureStrokeWidth * 2;
            context.stroke(figure);
            context.restore();
          } else if (isEuphoriaEdge) {
            /**
             * A stroked form: the border goes AROUND the line, never over it.
             *
             * There is no fill to clip against on a figure that is only a
             * line, so the border is a casing laid under it — stroked first,
             * wide enough that `figureStrokeWidth` of it stands proud on each
             * side, and then the look's own paint over the top at its own
             * weight. The line stays the colour it was and the travelling hue
             * runs outside it, which is what a border is.
             *
             * This used to require the look to have colours of its own, on
             * the reasoning that only those had something to lose. They were
             * not the only ones: a flat look's line is still a line, and
             * replacing its colour is not bordering it — it is painting over
             * it, which is what `echo` and every other stroked form were
             * getting while their Rainbow border box did the asking.
             */
            context.lineWidth = strokeWidth + figureStrokeWidth * 2;
            context.stroke(figure);
            context.strokeStyle = canvasPaint;
            context.lineWidth = strokeWidth;
            context.stroke(figure);
          } else {
            // Either the look's own edge, or a trace with no colours of its own
            // for the sweep to take away. Centred, as it has always been.
            context.lineWidth = figureStrokeWidth;
            context.stroke(figure);
          }
        }

        // Lit tips. Only the peaks, and only on the forms that have them — the
        // point is that the loudest few bands in the current frame catch the
        // light while the rest of the figure stays as it was.
        /**
         * Lit peaks.
         *
         * Two shapes of thing under one setting. The wave is a path — the
         * titlebar's own curve — so it is stroked like any other figure. The
         * other nine hang, sink, expand, fly or trail, none of which exists
         * inside a single frame, so they are painted by something that keeps
         * what they remember. See `graphAccents`.
         */
        if (tuning.accents) {
          if (tuning.accentStyle === 'wave' && accent) {
            /**
             * One stroke over a shadow, which is how the titlebar lights it.
             *
             * No halo pass under it: two widths of the same curve read as a
             * line with a blurrier line drawn around it, which is where the
             * grey aura came from. And no fill — filling an open curve
             * closes it, which is where the white slab came from.
             *
             * The titlebar's ramp rather than the look's, wherever it is
             * worn: this accent IS the titlebar's figure, so a given
             * frequency keeps its colour whether the frame is loud or quiet.
             */
            const ramp = context.createLinearGradient(
              plot.left,
              0,
              plot.right,
              0,
            );
            (isEuphoric ? TRACE_RAINBOW_STOPS : TRACE_CYAN_STOPS).forEach(
              (stop) => {
                ramp.addColorStop(stop.offset, stop.colour);
              },
            );
            context.save();
            context.lineJoin = 'round';
            context.lineCap = 'round';
            context.shadowColor = isEuphoric
              ? TRACE_GLOW_RAINBOW
              : traceGlowCyan();
            /**
             * The look's glow and thickness, as multiples of their own
             * defaults rather than as raw values — multiplying by them
             * directly would undo the shipped look, since thickness defaults
             * to 2 and would double a 4.2px line into 8.4.
             */
            context.shadowBlur =
              (isEuphoric ? TRACE_BLUR_RAINBOW : TRACE_BLUR_CYAN) *
              (tuning.glow / DEFAULT_GLOW);
            setAlpha(context, opacity);
            context.strokeStyle = ramp;
            context.lineWidth =
              (isEuphoric ? TRACE_WIDTH_RAINBOW : TRACE_WIDTH_CYAN) *
              tuning.accentWidth;
            context.stroke(accent);
            context.restore();
          } else if (tuning.accentStyle !== 'wave') {
            setAlpha(context, opacity);
            if (
              paintGraphAccent({
                context,
                behaviour: tuning.accentStyle,
                peaks: accentPeaks,
                heights: accentHeights,
                positions: accentPositions,
                baseline,
                left: plot.left,
                right: plot.right,
                state: accentStateRef.current,
                deltaMs,
                weight: tuning.accentWidth,
                paint: paintFor(resolveAccentStroke(basePaint, euphoria)),
              })
            ) {
              // A mote still in the air is motion, even once the music has
              // stopped — the loop has to keep drawing until it lands.
              moving = true;
            }
          }
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
    // `look` is in here so that changing it redraws, and so are solo, the grid
    // and the box. Solo has to be named even though the curves are rebuilt when
    // it changes: what it moves is the weight, which is eased over several
    // frames, and the loop cannot ease anything it was not started for. The
    // grid is here for a blunter reason — it is half of the test that stretches
    // the trace across the card, and nothing else in this list moves when it is
    // switched, so without it the wave would keep its gutters until the music
    // next happened to move.
    //
    // The frame loop stops once the curve has settled, which through a pause or
    // a silent passage is immediately — and then nothing would repaint until
    // the audio moved again. Cycling styles that way looked like the setting
    // had not taken, and in the designer, where every slider is judged by what
    // the figure does, it would make the whole panel appear dead. A resize is
    // the same argument with a worse symptom: resizing the backing store clears
    // it, so a settled trace would simply vanish rather than merely go stale.
  }, [
    curves,
    height,
    isForeground,
    isGridHidden,
    kickFrames,
    look,
    points,
    width,
  ]);

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
