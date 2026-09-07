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
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { DEFAULT_GLOW, resolveLookColours } from 'common/customLooks';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { canGraphFill, resolveGraphPalette } from 'common/graphStyles';
import { createGraphStems, STEM_FADE_LEVELS } from 'common/graphStems';
import createGraphTerrace from 'common/graphTerrace';
import { getEaseFactor } from 'common/smoothing';
import {
  createGraphAccent,
  createGraphPieces,
  createGraphShape,
  createGraphScatter,
  createGraphConnector,
  canConnectGraphMarks,
  getGlowStyle,
  getGraphPeaks,
  hasGraphPieces,
  toColumns,
} from 'common/graphShapes';
import useSmoothFrames from 'renderer/utils/useSmoothFrames';
import { useGraphGridHidden, useGraphLook } from 'renderer/utils/graphStyle';
import createTrussRoad from 'common/graphTruss';
import createGraphStalactites from 'common/graphStalactites';
import createGraphSawtooth from 'common/graphSawtooth';
import {
  advanceRoadTrip,
  createRoadTrip,
  createRoadTripPaths,
  ROAD_COLUMNS,
  RoadLane,
} from './roadTrip';
import {
  advanceEchoWaves,
  createEchoWaves,
  createEchoWavePaths,
  SNAPSHOT_COLUMNS,
} from './echoWaves';
import {
  advancePulseMonitor,
  createPulseMonitor,
  createPulsePaths,
  echoDrift,
  pulseShake,
  pulseThump,
} from './pulseMonitor';
import {
  advanceSawtoothScope,
  createSawtoothScope,
  createSparkPath,
  ghostGlow,
  sawtoothFlare,
} from './sawtoothScope';
import {
  useLiveAudioFrame,
  useLiveAudioControl,
} from '../audio/LiveAudioContext';
import {
  createGraphMotionState,
  createMovingGraphShape,
  hasGraphMotion,
} from './graphMotion';
import {
  advanceGraphAccent,
  createAccentState,
  paintGraphAccent,
} from './graphAccents';
import { createFluidBarPaint, heatColour } from './lookColours';
import createDotPaths from './dotPaths';
import createBubblePaths from './bubblePaths';
import {
  advanceBubbleStorm,
  bubbleShake,
  createBubbleStorm,
} from './bubbleStorm';
import paintTrussCars from './trussCars';
import createSlopeFlow from './slopeFlow';
import { resolveLookWaveform, useLookPreviewPoints } from './lookPreview';
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
  SPECTRUM_HUE_BY_PALETTE,
  advanceSpectrumBars,
  advanceWaveform,
  paintSpectrumBars,
  spectrumBarsPath,
} from '../waveformPaint';
import { readAccentLight } from '../utils/theme';
import { useIsRootEuphoric } from '../utils/euphoriaMode';
import { GraphLookTransition } from './graphLookTransition';
import getGraphMotionDelta from './graphMotionPacing';
import { createDashTrails, advanceDashTrails } from './dashTrails';
import {
  createTerraceJumper,
  advanceTerraceJumper,
  paintTerraceJumper,
} from './terraceJumper';

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
  const { isPaused } = useLiveAudioControl();
  const playingRef = useRef(false);
  // Shared audio and look previews supply frames without opening the local
  // capture. Only Pause freezes their motion; isActive describes that capture.
  playingRef.current = !isPaused;
  const motionRef = useRef(createGraphMotionState());
  const terraceJumperRef = useRef(createTerraceJumper());
  const trussTrafficRef = useRef(0);
  const slopeFlowRef = useRef(0);
  const bubbleStormRef = useRef(createBubbleStorm());
  const sawtoothScopeRef = useRef(createSawtoothScope());
  const pulseMonitorRef = useRef(createPulseMonitor());
  const echoWavesRef = useRef(createEchoWaves());
  const roadTripRef = useRef(createRoadTrip());
  const dashTrailsRef = useRef(createDashTrails());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transitionRef = useRef(new GraphLookTransition());
  // Held rather than fetched per frame: the computed style is a live object
  // bound to the element, and it goes stale with the context if the canvas is
  // ever replaced, so the two are taken together.
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const computedRef = useRef<CSSStyleDeclaration | null>(null);

  // Only the live trace has a look; every other curve on this chart is the
  // user's own tuning and has one right way to be drawn.
  const look = useGraphLook();
  const isRainbow = useIsRootEuphoric();
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
  const displayedWaveform = useMemo(
    () => resolveLookWaveform(points, livePoints, waveform),
    [points, livePoints, waveform],
  );

  // The points, eased toward each new measurement between measurements.
  //
  // The points are eased rather than the drawing, because the shape has to be
  // rebuilt from numbers that moved. Buffers are reused, so a frame allocates
  // nothing but the paths it hands to the rasteriser.
  const easedRef = useRef<IChartPointData[]>([]);
  const projectedRef = useRef<[number, number][]>([]);
  // Capture frames remain raw; only this visualizer's copy is eased.
  const waveformRef = useRef<readonly number[]>(displayedWaveform);
  waveformRef.current = displayedWaveform;
  // Fluid eases its grouped magnitudes once with the look's ballistics.
  const fluidBarsRef = useRef<number[]>([]);
  // Shared by Wave forms and the Wave peak mark, using Edit's Attack/Release.
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
        transitionRef.current.reset();
      }
      const now = performance.now();
      transitionRef.current.prepare(canvas, lookRef.current.id, now);
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
      const yRange = yScale.range?.();
      const plotDepth = yRange ? Math.abs(yRange[1] - yRange[0]) : height;
      const heightScale = curves.reduce(
        (largest, curve) =>
          Math.max(largest, Math.abs(getWaveTransform(curve, 1).scaleY)),
        0,
      );
      const motionDeltaMs = getGraphMotionDelta(
        deltaMs,
        plotDepth * heightScale,
      );
      const rise = getEaseFactor(motionDeltaMs, tuning.attackMs);
      const fall = getEaseFactor(motionDeltaMs, tuning.releaseMs);
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
      // The same Edit ballistics must reach the waveform and FFT. Previously
      // the wave forms bypassed them, and Fluid's empty wave buffer never grew.
      if (
        isWaveForm ||
        isFluidForm ||
        (tuning.accents && tuning.accentStyle === 'wave')
      ) {
        moving =
          advanceWaveform(
            fluidWaveRef.current,
            waveformRef.current,
            motionDeltaMs,
            tuning,
          ) || moving;
      }
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
        // These are graph-relative dB, not the meter's dBFS. Using -60 as
        // their floor made a silent -20 frame produce half-height bars.
        moving =
          advanceSpectrumBars(
            bars,
            data,
            MIN_GAIN,
            motionDeltaMs,
            tuning,
            MAX_GAIN - MIN_GAIN,
          ) || moving;
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
      const stems =
        chosen === 'stems'
          ? createGraphStems(
              toColumns(projected, tuning.columns),
              baseline,
              tuning.gap,
            )
          : undefined;
      const mineral =
        chosen === 'stalactites' && isFilled
          ? createGraphStalactites(
              toColumns(projected, tuning.columns),
              baseline,
              plot.top,
              tuning.gap,
            )
          : undefined;
      // The scope's beam: the wave itself, stroked bright over the body.
      const sawTrace =
        chosen === 'sawtooth'
          ? new Path2D(
              createGraphSawtooth(
                toColumns(projected, tuning.columns),
                baseline,
                motionRef.current.travel[0] ?? 0,
              ).trace,
            )
          : undefined;
      if (sawTrace) {
        advanceSawtoothScope(
          sawtoothScopeRef.current,
          sawTrace,
          toColumns(projected, tuning.columns),
          plot.top,
          baseline,
          motionRef.current.travel[0] ?? 0,
          playingRef.current,
        );
      }
      const mineralPaths = mineral
        ? {
            shade: new Path2D(mineral.shade),
            light: new Path2D(mineral.light),
          }
        : undefined;
      // The monitor decides its beat first and hands back its own figure,
      // pumped by the thump; the static shape is never built for it.
      if (chosen === 'ecg') {
        advancePulseMonitor(
          pulseMonitorRef.current,
          toColumns(projected, tuning.columns),
          plot.top,
          baseline,
          motionRef.current.travel[0] ?? 0,
          playingRef.current,
        );
      }
      const pulsePaths =
        chosen === 'ecg'
          ? createPulsePaths(
              pulseMonitorRef.current,
              toColumns(projected, tuning.columns),
              baseline,
              motionRef.current.travel[0] ?? 0,
            )
          : undefined;
      // Echo keeps its own past and hands back the live wave as the figure;
      // the static stack is never built for it.
      if (chosen === 'echo') {
        advanceEchoWaves(
          echoWavesRef.current,
          toColumns(projected, SNAPSHOT_COLUMNS),
          plot.top,
          baseline,
          motionRef.current.travel[0] ?? 0,
          playingRef.current,
        );
      }
      const echoPaths =
        chosen === 'echo'
          ? createEchoWavePaths(
              echoWavesRef.current,
              projected,
              plot.top,
              baseline,
              motionRef.current.travel[0] ?? 0,
              isFilled,
            )
          : undefined;
      // The road trip likewise: the band is its figure, the rest is scenery.
      const roadPoints =
        chosen === 'racer' ? toColumns(projected, ROAD_COLUMNS) : undefined;
      if (roadPoints) {
        advanceRoadTrip(
          roadTripRef.current,
          roadPoints,
          plot.top,
          baseline,
          motionRef.current.travel[0] ?? 0,
          playingRef.current,
        );
      }
      const roadPaths = roadPoints
        ? createRoadTripPaths(
            roadTripRef.current,
            roadPoints,
            plot.top,
            baseline,
            motionRef.current.travel[0] ?? 0,
          )
        : undefined;
      let shape =
        stems?.shape ??
        (pulsePaths || echoPaths || roadPaths ? '' : undefined) ??
        (isFluidForm
          ? spectrumBarsPath(
              {
                x: fluidLeft,
                y: plot.top,
                width: fluidRight - fluidLeft,
                height: depth,
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
              fluidWaveRef.current,
              tuning.gap,
              plot.top,
              isFilled,
              0,
              tuning.connectingLine,
            ));
      if (chosen === 'slope' && playingRef.current) {
        slopeFlowRef.current = (slopeFlowRef.current + motionDeltaMs / 480) % 1;
        moving = true;
      }
      const slopeFlow =
        chosen === 'slope'
          ? createSlopeFlow(
              toColumns(projected, tuning.columns),
              slopeFlowRef.current,
              baseline,
              tuning.gap,
            )
          : undefined;
      if (slopeFlow) {
        shape = slopeFlow.path;
      }
      if (hasGraphMotion(chosen)) {
        const motion = createMovingGraphShape({
          state: motionRef.current,
          points: projected,
          style: chosen,
          columns: tuning.columns,
          top: plot.top,
          bottom: baseline,
          deltaMs: motionDeltaMs,
          playing: playingRef.current,
          filled: isFilled,
          gap: tuning.gap,
        });
        shape = motion.path;
        moving = motion.moving || moving;
      } else {
        motionRef.current.key = '';
      }
      const scatter =
        chosen === 'scatter' || chosen === 'dots'
          ? createGraphScatter(projected, tuning.columns, tuning.gap)
          : undefined;
      const blinkingSatellites =
        scatter && tuning.accents && tuning.accentStyle === 'blink';
      const figure =
        pulsePaths?.shape ??
        echoPaths?.shape ??
        roadPaths?.shape ??
        new Path2D(
          blinkingSatellites && chosen === 'scatter' ? scatter.primary : shape,
        );
      const trussRoad =
        chosen === 'truss'
          ? createTrussRoad(toColumns(projected, tuning.columns))
          : undefined;
      if (trussRoad && playingRef.current) {
        trussTrafficRef.current =
          (trussTrafficRef.current + motionDeltaMs / 24000) % 1;
        moving = true;
      }
      const connector =
        tuning.connectingLine &&
        chosen !== 'dots' &&
        canConnectGraphMarks(chosen)
          ? new Path2D(
              createGraphConnector(toColumns(projected, tuning.columns)),
            )
          : undefined;
      const scatterPaths =
        scatter && chosen === 'scatter' && isFilled
          ? {
              primary: new Path2D(scatter.primary),
              secondary: new Path2D(scatter.secondary),
            }
          : undefined;
      const dashHistory =
        chosen === 'dashes'
          ? advanceDashTrails(
              dashTrailsRef.current,
              toColumns(projected, tuning.columns),
              baseline,
              tuning.gap,
              motionDeltaMs,
              playingRef.current,
            )
          : undefined;
      const dashTrails = (slopeFlow?.trails ?? dashHistory?.trails)?.map(
        (trail) => ({
          ...trail,
          path: new Path2D(trail.path),
        }),
      );
      if (dashHistory?.moving) {
        moving = true;
      }
      if (!dashHistory) {
        dashTrailsRef.current.key = '';
      }
      const terraceJumper =
        chosen === 'terrace'
          ? advanceTerraceJumper(
              terraceJumperRef.current,
              toColumns(projected, tuning.columns),
              motionDeltaMs,
              playingRef.current,
            )
          : undefined;
      if (terraceJumper && playingRef.current) {
        moving = true;
      }
      const terraceTiers =
        chosen === 'terrace' && isFilled
          ? createGraphTerrace(
              toColumns(projected, tuning.columns),
              baseline,
            ).tiers.map((tier) => ({
              body: new Path2D(tier.body),
              edge: new Path2D(tier.edge),
              opacity: tier.opacity,
            }))
          : undefined;
      const stemLayers =
        isFilled && stems
          ? {
              tips: new Path2D(stems.tips),
              lines: stems.layers.map((path) => new Path2D(path)),
            }
          : undefined;

      /**
       * The figure again, as one path per piece — but only when something is
       * going to colour them differently.
       *
       * It is a `Path2D` per piece and a fill call per piece, which is the
       * cost the single path exists to avoid, so it is built for the one
       * palette that cannot be expressed any other way and for nothing else.
       */
      const piecePaths =
        resolveGraphPalette(chosen, lookRef.current.palette) === 'heat' &&
        hasGraphPieces(chosen)
          ? createGraphPieces(
              projected,
              chosen,
              baseline,
              tuning.columns,
              tuning.gap,
              plot.top,
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
          getEaseFactor(
            motionDeltaMs,
            gap > 0 ? GLOW_ATTACK_MS : GLOW_RELEASE_MS,
          );
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
        // The monitor has no string to measure; its trace is simple enough
        // for the light to follow the real thing.
        const glowStyle = getGlowStyle(
          chosen,
          pulsePaths || echoPaths || roadPaths ? 0 : shape.length,
          isFilled,
        );
        halo =
          glowStyle === chosen || isFluidForm || hasGraphMotion(chosen)
            ? figure
            : new Path2D(
                createGraphShape(
                  projected,
                  glowStyle,
                  baseline,
                  tuning.columns,
                  // The halo has to be the same figure it sits behind, which
                  // includes standing in the same box.
                  fluidWaveRef.current,
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
      if (chosen === 'bubbles') {
        // Once per frame, before the curves: a mirrored wave paints the same
        // storm twice and must not trigger its rays twice.
        advanceBubbleStorm(
          bubbleStormRef.current,
          toColumns(projected, tuning.columns),
          plot.top,
          baseline,
          motionRef.current.travel[0] ?? 0,
          playingRef.current,
        );
      }

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
            plot.top,
          )
        : '';
      const accent = accentShape ? new Path2D(accentShape) : undefined;
      // Close an explicitly filled wave to the baseline; filling the open
      // curve itself would draw a diagonal wedge between its endpoints.
      const accentFill =
        accentShape && tuning.accentFilled && tuning.accentStyle === 'wave'
          ? new Path2D(
              `${accentShape} L ${projected[projected.length - 1][0]},${baseline} L ${projected[0][0]},${baseline} Z`,
            )
          : undefined;

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
      let accentPeaks = wantsPaintedAccent
        ? getGraphPeaks(projected, chosen, baseline, tuning.columns, plot.top)
        : [];
      if (blinkingSatellites) {
        accentPeaks = scatter.satellites.map(({ x, y, size, crest }) => ({
          x,
          y,
          size,
          // A satellite flashes with its own frequency band, while staying
          // at the quieter sample underneath that band's main square.
          energy: Math.max(0, Math.min(1, (baseline - crest) / depth)),
        }));
      } else if (tuning.accentStyle === 'blink') {
        // Keep a blink inside the space beneath its crest on every form.
        // The normal wave transform also puts it on the correct mirrored side.
        accentPeaks = accentPeaks.map((peak) => ({
          ...peak,
          y: peak.y + Math.max(0, baseline - peak.y) * 0.35,
          size: peak.size * 0.58,
        }));
      }
      const accentHeights: number[] = [];
      const accentPositions: number[] = [];
      if (wantsPaintedAccent) {
        const accentDepth = depth;
        // LED caps belong to the displayed columns, not all analyser bins.
        const accentPoints =
          chosen === 'blocks' && tuning.accentStyle !== 'live'
            ? toColumns(projected, tuning.columns)
            : projected;
        for (let index = 0; index < accentPoints.length; index += 1) {
          accentPositions.push(accentPoints[index][0]);
          accentHeights.push(
            Math.max(
              0,
              Math.min(1, (baseline - accentPoints[index][1]) / accentDepth),
            ),
          );
        }
      }

      if (tuning.accents && tuning.accentStyle !== 'wave') {
        moving =
          advanceGraphAccent({
            behaviour: tuning.accentStyle,
            peaks: accentPeaks,
            heights: accentHeights,
            state: accentStateRef.current,
            deltaMs: motionDeltaMs,
          }) || moving;
      } else if (accentStateRef.current.behaviour !== undefined) {
        accentStateRef.current = createAccentState();
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

      // Under auto a form is painted in its own palette; nothing below this
      // line reads the look's palette directly.
      const paintPalette = resolveGraphPalette(chosen, lookRef.current.palette);
      const paintColours = resolveLookColours(
        paintPalette,
        lookRef.current.colours,
      );
      const isSelfColoured = isSelfColouredLook(paintPalette, paintColours);
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
      // Fluid uses the same bar path for fill and border, so the outline
      // follows the selected density and gap instead of a different figure.
      const needsOutside = isEuphoriaEdge && isFilled && figureStrokeWidth > 0;
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
        const wave = getWaveTransform(
          chosen === 'stalactites'
            ? { ...curve, isFlipped: !curve.isFlipped }
            : curve,
          baseline,
          plot.top,
        );
        if (chosen === 'stalactites') {
          // This figure already grows down from its ceiling. Reflect its
          // coordinate system so height scales around that edge, not the floor.
          wave.translateY += wave.scaleY * (baseline + plot.top);
          wave.scaleY *= -1;
        }
        const bubblePaths =
          chosen === 'bubbles' && wave.scaleY !== 0
            ? createBubblePaths(
                toColumns(projected, tuning.columns),
                plot.top,
                baseline,
                wave.scaleY,
                motionRef.current.travel[0] ?? 0,
                tuning.gap,
                isFilled,
                bubbleStormRef.current,
              )
            : undefined;
        const dotPaths =
          chosen === 'dots' && wave.scaleY !== 0
            ? createDotPaths(
                toColumns(projected, tuning.columns),
                baseline,
                plot.top,
                tuning.gap,
                wave.scaleY,
                tuning.connectingLine,
              )
            : undefined;
        const dots = bubblePaths ?? dotPaths;
        const curveFigure = dots?.shape ?? figure;
        let curveOutside = outside;
        if (dots && needsOutside) {
          const bleed = figureStrokeWidth + 1;
          curveOutside = new Path2D();
          curveOutside.rect(
            plot.left - bleed,
            Math.min(0, baseline * wave.scaleY) - bleed,
            plot.right - plot.left + bleed * 2,
            Math.abs(baseline * wave.scaleY) + bleed * 2,
          );
          curveOutside.addPath(curveFigure);
        }
        context.save();
        if (chosen === 'bubbles') {
          const shake = bubbleShake(
            bubbleStormRef.current,
            motionRef.current.travel[0] ?? 0,
          );
          context.translate(shake.x, shake.y);
        }
        if (pulsePaths) {
          const shake = pulseShake(
            pulseMonitorRef.current,
            motionRef.current.travel[0] ?? 0,
          );
          context.translate(shake.x, shake.y);
        }
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
          paintPalette,
          paintColours,
          curve.colour,
          plot,
          // Only `heat` reads it, and for that one the loudness IS the colour.
          energy,
        );
        // Flat must stay one colour for Wave forms too. Geometry cannot
        // override the palette that the button and Edit panel report.
        const canvasPaint = toCanvasPaint(context, basePaint);
        const paintFor = (paint: TracePaint) =>
          paint === basePaint ? canvasPaint : toCanvasPaint(context, paint);
        if (dashTrails) {
          context.strokeStyle = canvasPaint;
          dashTrails.forEach((trail) => {
            setAlpha(context, opacity * trail.opacity);
            context.lineWidth = strokeWidth * trail.width;
            context.stroke(trail.path);
          });
        }

        const paintPeaks = () => {
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
               * The accent shares the look's palette, so custom colours and
               * Flat remain consistent with the figure underneath it.
               */
              context.save();
              context.lineJoin = 'round';
              context.lineCap = 'round';
              if (accentFill) {
                setAlpha(context, opacity * 0.2);
                context.fillStyle = canvasPaint;
                context.fill(accentFill);
              }
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
                (isEuphoric ? TRACE_BLUR_RAINBOW : 0) *
                (tuning.glow / DEFAULT_GLOW);
              setAlpha(context, opacity);
              context.strokeStyle = canvasPaint;
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
                  top: plot.top,
                  left: plot.left,
                  right: plot.right,
                  state: accentStateRef.current,
                  weight: tuning.accentWidth,
                  filled: tuning.accentFilled,
                  paint: paintFor(
                    chosen === 'blocks' || tuning.accentStyle === 'blink'
                      ? basePaint
                      : resolveAccentStroke(basePaint, euphoria),
                  ),
                })
              ) {
                // A mote still in the air is motion, even once the music has
                // stopped — the loop has to keep drawing until it lands.
                moving = true;
              }
            }
          }
        };

        // One beat-driven glow for every form, gated by Rainbow mode. Keeping
        // wave shadows separate made Glow work while its slider was disabled.
        if (haloPath) {
          if (dots) {
            context.save();
            context.scale(1, 1 / wave.scaleY);
          }
          context.strokeStyle = paintFor(
            resolveGlowStroke(basePaint, isSelfColoured, euphoria),
          );
          GLOW_LAYERS.forEach((layer) => {
            setAlpha(context, layer.opacity * lit);
            context.lineWidth = strokeWidth + layer.widen * swell;
            context.stroke(
              dots?.beads ??
                scatterPaths?.primary ??
                stemLayers?.tips ??
                haloPath,
            );
          });
          if (dots) {
            context.restore();
          }
        }

        if (tuning.accentBehind) {
          paintPeaks();
        }
        if (dots) {
          context.save();
          context.scale(1, 1 / wave.scaleY);
        }

        // One drawing for every style. A filled style paints the same shape
        // rather than stroking it — which is a fill, not a second figure, so
        // cycling styles never changes what is drawn, only how.
        if (roadPaths && !isFilled) {
          // Filled off: the whole scene as a wireframe, and depth is line
          // weight — the far range a hairline, the hillside heavier, the
          // near lane heaviest. Nothing is filled, so the layers read by
          // their edges alone.
          const wire = (path: Path2D, alpha: number, widthPx: number) => {
            context.strokeStyle = canvasPaint;
            context.lineWidth = widthPx;
            setAlpha(context, opacity * alpha);
            context.stroke(path);
          };
          context.fillStyle = '#fff';
          setAlpha(context, opacity * 0.5);
          context.fill(roadPaths.brightStars);
          wire(roadPaths.moon, 0.7, 1);
          wire(roadPaths.far, 0.3, 0.8);
          wire(roadPaths.farTrees, 0.28, 0.6);
        }
        if (roadPaths && isFilled) {
          // The night sky: stars, then the moon and its halo.
          context.fillStyle = '#fff';
          setAlpha(context, opacity * 0.35);
          context.fill(roadPaths.stars);
          setAlpha(context, opacity * 0.9);
          context.fill(roadPaths.brightStars);
          const [mx, my, mr] = roadPaths.moonCentre;
          const moonlight = context.createRadialGradient(mx, my, 0, mx, my, mr);
          moonlight.addColorStop(0, 'rgba(255,255,255,0.28)');
          moonlight.addColorStop(1, 'rgba(255,255,255,0)');
          context.fillStyle = moonlight;
          setAlpha(context, opacity);
          context.fill(roadPaths.moonHalo);
          context.fillStyle = '#fff';
          setAlpha(context, opacity * 0.85);
          context.fill(roadPaths.moon);
          // Behind the hillside: the far range, seen through air — lit at
          // its ridge, sinking into haze — and its tree line.
          context.fillStyle = canvasPaint;
          setAlpha(context, opacity * 0.2);
          context.fill(roadPaths.far);
          const haze = context.createLinearGradient(
            0,
            roadPaths.rangeTop,
            0,
            baseline,
          );
          haze.addColorStop(0, 'rgba(255,255,255,0.16)');
          haze.addColorStop(0.5, 'rgba(0,0,0,0.25)');
          haze.addColorStop(1, 'rgba(0,0,0,0.6)');
          context.fillStyle = haze;
          setAlpha(context, opacity);
          context.fill(roadPaths.far);
          context.fillStyle = canvasPaint;
          setAlpha(context, opacity * 0.28);
          context.fill(roadPaths.farTrees);
        }
        if (connector) {
          context.fillStyle = canvasPaint;
          setAlpha(context, opacity * (isFilled ? tuning.fillOpacity : 1));
          context.fill(connector);
        }
        if (scatterPaths) {
          context.fillStyle = canvasPaint;
          setAlpha(context, opacity * tuning.fillOpacity * 0.38);
          if (!blinkingSatellites) {
            context.fill(scatterPaths.secondary);
          }
          setAlpha(context, opacity * tuning.fillOpacity);
          context.fill(scatterPaths.primary);
        } else if (terraceTiers) {
          context.fillStyle = canvasPaint;
          context.strokeStyle = canvasPaint;
          terraceTiers.forEach((tier, index) => {
            setAlpha(context, opacity * tuning.fillOpacity * tier.opacity);
            context.fill(tier.body, 'evenodd');
            setAlpha(context, opacity * (index === 0 ? 0.85 : 0.3));
            context.lineWidth = index === 0 ? 1.6 : 1;
            context.stroke(tier.edge);
          });
        } else if (stemLayers) {
          context.fillStyle = canvasPaint;
          stemLayers.lines.forEach((path, level) => {
            const fade = 1 - (level + 0.5) / STEM_FADE_LEVELS;
            setAlpha(
              context,
              opacity * tuning.fillOpacity * (0.03 + 0.48 * fade * fade),
            );
            context.fill(path);
          });
          setAlpha(context, opacity * tuning.fillOpacity);
          context.fill(stemLayers.tips);
        } else if (isFluidForm && isFilled) {
          // The titlebar's own bars, from the titlebar's own painter. The hue
          // sweep is the form's own fill — it is what makes this drawing this
          // drawing — but WHETHER it is filled, and how solidly, are settings
          // like anywhere else.
          setAlpha(context, opacity * tuning.fillOpacity);
          paintSpectrumBars(
            context,
            {
              x: fluidLeft,
              y: plot.top,
              width: fluidRight - fluidLeft,
              height: depth,
            },
            fluidBarsRef.current,
            isEuphoric,
            /**
             * All three keep the form's treatment and differ in what the
             * hue is taken FROM — position at two widths, or the bar's own
             * loudness. A palette that filled flat instead stopped being
             * this drawing.
             */
            SPECTRUM_HUE_BY_PALETTE[paintPalette],
            tuning.gap,
            // Brighter at the top than the titlebar, and faded identically —
            // see the constant's own note.
            GRAPH_BAR_LIFT,
            // Level is a meter: the ramp is pinned to the plot and each bar
            // shows its own slice of it, so a colour is a decibel.
            createFluidBarPaint(
              context,
              paintPalette,
              paintColours,
              plot.top,
              baseline,
            ),
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
            context.fillStyle = heatColour(paintColours, piece.energy);
            context.fill(piece.path);
          });
        } else if (isFilled) {
          // The fill and the stroke are composited separately here, where SVG
          // composited the element as a group. The only place the two differ is
          // the sliver where a translucent stroke sits over its own fill, and
          // buying that back would mean an offscreen layer per frame.
          setAlpha(context, opacity * tuning.fillOpacity);
          context.fillStyle = canvasPaint;
          context.fill(curveFigure);
        }
        if (bubblePaths) {
          // The glassy body, faint so what is behind still shows through.
          context.fillStyle = canvasPaint;
          setAlpha(context, opacity * 0.09);
          context.fill(bubblePaths.body);
          // Light on the film: a hard glint high-left, a soft band low-right.
          context.fillStyle = '#fff';
          setAlpha(context, opacity * 0.85);
          context.fill(bubblePaths.glints);
          context.strokeStyle = '#fff';
          context.lineWidth = 1.6;
          setAlpha(context, opacity * 0.28);
          context.stroke(bubblePaths.refraction);
          // A burst: the rim expands and fades over four age batches, the
          // freshest first, while droplets fly off it.
          context.strokeStyle = canvasPaint;
          context.lineWidth = 1.4;
          bubblePaths.rings.forEach((batch, ageStep) => {
            setAlpha(context, opacity * (1 - ageStep / 4) * 0.75);
            context.stroke(batch);
          });
          context.fillStyle = '#fff';
          setAlpha(context, opacity * 0.7);
          context.fill(bubblePaths.droplets);
          // A strike is light, not a line: a wide soft glow in the look's
          // colour, a tighter one over it, and a thin white core. Batch 0 is
          // the freshest and brightest; the whole thing is gone in 180ms.
          bubblePaths.bolts.forEach((batch, ageStep) => {
            const strength = 1 - ageStep / 4;
            context.strokeStyle = canvasPaint;
            context.lineWidth = 7;
            setAlpha(context, opacity * strength * 0.22);
            context.stroke(batch);
            context.lineWidth = 2.6;
            setAlpha(context, opacity * strength * 0.55);
            context.stroke(batch);
            context.strokeStyle = '#fff';
            context.lineWidth = 1;
            setAlpha(context, opacity * strength);
            context.stroke(batch);
          });
        }
        if (echoPaths) {
          // The horizon the waves roll toward: a faint line, brightest
          // in the middle where they converge.
          const glow = context.createLinearGradient(
            plot.left,
            0,
            plot.right,
            0,
          );
          glow.addColorStop(0, 'rgba(255,255,255,0)');
          glow.addColorStop(0.5, 'rgba(255,255,255,0.35)');
          glow.addColorStop(1, 'rgba(255,255,255,0)');
          context.strokeStyle = glow;
          context.lineWidth = 1;
          setAlpha(context, opacity);
          const horizon = new Path2D();
          horizon.moveTo(plot.left, echoPaths.horizon);
          horizon.lineTo(plot.right, echoPaths.horizon);
          context.stroke(horizon);
          // Back to front: each past wave dimmer and thinner with depth, a
          // beat's wave heavier and brighter all the way back.
          echoPaths.waves.forEach((wave) => {
            const remaining = (1 - wave.depth) ** 1.5;
            if (wave.body) {
              context.fillStyle = canvasPaint;
              setAlpha(
                context,
                opacity * tuning.fillOpacity * 0.14 * remaining,
              );
              context.fill(wave.body);
            }
            context.strokeStyle = canvasPaint;
            context.lineWidth = 1 + wave.strength * 1.6;
            setAlpha(
              context,
              opacity * remaining * (0.45 + wave.strength * 0.5),
            );
            context.stroke(wave.line);
            if (wave.strength > 0.3) {
              context.strokeStyle = '#fff';
              context.lineWidth = 0.8;
              setAlpha(context, opacity * remaining * wave.strength * 0.6);
              context.stroke(wave.line);
            }
          });
        }
        if (pulsePaths) {
          const clock = motionRef.current.travel[0] ?? 0;
          const thump = pulseThump(pulseMonitorRef.current, clock);
          // Echoes of past beats passing behind, each drifting up and away.
          pulseMonitorRef.current.echoes.forEach((echo) => {
            const drift = echoDrift(echo, clock, depth);
            if (drift.glow <= 0) {
              return;
            }
            context.save();
            context.translate(drift.x, drift.y);
            context.strokeStyle = canvasPaint;
            context.lineWidth = 1.4;
            setAlpha(context, opacity * drift.glow * 0.55);
            context.stroke(echo.path);
            context.restore();
          });
          // The previous sweep, dim, then the tail brightening toward the
          // head: colour wide and faint under a white core.
          context.strokeStyle = canvasPaint;
          context.lineWidth = 1.2;
          setAlpha(context, opacity * 0.3);
          context.stroke(pulsePaths.old);
          pulsePaths.fresh.forEach((slice, index) => {
            const nearness = (index + 1) / 4;
            context.strokeStyle = canvasPaint;
            context.lineWidth = 3 + thump * 3;
            setAlpha(context, opacity * nearness * (0.35 + thump * 0.3));
            context.stroke(slice);
            context.strokeStyle = '#fff';
            context.lineWidth = 1.2 + thump;
            setAlpha(context, opacity * (0.3 + nearness * 0.7));
            context.stroke(slice);
          });
          // The write-head: a dot that flares on the thump.
          const [headX, headY] = pulsePaths.head;
          const dot = new Path2D();
          dot.arc(headX, headY, 2.5 + thump * 4, 0, Math.PI * 2);
          context.fillStyle = canvasPaint;
          setAlpha(context, opacity * 0.5);
          context.fill(dot);
          const core = new Path2D();
          core.arc(headX, headY, 1.6 + thump * 2, 0, Math.PI * 2);
          context.fillStyle = '#fff';
          setAlpha(context, opacity);
          context.fill(core);
        }
        if (sawTrace) {
          const scope = sawtoothScopeRef.current;
          const clock = motionRef.current.travel[0] ?? 0;
          const flare = sawtoothFlare(scope, clock);
          // Phosphor: the last few beams, oldest faintest, so a moving wave
          // has a tail behind it.
          context.strokeStyle = canvasPaint;
          context.lineWidth = 1.4;
          scope.ghosts.forEach((ghost) => {
            setAlpha(context, opacity * 0.3 * ghostGlow(ghost, clock));
            context.stroke(ghost.path);
          });
          // The beam: the look's colour wide and faint, white thin and bright
          // on top, both swelling on a beat.
          context.strokeStyle = canvasPaint;
          context.lineWidth = 3 + flare * 5;
          setAlpha(context, opacity * (0.35 + flare * 0.4));
          context.stroke(sawTrace);
          context.strokeStyle = '#fff';
          context.lineWidth = 1.1 + flare * 1.4;
          setAlpha(context, opacity * (0.85 + flare * 0.15));
          context.stroke(sawTrace);
          // Sparks off the tips.
          context.fillStyle = '#fff';
          setAlpha(context, opacity * 0.9);
          context.fill(createSparkPath(scope, clock, baseline, plot.top));
        }
        if (mineralPaths) {
          context.fillStyle = '#000';
          setAlpha(context, opacity * tuning.fillOpacity * 0.25);
          context.fill(mineralPaths.shade);
          context.fillStyle = '#fff';
          setAlpha(context, opacity * tuning.fillOpacity * 0.24);
          context.fill(mineralPaths.light);
        }
        if (terraceJumper) {
          setAlpha(context, opacity);
          paintTerraceJumper(
            context,
            terraceJumper,
            plot.right - plot.left,
            depth * Math.abs(wave.scaleY),
          );
        }
        const figureStroke = resolveFigureStroke(
          basePaint,
          isFilled,
          tuning.border,
          isSelfColoured,
          euphoria,
        );
        // Stroked must draw Fluid too; excluding it erased the bars while
        // the designer continued offering Weight and Border controls.
        // The monitor's beam IS its outline: stroking the figure as well
        // painted the whole trace bright over the sweep and hid it.
        if (
          figureStroke !== undefined &&
          figureStrokeWidth > 0 &&
          !pulsePaths
        ) {
          setAlpha(context, opacity);
          context.strokeStyle = paintFor(figureStroke);
          if (curveOutside) {
            // A painted form: the border goes round the outside of the fill,
            // double weight through the mask built above. See the note there.
            context.save();
            context.clip(curveOutside, 'evenodd');
            context.lineWidth = figureStrokeWidth * 2;
            context.stroke(curveFigure);
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
            context.stroke(curveFigure);
            context.strokeStyle = canvasPaint;
            context.lineWidth = strokeWidth;
            context.stroke(curveFigure);
          } else {
            // Either the look's own edge, or a trace with no colours of its own
            // for the sweep to take away. Centred, as it has always been.
            context.lineWidth = figureStrokeWidth;
            context.stroke(curveFigure);
          }
        }

        if (dots) {
          context.restore();
        }
        if (trussRoad) {
          setAlpha(context, opacity);
          paintTrussCars(context, trussRoad, trussTrafficRef.current);
        }
        if (roadPaths && !isFilled) {
          const trip = roadTripRef.current;
          const wire = (path: Path2D, alpha: number, widthPx: number) => {
            context.strokeStyle = canvasPaint;
            context.lineWidth = widthPx;
            setAlpha(context, opacity * alpha);
            context.stroke(path);
          };
          // The road's two edges over the hillside's own outline, the lane
          // line between them, then the two lanes at two weights with the
          // verge trees between.
          wire(roadPaths.edges, 0.6, 1);
          wire(roadPaths.dashes, 0.45, 1);
          const wireLane = (lane: RoadLane, weight: number, alpha: number) => {
            wire(lane.body, alpha, weight);
            wire(lane.cabin, alpha * 0.7, weight * 0.8);
            wire(lane.wheels, alpha, weight * 0.8);
            wire(lane.wheelRims, alpha * 0.8, weight * 0.6);
            context.fillStyle = '#fff';
            setAlpha(context, opacity * alpha * (0.5 + trip.glow * 0.5));
            context.fill(lane.lamps);
            context.fillStyle = canvasPaint;
            setAlpha(context, opacity * alpha * (0.4 + trip.glow * 0.6));
            context.fill(lane.tail);
          };
          wireLane(roadPaths.farLane, 0.9, 0.55);
          wire(roadPaths.near, 0.75, 1);
          wireLane(roadPaths.nearLane, 1.4, 1);
        }
        if (roadPaths && isFilled) {
          const trip = roadTripRef.current;
          // Ground: lit at the ridge, dark at the foot, grass on the verge.
          const ground = context.createLinearGradient(
            0,
            roadPaths.ridgeTop,
            0,
            baseline,
          );
          ground.addColorStop(0, 'rgba(255,255,255,0.22)');
          ground.addColorStop(0.3, 'rgba(0,0,0,0)');
          ground.addColorStop(1, 'rgba(0,0,0,0.5)');
          context.fillStyle = ground;
          setAlpha(context, opacity);
          context.fill(figure);
          context.strokeStyle = '#000';
          context.lineWidth = 1;
          setAlpha(context, opacity * 0.4);
          context.stroke(roadPaths.tufts);
          // The asphalt along the ridge: a dark stripe with light edges and
          // the centre line between the lanes.
          context.lineWidth = roadPaths.half * 2;
          setAlpha(context, opacity * 0.6);
          context.stroke(roadPaths.asphalt);
          context.strokeStyle = '#fff';
          context.lineWidth = 1;
          setAlpha(context, opacity * 0.4);
          context.stroke(roadPaths.edges);
          context.lineWidth = 1.5;
          setAlpha(context, opacity * 0.6);
          context.stroke(roadPaths.dashes);
          const strength = 0.22 + trip.glow * 0.35 + roadPaths.thump * 0.3;
          const paintLane = (lane: RoadLane, depth: number) => {
            // Every vehicle's glow, then its beam falling off along its
            // length, then the vehicle and its lamps. `depth` dims the far lane.
            context.fillStyle = canvasPaint;
            setAlpha(
              context,
              opacity *
                depth *
                (0.08 + trip.glow * 0.18 + roadPaths.thump * 0.12),
            );
            context.fill(lane.halo);
            lane.beams.forEach((beam) => {
              const [fx, fy] = beam.from;
              const [bx, by] = beam.to;
              const light = context.createLinearGradient(fx, fy, bx, by);
              light.addColorStop(
                0,
                'rgba(255,255,255,STRENGTH)'.replace(
                  'STRENGTH',
                  (strength * depth).toFixed(3),
                ),
              );
              light.addColorStop(1, 'rgba(255,255,255,0)');
              context.fillStyle = light;
              setAlpha(context, opacity);
              context.fill(beam.path);
            });
            context.fillStyle = canvasPaint;
            setAlpha(context, opacity * depth);
            context.fill(lane.body);
            context.fillStyle = '#000';
            setAlpha(context, opacity * (0.5 + (1 - depth) * 0.3));
            context.fill(lane.body);
            context.fillStyle = canvasPaint;
            setAlpha(context, opacity * depth);
            context.fill(lane.body);
            context.fillStyle = '#000';
            setAlpha(context, opacity * 0.5);
            context.fill(lane.cabin);
            context.fill(lane.wheels);
            context.strokeStyle = '#fff';
            context.lineWidth = 1;
            setAlpha(context, opacity * 0.6 * depth);
            context.stroke(lane.wheels);
            context.stroke(lane.wheelRims);
            context.fillStyle = '#fff';
            setAlpha(context, opacity * depth * (0.6 + trip.glow * 0.4));
            context.fill(lane.lamps);
            // Tail lights breathing with the level, in the look's colour.
            context.fillStyle = canvasPaint;
            setAlpha(context, opacity * depth * (0.35 + trip.glow * 0.65));
            context.fill(lane.tail);
            context.fillStyle = '#fff';
            setAlpha(context, opacity * depth * trip.glow * 0.5);
            context.fill(lane.tail);
          };
          // The far lane, then the verge trees in front of it, then the
          // near lane in front of the trees: three depths.
          paintLane(roadPaths.farLane, 0.7);
          context.fillStyle = canvasPaint;
          setAlpha(context, opacity * 0.9);
          context.fill(roadPaths.near);
          context.fillStyle = '#000';
          setAlpha(context, opacity * 0.55);
          context.fill(roadPaths.near);
          context.fillStyle = '#fff';
          setAlpha(context, opacity * (0.12 + trip.glow * 0.25));
          context.fill(roadPaths.lit);
          paintLane(roadPaths.nearLane, 1);
        }
        if (!tuning.accentBehind) {
          paintPeaks();
        }

        context.restore();
      });

      const transitioning = transitionRef.current.paint(context, now);
      return transitioning || moving || (isEuphoric && tuning.border);
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
      transitionRef.current.reset();
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
    isRainbow,
    isPaused,
    kickFrames,
    look,
    points,
    waveform,
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
