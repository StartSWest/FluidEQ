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
import {
  canGraphFill,
  canGraphGlow,
  isDiscreteGraphStyle,
  resolveGraphPalette,
  type Projected,
} from 'common/graphStyles';
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
  hasGraphAmbientMotion,
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
import {
  advanceTrussBridge,
  createTrussBridge,
  createTrussBridgePaths,
  FADE_BANDS,
  LEVEL_BINS,
} from './trussBridge';
import {
  advanceTerraceValley,
  createTerraceValley,
  createTerraceValleyPaths,
  TERRACE_CLOUD,
  TERRACE_FIREFLY,
  TERRACE_MOON,
} from './terraceValley';
import {
  advanceCitySkyline,
  CITY_BEACON,
  CITY_MOON,
  CITY_TOWER_COLOURS,
  CITY_WINDOW,
  createCitySkyline,
  createCitySkylinePaths,
} from './citySkyline';
import { createNightSurfaces, paintMist, paintMoonHalo } from './terraceNight';
import {
  advanceCrystalSpikes,
  createCrystalSpikes,
  createCrystalSpikesPaths,
} from './crystalSpikes';
import {
  advanceBraidStage,
  createBraidStage,
  createBraidStagePaths,
} from './braidStage';
import {
  advanceCountryFence,
  createCountryFence,
  createCountryFencePaths,
  FENCE_FIREFLY,
  FENCE_GRAIN,
  FENCE_GRASS,
  FENCE_GRASS_LIT,
  FENCE_HILL_FAR,
  FENCE_HILL_NEAR,
  FENCE_RAIL,
  FENCE_SKY_HORIZON,
  FENCE_SKY_TOP,
  FENCE_SUN,
  FENCE_TREE_DARK,
  FENCE_TREE_LIGHT,
  FENCE_TRUNK,
  FENCE_WOOD_COLOURS,
} from './countryFence';
import {
  advanceRainstorm,
  createRainstorm,
  createRainstormPaths,
  STORM_BOLT,
  STORM_CLOUD_COLOURS,
  STORM_RAIN,
  STORM_WATER,
  stormShake,
} from './rainstorm';
import {
  advanceBonfire,
  BARK_COLOUR,
  COAL_COLOUR,
  GRAIN_COLOUR,
  createBonfire,
  createBonfirePaths,
  FIRE_COLOURS,
  FIRE_CORE,
  FIRE_MID,
  LOG_COLOUR,
  SMOKE_COLOUR,
} from './bonfire';
import {
  advanceStoneArcade,
  ARCADE_MORTAR,
  ARCADE_SHADE,
  ARCADE_SKY_COLOURS,
  ARCADE_STONE,
  ARCADE_WATER,
  createStoneArcade,
  createStoneArcadePaths,
} from './stoneArcade';
import {
  advanceWarpTunnel,
  createWarpTunnel,
  createWarpTunnelPaths,
} from './warpTunnel';
import {
  advanceSpaceInvasion,
  createSpaceInvasion,
  createSpaceInvasionPaths,
  invasionShake,
} from './spaceInvasion';
import {
  advanceCaveDrips,
  CAVE_CEILING,
  CAVE_ROCK_COLOURS,
  CAVE_WATER,
  createCaveDrips,
  createCaveDripsPaths,
} from './caveDrips';
import createSlopeFlow from './slopeFlow';
import {
  advanceSlopeField,
  createSlopeField,
  createSlopeFieldPaths,
  smoothSlopeColumns,
} from './slopeField';
import { resolveLookWaveform, useLookPreviewPoints } from './lookPreview';
import { SILENT_POINTS } from './liveSpectrumFrames';
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
 * The halo is painted at this fraction of the canvas's resolution and
 * scaled up. It is two wide, faint, round-capped strokes — soft by nature —
 * so a third of the pixels look identical once stretched, and the raster
 * cost, which is width times length times pixels, falls by nine. Measured
 * on the five-strand braid at 2560 wide: 21ms a frame to 11.
 */
const HALO_SCALE = 1 / 3;

/**
 * The sea is painted at a third of the resolution and stretched over the
 * frame, for the same reason the halo is.
 *
 * Nine translucent strips the width of the scene are a full screen of
 * alpha blending every frame, and that alone held the bridge at three
 * times the frame budget on a 1440p display while the profile showed the
 * script idle — turning the strips off brought it back to the floor and
 * changing their count did nothing, because the cost is the area, not the
 * geometry. Water is smooth and the swells are tens of pixels apart, so a
 * third of the pixels is a ninth of the blending and nothing anyone can
 * see.
 */
const SEA_SCALE = 1 / 3;

/**
 * How coarse the blocky surface is.
 *
 * A third of the resolution with the smoothing off is sharp, but the
 * steps are three pixels and nobody reads that as blocky — it looks like
 * a slightly rough drawing. A tenth makes a block a block, which is the
 * point, and costs a hundredth of the blending rather than a ninth.
 */
const BLOCK_SCALE = 1 / 10;

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
  const motionRef = useRef(createGraphMotionState());
  const terraceJumperRef = useRef(createTerraceJumper());
  const trussBridgeRef = useRef(createTrussBridge());
  const caveDripsRef = useRef(createCaveDrips());
  const caveClockRef = useRef(0);
  const invasionRef = useRef(createSpaceInvasion());
  const invasionClockRef = useRef(0);
  const warpRef = useRef(createWarpTunnel());
  const warpClockRef = useRef(0);
  const arcadeRef = useRef(createStoneArcade());
  const arcadeClockRef = useRef(0);
  const bonfireRef = useRef(createBonfire());
  const bonfireClockRef = useRef(0);
  const stormRef = useRef(createRainstorm());
  const stormClockRef = useRef(0);
  const fenceRef = useRef(createCountryFence());
  const fenceClockRef = useRef(0);
  const braidStageRef = useRef(createBraidStage());
  const braidClockRef = useRef(0);
  const crystalRef = useRef(createCrystalSpikes());
  const crystalClockRef = useRef(0);
  const valleyRef = useRef(createTerraceValley());
  const valleyClockRef = useRef(0);
  const nightRef = useRef(createNightSurfaces());
  const cityRef = useRef(createCitySkyline());
  const cityClockRef = useRef(0);
  /** Stems: each band's live level last frame, and until when its head flares. */
  const stemLevelsRef = useRef<number[]>([]);
  const stemFlareRef = useRef<number[]>([]);
  const stemClockRef = useRef(0);
  /** The low-resolution surface the halo is painted on, kept between frames. */
  const haloCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const seaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveProjectedRef = useRef<[number, number][]>([]);
  // The bridge keeps its own clock, advanced while its scenery is visible.
  const trussClockRef = useRef(0);
  const slopeFlowRef = useRef(0);
  const slopeFieldRef = useRef(createSlopeField());
  const slopeClockRef = useRef(0);
  const bubbleStormRef = useRef(createBubbleStorm());
  const sawtoothScopeRef = useRef(createSawtoothScope());
  const pulseMonitorRef = useRef(createPulseMonitor());
  const echoWavesRef = useRef(createEchoWaves());
  const roadTripRef = useRef(createRoadTrip());
  const dashTrailsRef = useRef(createDashTrails());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visibleRef = useRef(true);
  const intersectionRef = useRef<IntersectionObserver | null>(null);
  const transitionRef = useRef(new GraphLookTransition());
  // Held rather than fetched per frame: the computed style is a live object
  // bound to the element, and it goes stale with the context if the canvas is
  // ever replaced, so the two are taken together.
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const computedRef = useRef<CSSStyleDeclaration | null>(null);

  // Only the live trace has a look; every other curve on this chart is the
  // user's own tuning and has one right way to be drawn.
  const look = useGraphLook();
  const ambient = hasGraphAmbientMotion(look.style);
  playingRef.current = ambient || !isPaused;
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
  const previewPoints = useLookPreviewPoints(livePoints, look.id);
  const points = useMemo(() => {
    if ((!ambient || !isPaused) && previewPoints.length > 0) {
      return previewPoints;
    }
    // Zero-energy drawing coordinates, so the form stays on screen through
    // silence instead of the element leaving the document. No invented FFT
    // levels or beats enter the analyser or the scene — every band reads the
    // floor, which is what an analyser looks like with nothing playing.
    //
    // Scenery already did this and everything else did not, so the moment the
    // music stopped a line, a bar chart or a ribbon simply vanished off the
    // plot and the panel looked broken rather than quiet.
    if (previewPoints.length > 0) {
      return previewPoints.map(({ x }) => ({ x, y: MIN_GAIN }));
    }
    return SILENT_POINTS;
  }, [ambient, isPaused, previewPoints]);
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
      if (!canvas || !context || !visibleRef.current || document.hidden) {
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
      // The frame as it arrived, projected the same way: what the scenes'
      // beat trackers read. The eased trace above is what is DRAWN, and its
      // attack and release are a look's choice; a beat read from it arrived
      // late and soft, which is what "it lags" was.
      if (liveProjectedRef.current.length !== data.length) {
        liveProjectedRef.current = data.map(() => [0, 0] as [number, number]);
      }
      const liveProjected = liveProjectedRef.current;
      for (let index = 0; index < eased.length; index += 1) {
        const x = Number(xScale(eased[index].x)) || 0;
        projected[index][0] =
          stretch === 1 ? x : plot.left + (x - firstX) * stretch;
        projected[index][1] = Number(yScale(eased[index].y)) || 0;
        [liveProjected[index][0]] = projected[index];
        liveProjected[index][1] = Number(yScale(data[index].y)) || 0;
      }

      // The pixel row the filled styles stand on — the bottom of the plot, and
      // the row every orientation below is measured from.
      const baseline = plot.bottom;
      // The plot's depth, so the pump can say how full the figure is as a
      // fraction rather than in pixels — which is what keeps it reading the
      // same on a short card and a full-screen one.
      const depth = Math.max(1, plot.bottom - plot.top);
      /**
       * Scenes are built in the screen's vertical scale and painted with
       * the wave scaling undone, so a car, a tree or a spark keeps its shape
       * under the height slider instead of being squashed with the curve,
       * and the mirror shows a true reflection of it. `sceneScale` is the
       * shared |scaleY|. Sprites are sized from the true plot depth, not the
       * scaled one.
       */
      const sceneScale = heightScale || 1;
      const sceneTop = plot.top * sceneScale;
      const sceneBase = baseline * sceneScale;
      const sceneSpace = (points: readonly Projected[]): Projected[] =>
        points.map(([x, y]) => [x, y * sceneScale]);
      /**
       * EVERY form is built in scene space and painted with the wave's
       * stretch undone. The height slider used to scale the finished
       * drawing, so a low setting squashed every LED cell, stem tip, dash
       * and mark into a sliver; built at the rendered height instead, a
       * form ADAPTS — fewer cells, the same square cell — and only the
       * level moves. The scenes always worked this way; now it is the rule.
       */
      const figurePoints = sceneSpace(projected);
      /** The plot's box in that same space, for the colour ramps. */
      const scenePlot = {
        left: plot.left,
        right: plot.right,
        top: sceneTop,
        bottom: sceneBase,
      };

      /**
       * The whole window, in scene space.
       *
       * A scene's sky and sea are scenery, not the figure: they reach the
       * edges of the window at every height setting, while the bridge, the
       * tiers or the towers under them answer the slider. Inverting the
       * first curve's placement gives the rows the screen's edges land on.
       */
      const skyFrame = (() => {
        const placed = getWaveTransform(curves[0], baseline, plot.top);
        const sign = placed.scaleY < 0 ? -1 : 1;
        const a = -placed.translateY / sign;
        const b = (height - placed.translateY) / sign;
        return {
          left: 0,
          right: width,
          top: Math.min(a, b, sceneTop),
          bottom: Math.max(a, b, sceneBase),
        };
      })();

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
              sceneSpace(toColumns(projected, tuning.columns)),
              sceneBase,
              tuning.gap,
            )
          : undefined;
      // The scope's beam: the wave itself, stroked bright over the body.
      const sawTrace =
        chosen === 'sawtooth'
          ? new Path2D(
              createGraphSawtooth(
                sceneSpace(toColumns(projected, tuning.columns)),
                sceneBase,
                motionRef.current.travel[0] ?? 0,
              ).trace,
            )
          : undefined;
      if (sawTrace) {
        advanceSawtoothScope(
          sawtoothScopeRef.current,
          sawTrace,
          sceneSpace(toColumns(projected, tuning.columns)),
          sceneTop,
          sceneBase,
          motionRef.current.travel[0] ?? 0,
          playingRef.current,
        );
      }
      // The monitor decides its beat first and hands back its own figure,
      // pumped by the thump; the static shape is never built for it.
      if (chosen === 'ecg') {
        advancePulseMonitor(
          pulseMonitorRef.current,
          sceneSpace(toColumns(projected, tuning.columns)),
          sceneTop,
          sceneBase,
          motionRef.current.travel[0] ?? 0,
          playingRef.current,
        );
      }
      const pulsePaths =
        chosen === 'ecg'
          ? createPulsePaths(
              pulseMonitorRef.current,
              sceneSpace(toColumns(projected, tuning.columns)),
              sceneBase,
              motionRef.current.travel[0] ?? 0,
            )
          : undefined;
      // Echo keeps its own past and hands back the live wave as the figure;
      // the static stack is never built for it.
      if (chosen === 'echo') {
        advanceEchoWaves(
          echoWavesRef.current,
          sceneSpace(toColumns(projected, SNAPSHOT_COLUMNS)),
          sceneTop,
          sceneBase,
          motionRef.current.travel[0] ?? 0,
          playingRef.current,
        );
      }
      const echoPaths =
        chosen === 'echo'
          ? createEchoWavePaths(
              echoWavesRef.current,
              sceneSpace(projected),
              sceneTop,
              sceneBase,
              motionRef.current.travel[0] ?? 0,
              isFilled,
            )
          : undefined;
      // The bridge: the deck is its figure, the truss and the rest are scenery.
      const trussColumns =
        chosen === 'truss'
          ? sceneSpace(toColumns(projected, tuning.columns))
          : undefined;
      if (trussColumns && playingRef.current) {
        trussClockRef.current += motionDeltaMs / 1000;
        moving = true;
      }
      if (trussColumns) {
        advanceTrussBridge(
          trussBridgeRef.current,
          trussColumns,
          sceneSpace(toColumns(liveProjected, tuning.columns)),
          sceneTop,
          sceneBase,
          trussClockRef.current,
          playingRef.current,
        );
      }
      const trussPaths = trussColumns
        ? createTrussBridgePaths(
            trussBridgeRef.current,
            trussColumns,
            sceneBase,
            sceneTop,
            trussClockRef.current,
            depth,
            skyFrame,
          )
        : undefined;
      // The cave: the rock is its figure; the pool, the drips and the
      // ripples are scenery. Its clock runs only while music plays.
      const caveColumns =
        chosen === 'stalactites'
          ? sceneSpace(toColumns(projected, tuning.columns))
          : undefined;
      if (caveColumns && playingRef.current) {
        caveClockRef.current += motionDeltaMs / 1000;
        moving = true;
      }
      if (caveColumns) {
        advanceCaveDrips(
          caveDripsRef.current,
          caveColumns,
          sceneSpace(toColumns(liveProjected, tuning.columns)),
          sceneTop,
          sceneBase,
          caveClockRef.current,
          playingRef.current,
          tuning.gap,
          depth,
        );
      }
      const cavePaths = caveColumns
        ? createCaveDripsPaths(
            caveDripsRef.current,
            caveColumns,
            sceneTop,
            sceneBase,
            caveClockRef.current,
            depth,
          )
        : undefined;
      // The space fight: the formation is its figure, the rest is scenery.
      const invasionColumns =
        chosen === 'invaders'
          ? sceneSpace(toColumns(projected, tuning.columns))
          : undefined;
      if (invasionColumns && playingRef.current) {
        invasionClockRef.current += motionDeltaMs / 1000;
        moving = true;
      }
      if (invasionColumns) {
        advanceSpaceInvasion(
          invasionRef.current,
          invasionColumns,
          sceneSpace(toColumns(liveProjected, tuning.columns)),
          sceneTop,
          sceneBase,
          invasionClockRef.current,
          playingRef.current,
          depth,
        );
      }
      const invasionPaths = invasionColumns
        ? createSpaceInvasionPaths(
            invasionRef.current,
            invasionColumns,
            sceneTop,
            sceneBase,
            invasionClockRef.current,
            depth,
          )
        : undefined;
      // Hyperspace: the streaks are its figure, the sky and the rest scenery.
      const warpColumns =
        chosen === 'starfield'
          ? sceneSpace(toColumns(projected, tuning.columns))
          : undefined;
      if (warpColumns && playingRef.current) {
        warpClockRef.current += motionDeltaMs / 1000;
        moving = true;
      }
      if (warpColumns) {
        advanceWarpTunnel(
          warpRef.current,
          warpColumns,
          sceneSpace(toColumns(liveProjected, tuning.columns)),
          sceneTop,
          sceneBase,
          warpClockRef.current,
          playingRef.current,
        );
      }
      const warpPaths = warpColumns
        ? createWarpTunnelPaths(
            warpRef.current,
            warpColumns,
            sceneTop,
            sceneBase,
            warpClockRef.current,
          )
        : undefined;
      // The aqueduct: the openings are its figure, the stone is scenery.
      const arcadeColumns =
        chosen === 'arches'
          ? sceneSpace(toColumns(projected, tuning.columns))
          : undefined;
      if (arcadeColumns && playingRef.current) {
        arcadeClockRef.current += motionDeltaMs / 1000;
        moving = true;
      }
      if (arcadeColumns) {
        advanceStoneArcade(
          arcadeRef.current,
          arcadeColumns,
          sceneSpace(toColumns(liveProjected, tuning.columns)),
          sceneTop,
          sceneBase,
          arcadeClockRef.current,
          playingRef.current,
        );
      }
      const arcadePaths = arcadeColumns
        ? createStoneArcadePaths(
            arcadeRef.current,
            arcadeColumns,
            sceneTop,
            sceneBase,
            arcadeClockRef.current,
            depth,
          )
        : undefined;
      // The fire: the outer tongues are its figure, the rest is scenery.
      const fireColumns =
        chosen === 'flames'
          ? sceneSpace(toColumns(projected, tuning.columns))
          : undefined;
      if (fireColumns && playingRef.current) {
        bonfireClockRef.current += motionDeltaMs / 1000;
        moving = true;
      }
      if (fireColumns) {
        advanceBonfire(
          bonfireRef.current,
          fireColumns,
          sceneSpace(toColumns(liveProjected, tuning.columns)),
          sceneTop,
          sceneBase,
          bonfireClockRef.current,
          playingRef.current,
        );
      }
      const firePaths = fireColumns
        ? createBonfirePaths(
            bonfireRef.current,
            fireColumns,
            sceneTop,
            sceneBase,
            bonfireClockRef.current,
            depth,
          )
        : undefined;
      // The storm: the cloud is its figure, the rain and the water scenery.
      const stormColumns =
        chosen === 'rain'
          ? sceneSpace(toColumns(projected, tuning.columns))
          : undefined;
      if (stormColumns && playingRef.current) {
        stormClockRef.current += motionDeltaMs / 1000;
        moving = true;
      }
      if (stormColumns) {
        advanceRainstorm(
          stormRef.current,
          stormColumns,
          sceneSpace(toColumns(liveProjected, tuning.columns)),
          sceneTop,
          sceneBase,
          stormClockRef.current,
          playingRef.current,
        );
      }
      const stormPaths = stormColumns
        ? createRainstormPaths(
            stormRef.current,
            stormColumns,
            sceneTop,
            sceneBase,
            stormClockRef.current,
            depth,
          )
        : undefined;
      // The countryside: the pickets are its figure, the rest is scenery.
      const fenceColumns =
        chosen === 'fence'
          ? sceneSpace(toColumns(projected, tuning.columns))
          : undefined;
      if (fenceColumns && playingRef.current) {
        fenceClockRef.current += motionDeltaMs / 1000;
        moving = true;
      }
      if (fenceColumns) {
        advanceCountryFence(
          fenceRef.current,
          fenceColumns,
          sceneSpace(toColumns(liveProjected, tuning.columns)),
          sceneTop,
          sceneBase,
          fenceClockRef.current,
          playingRef.current,
        );
      }
      const fencePaths = fenceColumns
        ? createCountryFencePaths(
            fenceRef.current,
            fenceColumns,
            sceneTop,
            sceneBase,
            fenceClockRef.current,
            depth,
          )
        : undefined;
      // The braid's stage: not a scene — the braid itself is still the
      // motion module's figure in plot space — but a floor under it and
      // motes over it, built in the same plot space so the wave transform
      // carries them with the figure.
      const braidColumns =
        chosen === 'braid'
          ? sceneSpace(toColumns(projected, tuning.columns))
          : undefined;
      if (braidColumns && playingRef.current) {
        braidClockRef.current += motionDeltaMs / 1000;
        moving = true;
      }
      if (braidColumns) {
        advanceBraidStage(
          braidStageRef.current,
          braidColumns,
          sceneSpace(toColumns(liveProjected, tuning.columns)),
          sceneTop,
          sceneBase,
          braidClockRef.current,
          playingRef.current,
        );
      }
      const stagePaths = braidColumns
        ? createBraidStagePaths(
            braidStageRef.current,
            braidColumns,
            sceneTop,
            sceneBase,
            braidClockRef.current,
            depth,
          )
        : undefined;
      // The spikes' light: faces and glints over the figure, in plot space.
      const spikeColumns =
        chosen === 'spikes'
          ? sceneSpace(toColumns(projected, tuning.columns))
          : undefined;
      if (spikeColumns && playingRef.current) {
        crystalClockRef.current += motionDeltaMs / 1000;
        moving = true;
      }
      if (spikeColumns) {
        advanceCrystalSpikes(
          crystalRef.current,
          spikeColumns,
          sceneSpace(toColumns(liveProjected, tuning.columns)),
          sceneTop,
          sceneBase,
          crystalClockRef.current,
          playingRef.current,
        );
      }
      const crystalPaths = spikeColumns
        ? createCrystalSpikesPaths(
            crystalRef.current,
            spikeColumns,
            sceneTop,
            sceneBase,
            crystalClockRef.current,
            depth,
          )
        : undefined;
      // The terrace and its valley, both in scene space: the height slider
      // moves the tiers, and the sky, the moon and the jumper keep their
      // shape. The sky's frame is the whole screen, taken from the first
      // curve's placement, so it fills the canvas at any height setting.
      const valleyColumns =
        chosen === 'terrace'
          ? sceneSpace(toColumns(projected, tuning.columns))
          : undefined;
      const terraceScene = valleyColumns
        ? createGraphTerrace(valleyColumns, sceneBase)
        : undefined;
      if (valleyColumns && playingRef.current) {
        valleyClockRef.current += motionDeltaMs / 1000;
        moving = true;
      }
      if (valleyColumns) {
        advanceTerraceValley(
          valleyRef.current,
          valleyColumns,
          sceneSpace(toColumns(liveProjected, tuning.columns)),
          sceneTop,
          sceneBase,
          valleyClockRef.current,
          playingRef.current,
        );
      }
      const valleyPaths = valleyColumns
        ? createTerraceValleyPaths(
            valleyRef.current,
            valleyColumns,
            sceneTop,
            sceneBase,
            valleyClockRef.current,
            depth,
            skyFrame,
          )
        : undefined;
      // The night city: the towers are the figure, this is the light in
      // them and the sky over them. Scene space, like the terrace.
      const cityColumns =
        chosen === 'skyline'
          ? sceneSpace(toColumns(projected, tuning.columns))
          : undefined;
      if (cityColumns && playingRef.current) {
        cityClockRef.current += motionDeltaMs / 1000;
        moving = true;
      }
      if (cityColumns) {
        advanceCitySkyline(
          cityRef.current,
          cityColumns,
          sceneSpace(toColumns(liveProjected, tuning.columns)),
          sceneTop,
          sceneBase,
          cityClockRef.current,
          playingRef.current,
        );
      }
      const cityPaths = cityColumns
        ? createCitySkylinePaths(
            cityRef.current,
            cityColumns,
            sceneTop,
            sceneBase,
            cityClockRef.current,
            depth,
            tuning.gap,
            skyFrame,
          )
        : undefined;
      // The road trip likewise: the band is its figure, the rest is scenery.
      const roadPoints =
        chosen === 'racer'
          ? sceneSpace(toColumns(projected, ROAD_COLUMNS))
          : undefined;
      if (roadPoints) {
        advanceRoadTrip(
          roadTripRef.current,
          roadPoints,
          sceneTop,
          sceneBase,
          motionRef.current.travel[0] ?? 0,
          playingRef.current,
        );
      }
      const roadPaths = roadPoints
        ? createRoadTripPaths(
            roadTripRef.current,
            roadPoints,
            sceneTop,
            sceneBase,
            motionRef.current.travel[0] ?? 0,
            depth,
          )
        : undefined;
      // The field the slope's arrows live in: a grid of ticks over the
      // whole window, and motes drifting along it. Scene space, like every
      // other scene, and the window's frame because it is scenery.
      const fieldColumns =
        chosen === 'slope'
          ? smoothSlopeColumns(sceneSpace(toColumns(projected, tuning.columns)))
          : undefined;
      if (fieldColumns && playingRef.current) {
        slopeClockRef.current += motionDeltaMs / 1000;
        moving = true;
      }
      if (fieldColumns) {
        advanceSlopeField(
          slopeFieldRef.current,
          fieldColumns,
          sceneSpace(toColumns(liveProjected, tuning.columns)),
          sceneTop,
          sceneBase,
          slopeClockRef.current,
          playingRef.current,
          skyFrame,
        );
      }
      const fieldPaths = fieldColumns
        ? createSlopeFieldPaths(
            slopeFieldRef.current,
            fieldColumns,
            sceneTop,
            sceneBase,
            slopeClockRef.current,
            depth,
            skyFrame,
          )
        : undefined;
      const isSceneForm = Boolean(
        pulsePaths ||
        echoPaths ||
        roadPaths ||
        trussPaths ||
        cavePaths ||
        invasionPaths ||
        warpPaths ||
        arcadePaths ||
        firePaths ||
        stormPaths ||
        fencePaths ||
        valleyPaths ||
        sawTrace,
      );
      /** Painted in scene space — see `figurePoints`. */
      const isScene = true;
      let shape =
        stems?.shape ??
        (isSceneForm && chosen !== 'sawtooth' ? '' : undefined) ??
        (isFluidForm
          ? spectrumBarsPath(
              {
                x: fluidLeft,
                y: sceneTop,
                width: fluidRight - fluidLeft,
                height: sceneBase - sceneTop,
              },
              fluidBarsRef.current,
              tuning.gap,
            )
          : createGraphShape(
              figurePoints,
              chosen,
              sceneBase,
              tuning.columns,
              // Read through a ref rather than closed over: this loop runs on
              // its own frames, and the envelope arrives on the pump's.
              fluidWaveRef.current,
              tuning.gap,
              sceneTop,
              isFilled,
              0,
              tuning.connectingLine,
            ));
      if (chosen === 'slope' && playingRef.current) {
        slopeFlowRef.current = (slopeFlowRef.current + motionDeltaMs / 480) % 1;
        moving = true;
      }
      const slopeFlow = fieldColumns
        ? createSlopeFlow(
            fieldColumns,
            slopeFlowRef.current,
            sceneBase,
            tuning.gap,
          )
        : undefined;
      if (slopeFlow) {
        shape = slopeFlow.path;
      }
      /**
       * Whose drawing is allowed outside the plot's box: a scene's own, the
       * city's sky, which stands above the towers, and the slope's field,
       * which fills the window around the arrows.
       *
       * Declared here rather than with the rest of the frame's flags: it reads
       * `fieldPaths`, and asking for that above its own `const` is a temporal
       * dead zone — the canvas would throw on the first frame of every scene.
       */
      const overflowsPlot =
        isSceneForm || Boolean(cityPaths) || Boolean(fieldPaths);
      if (
        hasGraphMotion(chosen) &&
        !invasionPaths &&
        !warpPaths &&
        !firePaths &&
        !stormPaths
      ) {
        const motion = createMovingGraphShape({
          state: motionRef.current,
          points: figurePoints,
          style: chosen,
          columns: tuning.columns,
          top: sceneTop,
          bottom: sceneBase,
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
          ? createGraphScatter(figurePoints, tuning.columns, tuning.gap)
          : undefined;
      const blinkingSatellites =
        scatter && tuning.accents && tuning.accentStyle === 'blink';
      const figure =
        pulsePaths?.shape ??
        echoPaths?.shape ??
        roadPaths?.shape ??
        trussPaths?.shape ??
        cavePaths?.shape ??
        invasionPaths?.shape ??
        warpPaths?.shape ??
        arcadePaths?.shape ??
        firePaths?.shape ??
        stormPaths?.shape ??
        fencePaths?.shape ??
        (terraceScene
          ? new Path2D(isFilled ? terraceScene.shape : terraceScene.outline)
          : undefined) ??
        new Path2D(
          blinkingSatellites && chosen === 'scatter' ? scatter.primary : shape,
        );
      const connector =
        tuning.connectingLine &&
        chosen !== 'dots' &&
        canConnectGraphMarks(chosen)
          ? new Path2D(
              createGraphConnector(
                sceneSpace(toColumns(projected, tuning.columns)),
              ),
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
              sceneSpace(toColumns(projected, tuning.columns)),
              sceneBase,
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
      const terraceJumper = valleyColumns
        ? advanceTerraceJumper(
            terraceJumperRef.current,
            valleyColumns,
            motionDeltaMs,
            playingRef.current,
          )
        : undefined;
      if (terraceJumper && playingRef.current) {
        moving = true;
      }
      const terraceTiers =
        terraceScene && isFilled
          ? terraceScene.tiers.map((tier) => ({
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
              // The heads on the beat: a band whose live level jumped since
              // the last frame flares for FLARE_HOLD seconds of the music's
              // clock. Read from the live frame, not the drawn one — the
              // stems' attack is one millisecond, so the drawn head is never
              // behind the live one and a comparison there fired nothing.
              hot: (() => {
                const FLARE_HOLD = 0.14;
                const eased = toColumns(projected, tuning.columns);
                const placed = sceneSpace(eased);
                const live = toColumns(liveProjected, tuning.columns);
                if (playingRef.current) {
                  stemClockRef.current += motionDeltaMs / 1000;
                }
                const now = stemClockRef.current;
                if (stemLevelsRef.current.length !== live.length) {
                  stemLevelsRef.current = live.map(() => 0);
                  stemFlareRef.current = live.map(() => -1);
                }
                const spacing =
                  eased.length > 1
                    ? (eased[eased.length - 1][0] - eased[0][0]) /
                      (eased.length - 1)
                    : 1;
                const size = Math.max(
                  2.4,
                  Math.min(12, spacing * (1 - tuning.gap)),
                );
                const hot = new Path2D();
                eased.forEach((_column, index) => {
                  const [x, y] = placed[index];
                  const level = Math.max(
                    0,
                    Math.min(
                      1,
                      (baseline - (live[index]?.[1] ?? baseline)) / depth,
                    ),
                  );
                  if (
                    level - stemLevelsRef.current[index] >= 0.05 &&
                    level >= 0.1
                  ) {
                    stemFlareRef.current[index] = now + FLARE_HOLD;
                  }
                  stemLevelsRef.current[index] = level;
                  if (stemFlareRef.current[index] > now) {
                    hot.rect(x - size / 2, y - size / 2, size, size);
                  }
                });
                return hot;
              })(),
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
              figurePoints,
              chosen,
              sceneBase,
              tuning.columns,
              tuning.gap,
              sceneTop,
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
      // The glow is a look's own setting in any mode. It used to need rainbow
      // mode, which made the Glow slider a dead control everywhere else and
      // tied a light that is the figure's own colour to a mode about hue.
      if (tuning.glow > 0 && canGraphGlow(chosen)) {
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
          pulsePaths || echoPaths || roadPaths || trussPaths ? 0 : shape.length,
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
      // No halo under hyperspace: its figure is a hundred and twenty
      // screen-long lines, and two wide gradient strokes over them cost more
      // than the rest of the frame — every stroke wider than 4px skipped took
      // the frame from 16-40ms to a flat 10ms. Its streaks carry their own
      // narrow glow instead.
      const haloPath =
        warpPaths ||
        firePaths ||
        arcadePaths ||
        invasionPaths ||
        cavePaths ||
        stormPaths ||
        fencePaths
          ? undefined
          : halo;
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
            figurePoints,
            chosen,
            sceneBase,
            fluidWaveRef.current,
            tuning.accentStyle,
            sceneTop,
          )
        : '';
      const accent = accentShape ? new Path2D(accentShape) : undefined;
      // Close an explicitly filled wave to the baseline; filling the open
      // curve itself would draw a diagonal wedge between its endpoints.
      const accentFill =
        accentShape && tuning.accentFilled && tuning.accentStyle === 'wave'
          ? new Path2D(
              `${accentShape} L ${projected[projected.length - 1][0]},${sceneBase} L ${projected[0][0]},${sceneBase} Z`,
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
        ? getGraphPeaks(
            figurePoints,
            chosen,
            sceneBase,
            tuning.columns,
            sceneTop,
          )
        : [];
      if (blinkingSatellites) {
        accentPeaks = scatter.satellites.map(({ x, y, size, crest }) => ({
          x,
          y,
          size,
          // A satellite flashes with its own frequency band, while staying
          // at the quieter sample underneath that band's main square.
          energy: Math.max(
            0,
            Math.min(1, (sceneBase - crest) / (sceneBase - sceneTop)),
          ),
        }));
      } else if (tuning.accentStyle === 'blink') {
        // Keep a blink inside the space beneath its crest on every form.
        // The normal wave transform also puts it on the correct mirrored side.
        accentPeaks = accentPeaks.map((peak) => ({
          ...peak,
          y: peak.y + Math.max(0, sceneBase - peak.y) * 0.35,
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
      // Auto with no colours of its own: a scene may paint itself the way
      // the real thing looks, not only in one of the offered ramps.
      const ownColours =
        lookRef.current.palette === 'auto' &&
        lookRef.current.colours.length === 0;
      const caveOwnColours = ownColours && chosen === 'stalactites';
      const arcadeOwnColours = ownColours && chosen === 'arches';
      const fireOwnColours = ownColours && chosen === 'flames';
      const stormOwnColours = ownColours && chosen === 'rain';
      const fenceOwnColours = ownColours && chosen === 'fence';
      const cityOwnColours = ownColours && chosen === 'skyline';
      let paintColours = resolveLookColours(
        paintPalette,
        lookRef.current.colours,
      );
      if (ownColours && chosen === 'truss') {
        // The bridge's own colouring cycles the wheel: a full turn every
        // twenty seconds of music, one hue for the whole structure.
        paintColours = [
          `hsl(${((trussClockRef.current * 18) % 360).toFixed(0)}, 85%, 62%)`,
        ];
      } else if (caveOwnColours) {
        paintColours = CAVE_ROCK_COLOURS;
      } else if (arcadeOwnColours) {
        paintColours = ARCADE_SKY_COLOURS;
      } else if (fireOwnColours) {
        paintColours = FIRE_COLOURS;
      } else if (stormOwnColours) {
        paintColours = STORM_CLOUD_COLOURS;
      } else if (fenceOwnColours) {
        paintColours = FENCE_WOOD_COLOURS;
      } else if (cityOwnColours) {
        paintColours = CITY_TOWER_COLOURS;
      }
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

      context.lineCap = 'round';
      context.lineJoin = 'round';

      curves.forEach((curve) => {
        const wave = getWaveTransform(curve, baseline, plot.top);
        const bubblePaths =
          chosen === 'bubbles' && wave.scaleY !== 0
            ? createBubblePaths(
                toColumns(projected, tuning.columns),
                plot.top,
                baseline,
                Math.abs(wave.scaleY),
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
                Math.abs(wave.scaleY),
                tuning.connectingLine,
              )
            : undefined;
        const dots = bubblePaths ?? dotPaths;
        const curveFigure = dots?.shape ?? figure;
        // Everything a scene draws is in scene space: the wave's vertical
        // STRETCH undone but its flip kept, so a mirrored curve shows the
        // scene's reflection — cars and towers upside down in the lower
        // half, the way water would show them — rather than a squashed copy
        // or a second landscape.
        const enterSceneSpace = () => {
          context.save();
          context.scale(1, 1 / Math.abs(wave.scaleY));
        };
        /**
         * Paint something big and soft at a third of the resolution.
         *
         * A screen of translucent fill is what these scenes cost to
         * raster — the bridge's sea and the echo's rows of water each held
         * their look at three times the frame budget on a 1440p display
         * while the profile showed the script idle. Painted on a surface a
         * third the size under the same transform and stretched back over
         * this one, the blending is a ninth of the pixels and the result
         * is water, which has no edges to lose. Without a surface (a
         * context lost, a canvas that will not give one) the caller's own
         * drawing runs here at full cost.
         */
        const paintOnSurface = (
          draw: (target: CanvasRenderingContext2D) => void,
          { scale, smooth }: { scale: number; smooth: boolean },
        ) => {
          const surface =
            seaCanvasRef.current ?? document.createElement('canvas');
          seaCanvasRef.current = surface;
          const surfaceWidth = Math.max(1, Math.ceil(canvas.width * scale));
          const surfaceHeight = Math.max(1, Math.ceil(canvas.height * scale));
          if (
            surface.width !== surfaceWidth ||
            surface.height !== surfaceHeight
          ) {
            surface.width = surfaceWidth;
            surface.height = surfaceHeight;
          }
          const surface2d = surface.getContext('2d');
          if (!surface2d) {
            draw(context);
            return;
          }
          const base = context.getTransform();
          surface2d.setTransform(1, 0, 0, 1, 0, 0);
          surface2d.clearRect(0, 0, surfaceWidth, surfaceHeight);
          surface2d.save();
          surface2d.setTransform(
            base.a * scale,
            base.b * scale,
            base.c * scale,
            base.d * scale,
            base.e * scale,
            base.f * scale,
          );
          draw(surface2d);
          surface2d.restore();
          context.save();
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.imageSmoothingEnabled = smooth;
          setAlpha(context, 1);
          context.drawImage(surface, 0, 0, canvas.width, canvas.height);
          context.restore();
        };

        /** Stretched smoothly: water, which has no edges to lose. */
        const paintLowRes = (
          draw: (target: CanvasRenderingContext2D) => void,
        ) => paintOnSurface(draw, { scale: SEA_SCALE, smooth: true });

        /**
         * Stretched WITHOUT smoothing, so a third of the resolution comes
         * back as blocks rather than as a blur.
         *
         * Same cost, and on a drawing made of lines it is the better
         * answer: interpolating a wireframe up softens every edge it has,
         * where nearest-neighbour keeps them hard and the coarseness reads
         * as a choice rather than as a blurry picture.
         */
        const paintBlocky = (
          draw: (target: CanvasRenderingContext2D) => void,
        ) => paintOnSurface(draw, { scale: BLOCK_SCALE, smooth: false });

        /**
         * The whole canvas in this curve's scene space.
         *
         * A scene's sky is scenery, not the figure: it has to reach the top
         * of the window at every height setting, and the plot's own box
         * shrinks with the slider. Inverting this curve's placement gives
         * the rows the screen's edges land on.
         */
        const sceneFrame = (() => {
          const sign = wave.scaleY < 0 ? -1 : 1;
          const a = -wave.translateY / sign;
          const b = (height - wave.translateY) / sign;
          return { top: Math.min(a, b), bottom: Math.max(a, b) };
        })();
        let curveOutside: Path2D | undefined;
        if (needsOutside) {
          const bleed = figureStrokeWidth + 1;
          curveOutside = new Path2D();
          curveOutside.rect(
            plot.left - bleed,
            -bleed,
            plot.right - plot.left + bleed * 2,
            sceneBase + bleed * 2,
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
        if (stormPaths) {
          // Thunder.
          const shake = stormShake(stormRef.current, stormClockRef.current);
          context.translate(shake.x, shake.y);
        }
        if (invasionPaths) {
          // A bolt landing on the ship rocks the whole screen.
          const shake = invasionShake(
            invasionRef.current,
            invasionClockRef.current,
          );
          context.translate(shake.x, shake.y);
        }
        context.translate(0, wave.translateY);
        context.scale(1, wave.scaleY);
        // Clipped in the figure's own space, exactly as the SVG clip path was:
        // it was referenced from inside the same transform, so a half-height
        // wave was already bounded to the half it is drawn in.
        // A scene is never cut off: a firework that bursts above the plot,
        // a spark that flies past its edge, a star in the margin, all of it
        // is allowed to overflow the plot's box. Everything else is clipped
        // to it as the SVG trace always was.
        if (!overflowsPlot) {
          context.beginPath();
          context.rect(
            plot.left,
            -depth,
            plot.right - plot.left,
            baseline + depth,
          );
          context.clip();
        }

        // One descriptor, built once, so the halo and the tips can be tested
        // against it by identity and reuse the gradient the figure already has.
        const basePaint = resolveTracePaint(
          paintPalette,
          paintColours,
          curve.colour,
          // The scene's own box, because the figure is drawn in scene space:
          // handed the plot's, a level ramp spanned a taller box than the
          // figure filled and a short wave took the colours of the ramp's
          // top end only — every band red at a low height setting.
          scenePlot,
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
                  baseline: sceneBase,
                  top: sceneTop,
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

        if (fieldPaths) {
          // The field first, in the look's own colour: the grid of ticks
          // from faintest to brightest, the beat's band leaving the curve,
          // then the motes riding the flow.
          enterSceneSpace();
          context.lineCap = 'butt';
          context.lineJoin = 'round';
          context.strokeStyle = canvasPaint;
          [...fieldPaths.bands].reverse().forEach((band) => {
            context.lineWidth = band.width;
            setAlpha(
              context,
              opacity * band.alpha * (0.85 + fieldPaths.bass * 0.3),
            );
            context.stroke(band.path);
          });
          if (fieldPaths.pulseAlpha > 0) {
            context.lineWidth = Math.max(1, strokeWidth * 0.8);
            setAlpha(context, opacity * fieldPaths.pulseAlpha);
            context.stroke(fieldPaths.pulse);
          }
          context.lineCap = 'round';
          fieldPaths.flow.forEach((band, index) => {
            context.strokeStyle = index === 0 ? '#fff' : canvasPaint;
            context.lineWidth = band.width;
            setAlpha(context, opacity * band.alpha);
            context.stroke(band.path);
          });
          context.restore();
        }
        if (cityPaths) {
          // No sky painted: the stars and the moon stand over whatever is
          // behind the graph, the same as the terrace's night.
          enterSceneSpace();
          context.fillStyle = '#fff';
          cityPaths.stars.forEach((band) => {
            setAlpha(context, opacity * band.alpha);
            context.fill(band.path);
          });
          setAlpha(context, opacity * (0.4 + cityPaths.bass * 0.5));
          paintMoonHalo(
            context,
            nightRef.current,
            cityPaths.moonX,
            cityPaths.moonY,
            cityPaths.moonRadius,
            ratio,
          );
          context.fillStyle = CITY_MOON;
          setAlpha(context, opacity * 0.96);
          context.beginPath();
          context.arc(
            cityPaths.moonX,
            cityPaths.moonY,
            cityPaths.moonRadius,
            0,
            Math.PI * 2,
          );
          context.fill();
          context.fillStyle = '#7d7a8c';
          setAlpha(context, opacity * 0.22);
          context.fill(cityPaths.craters);
          context.restore();
        }
        if (valleyPaths && isFilled) {
          // NO SKY. The night is only the things in it — stars, the moon,
          // clouds, mist — over whatever is behind the graph, so a video
          // playing under the window shows through instead of being
          // covered by a painted gradient.
          enterSceneSpace();
          // The stars: the bright ones twinkle with the treble.
          context.fillStyle = '#fff';
          valleyPaths.stars.forEach((band) => {
            setAlpha(context, opacity * band.alpha);
            context.fill(band.path);
          });
          // The moon's halo breathes with the bass; the moon is a circle in
          // scene space, so the height slider never squashes it.
          setAlpha(context, opacity * (0.45 + valleyPaths.bass * 0.55));
          paintMoonHalo(
            context,
            nightRef.current,
            valleyPaths.moonX,
            valleyPaths.moonY,
            valleyPaths.moonRadius,
            ratio,
          );
          context.fillStyle = TERRACE_MOON;
          setAlpha(context, opacity * 0.96);
          context.beginPath();
          context.arc(
            valleyPaths.moonX,
            valleyPaths.moonY,
            valleyPaths.moonRadius,
            0,
            Math.PI * 2,
          );
          context.fill();
          context.fillStyle = '#7d7a8c';
          setAlpha(context, opacity * 0.22);
          context.fill(valleyPaths.craters);
          // Light, not dark: with no sky behind them the clouds have to
          // stand against whatever is there.
          context.fillStyle = TERRACE_CLOUD;
          setAlpha(context, opacity * 0.22);
          context.fill(valleyPaths.clouds);
          // Two bands of mist between the tiers, thinning as it gets loud.
          setAlpha(context, opacity * valleyPaths.mist);
          // Laid between the tiers as rendered, so it stays on them when
          // the height slider brings them down.
          paintMist(
            context,
            nightRef.current,
            plot.left,
            plot.right,
            sceneBase,
            sceneBase - sceneTop,
            ratio,
          );
          context.restore();
        }

        // One beat-driven glow for every form, gated by Rainbow mode. Keeping
        // wave shadows separate made Glow work while its slider was disabled.
        if (haloPath) {
          // Painted on the low-resolution surface under the same transform
          // and the same clip as this context, then stretched over it. See
          // HALO_SCALE. Without a surface (a context lost, a canvas that
          // will not give one) it is painted here at full cost.
          // The glow is the line's own colour: whatever the figure is stroked
          // with, or its paint when it has no stroke. It used to take the
          // rainbow sweep on a look with no colours of its own, so a green
          // line sat in a hue that was not green.
          const glowPaint = paintFor(
            resolveFigureStroke(
              basePaint,
              isFilled,
              tuning.border,
              isSelfColoured,
              euphoria,
            ) ?? basePaint,
          );
          const glowShape =
            dots?.beads ??
            scatterPaths?.primary ??
            stemLayers?.tips ??
            haloPath;
          const haloCanvas =
            haloCanvasRef.current ?? document.createElement('canvas');
          haloCanvasRef.current = haloCanvas;
          const haloWidth = Math.max(1, Math.ceil(canvas.width * HALO_SCALE));
          const haloHeight = Math.max(1, Math.ceil(canvas.height * HALO_SCALE));
          if (
            haloCanvas.width !== haloWidth ||
            haloCanvas.height !== haloHeight
          ) {
            haloCanvas.width = haloWidth;
            haloCanvas.height = haloHeight;
          }
          const halo2d = haloCanvas.getContext('2d');
          const paintGlow = (target: CanvasRenderingContext2D) => {
            target.strokeStyle = glowPaint;
            target.lineCap = 'round';
            target.lineJoin = 'round';
            GLOW_LAYERS.forEach((layer) => {
              setAlpha(target, layer.opacity * lit);
              target.lineWidth = strokeWidth + layer.widen * swell;
              target.stroke(glowShape);
            });
          };
          if (halo2d) {
            const base = context.getTransform();
            halo2d.setTransform(1, 0, 0, 1, 0, 0);
            halo2d.clearRect(0, 0, haloWidth, haloHeight);
            halo2d.save();
            halo2d.setTransform(
              base.a * HALO_SCALE,
              base.b * HALO_SCALE,
              base.c * HALO_SCALE,
              base.d * HALO_SCALE,
              base.e * HALO_SCALE,
              base.f * HALO_SCALE,
            );
            if (!overflowsPlot) {
              halo2d.beginPath();
              halo2d.rect(
                plot.left,
                -depth,
                plot.right - plot.left,
                baseline + depth,
              );
              halo2d.clip();
            }
            if (isScene) {
              halo2d.scale(1, 1 / Math.abs(wave.scaleY));
            }
            paintGlow(halo2d);
            halo2d.restore();
            context.save();
            context.setTransform(1, 0, 0, 1, 0, 0);
            setAlpha(context, 1);
            context.drawImage(haloCanvas, 0, 0, canvas.width, canvas.height);
            context.restore();
          } else {
            if (isScene) {
              enterSceneSpace();
            }
            paintGlow(context);
            if (isScene) {
              context.restore();
            }
          }
        }

        if (tuning.accentBehind) {
          // BEHIND MEANS HIDDEN BY THE FIGURE, not merely painted first.
          //
          // Painting the marks under the figure was the whole of "behind",
          // and on a filled form it was not enough: a fill is translucent, so
          // a wave mark under LED blocks showed straight through every cell
          // and read as being in front. The marks are clipped to the plot
          // OUTSIDE the figure's body — the same even-odd cut the euphoria
          // edge uses — so under a block they are gone and between blocks
          // they show, which is what behind looks like. A form made of pieces
          // — bars, cells, dots — hides them even when stroked: an outlined
          // LED is still an LED. A stroked continuous line has no body, so
          // it is left as it was.
          const cover = new Path2D();
          context.save();
          if (isScene) {
            context.scale(1, 1 / Math.abs(wave.scaleY));
          }
          if (isFilled || isDiscreteGraphStyle(chosen)) {
            const span = plot.right - plot.left;
            cover.rect(plot.left - span * 2, -depth * 4, span * 5, depth * 8);
            cover.addPath(curveFigure);
            context.clip(cover, 'evenodd');
          }
          paintPeaks();
          context.restore();
        }
        if (isScene) {
          enterSceneSpace();
        }

        // One drawing for every style. A filled style paints the same shape
        // rather than stroking it — which is a fill, not a second figure, so
        // cycling styles never changes what is drawn, only how.
        if (crystalPaths && isFilled) {
          // The floor glows up into the spikes with the bass.
          const floor = context.createLinearGradient(
            0,
            sceneBase - crystalPaths.glowHeight,
            0,
            sceneBase,
          );
          floor.addColorStop(0, 'rgba(255,255,255,0)');
          floor.addColorStop(1, 'rgba(255,255,255,0.07)');
          context.fillStyle = floor;
          setAlpha(context, opacity * (0.3 + crystalPaths.bass * 0.5));
          context.fillRect(
            plot.left,
            sceneBase - crystalPaths.glowHeight,
            plot.right - plot.left,
            crystalPaths.glowHeight,
          );
        }
        if (stagePaths) {
          // The floor in the look's colour, brighter with the bass, and the
          // braid reflected in it: the figure again, flipped about the
          // horizon and squashed to a quarter, clipped to the floor.
          context.strokeStyle = canvasPaint;
          context.lineWidth = 1;
          setAlpha(context, opacity * (0.1 + stagePaths.bass * 0.22));
          context.stroke(stagePaths.floor);
          context.save();
          context.beginPath();
          context.rect(
            plot.left,
            stagePaths.horizon,
            plot.right - plot.left,
            sceneBase - stagePaths.horizon,
          );
          context.clip();
          context.translate(0, stagePaths.horizon);
          context.scale(1, -0.28);
          context.translate(0, -stagePaths.horizon);
          context.lineWidth = Math.max(1, figureStrokeWidth);
          // Faint: at a fifth it read as a second braid under the first.
          setAlpha(context, opacity * 0.1);
          context.stroke(figure);
          context.restore();
        }
        if (fencePaths) {
          // Golden hour, back to front: the sky, the sun's glow breathing
          // with the bass, the clouds, the far hills, the trees, the near
          // hill, then the rails and posts the pickets stand against.
          // Stroked, the land is outlines and the sky is left dark.
          if (isFilled) {
            const sky = context.createLinearGradient(
              0,
              sceneFrame.top,
              0,
              fencePaths.ground,
            );
            sky.addColorStop(0, fenceOwnColours ? FENCE_SKY_TOP : '#000');
            sky.addColorStop(1, fenceOwnColours ? FENCE_SKY_HORIZON : '#000');
            context.fillStyle = sky;
            setAlpha(context, opacity * (fenceOwnColours ? 1 : 0));
            context.fillRect(
              fencePaths.skyFrom,
              sceneFrame.top,
              fencePaths.skyTo - fencePaths.skyFrom,
              fencePaths.ground - sceneFrame.top,
            );
            // The field carries on to the bottom of the window, so a short
            // wave leaves grass under the fence rather than a black band.
            context.fillStyle = fenceOwnColours ? FENCE_HILL_NEAR : '#000';
            context.fillRect(
              fencePaths.skyFrom,
              fencePaths.ground,
              fencePaths.skyTo - fencePaths.skyFrom,
              Math.max(0, sceneFrame.bottom - fencePaths.ground),
            );
            const sun = context.createRadialGradient(
              fencePaths.sunX,
              fencePaths.sunY,
              0,
              fencePaths.sunX,
              fencePaths.sunY,
              fencePaths.sunRadius * 3,
            );
            sun.addColorStop(0, 'rgba(255,241,196,1)');
            sun.addColorStop(0.3, 'rgba(255,220,150,0.55)');
            sun.addColorStop(1, 'rgba(255,200,120,0)');
            context.fillStyle = sun;
            setAlpha(context, opacity * (0.7 + fencePaths.bass * 0.3));
            context.beginPath();
            context.arc(
              fencePaths.sunX,
              fencePaths.sunY,
              fencePaths.sunRadius * 3,
              0,
              Math.PI * 2,
            );
            context.fill();
            context.fillStyle = FENCE_SUN;
            setAlpha(context, opacity * 0.9);
            context.beginPath();
            context.arc(
              fencePaths.sunX,
              fencePaths.sunY,
              fencePaths.sunRadius,
              0,
              Math.PI * 2,
            );
            context.fill();
            context.fillStyle = '#fff';
            setAlpha(context, opacity * 0.55);
            context.fill(fencePaths.clouds);
          }
          const paintLand = (
            path: Path2D,
            colour: string | CanvasGradient,
            alpha: number,
          ) => {
            setAlpha(context, opacity * alpha);
            if (isFilled) {
              context.fillStyle = colour;
              context.fill(path);
            } else {
              context.strokeStyle = colour;
              context.lineWidth = 1;
              context.stroke(path);
            }
          };
          const own = fenceOwnColours;
          paintLand(fencePaths.farHill, own ? FENCE_HILL_FAR : '#3a3a3a', 1);
          paintLand(fencePaths.trunks, own ? FENCE_TRUNK : '#555', 1);
          paintLand(
            fencePaths.canopyDark,
            own ? FENCE_TREE_DARK : '#2a2a2a',
            1,
          );
          paintLand(fencePaths.canopyLight, own ? FENCE_TREE_LIGHT : '#444', 1);
          paintLand(fencePaths.nearHill, own ? FENCE_HILL_NEAR : '#2e2e2e', 1);
          paintLand(fencePaths.rails, own ? FENCE_RAIL : canvasPaint, 0.95);
          paintLand(fencePaths.posts, own ? FENCE_RAIL : canvasPaint, 1);
          context.strokeStyle = own ? FENCE_GRAIN : '#000';
          context.lineWidth = 1;
          setAlpha(context, opacity * 0.5);
          context.stroke(fencePaths.posts);
        }
        if (stormPaths) {
          // The water first, lit at the surface and dark below, glowing with
          // the bass; the rings and splashes of the landings; then the rain
          // falling toward it, the cloud painted over the top of it after.
          const stormWater = stormOwnColours ? STORM_WATER : canvasPaint;
          const stormRain = stormOwnColours ? STORM_RAIN : canvasPaint;
          if (isFilled) {
            context.fillStyle = stormWater;
            setAlpha(context, opacity * (0.55 + stormPaths.bass * 0.3));
            context.fill(stormPaths.pool);
            const poolShade = context.createLinearGradient(
              0,
              stormPaths.water,
              0,
              sceneBase,
            );
            poolShade.addColorStop(0, 'rgba(255,255,255,0.12)');
            poolShade.addColorStop(0.35, 'rgba(0,0,0,0.2)');
            poolShade.addColorStop(1, 'rgba(0,0,0,0.6)');
            context.fillStyle = poolShade;
            setAlpha(context, opacity);
            context.fill(stormPaths.pool);
          }
          context.strokeStyle = '#fff';
          context.lineWidth = 1;
          setAlpha(context, opacity * (0.25 + stormPaths.bass * 0.3));
          context.stroke(stormPaths.surface);
          stormPaths.rings.forEach((band) => {
            setAlpha(context, opacity * band.alpha * 0.6);
            context.stroke(band.path);
          });
          setAlpha(context, opacity * 0.8);
          context.stroke(stormPaths.splashes);
          context.strokeStyle = stormRain;
          context.lineCap = 'round';
          context.lineWidth = 1.2;
          setAlpha(context, opacity * 0.55);
          context.stroke(stormPaths.rain);
          context.fillStyle = '#fff';
          setAlpha(context, opacity * 0.85);
          context.fill(stormPaths.heads);
        }
        if (firePaths) {
          // The smoke first, far behind; then the ground's glow breathing
          // with the bass; then the logs with their coals in the gaps.
          context.fillStyle = SMOKE_COLOUR;
          firePaths.smoke.forEach((band) => {
            setAlpha(context, opacity * band.alpha * 0.6);
            context.fill(band.path);
          });
          if (isFilled) {
            const glow = context.createRadialGradient(
              firePaths.glowX,
              sceneBase,
              0,
              firePaths.glowX,
              sceneBase,
              firePaths.glowRadius,
            );
            glow.addColorStop(0, 'rgba(255,140,40,0.35)');
            glow.addColorStop(0.5, 'rgba(255,90,20,0.1)');
            glow.addColorStop(1, 'rgba(255,60,10,0)');
            context.fillStyle = glow;
            setAlpha(context, opacity * (0.6 + firePaths.bass * 0.4));
            context.beginPath();
            context.arc(
              firePaths.glowX,
              sceneBase,
              firePaths.glowRadius,
              0,
              Math.PI * 2,
            );
            context.fill();
          }
          // The coal bed first, then the logs over it: body, bark grain,
          // the end rings, and the cracks glowing through with the bass.
          const coal = fireOwnColours ? COAL_COLOUR : canvasPaint;
          context.fillStyle = coal;
          setAlpha(context, opacity * (0.35 + firePaths.bass * 0.65));
          context.fill(firePaths.coals);
          if (isFilled) {
            context.fillStyle = fireOwnColours ? LOG_COLOUR : '#1a1a1a';
            setAlpha(context, opacity);
            context.fill(firePaths.logs);
          }
          context.strokeStyle = fireOwnColours ? BARK_COLOUR : canvasPaint;
          context.lineWidth = 1.2;
          setAlpha(context, opacity * (isFilled ? 0.9 : 0.7));
          context.stroke(firePaths.logs);
          context.stroke(firePaths.bark);
          context.strokeStyle = fireOwnColours ? GRAIN_COLOUR : canvasPaint;
          context.lineWidth = 1;
          setAlpha(context, opacity * 0.8);
          context.stroke(firePaths.rings);
          context.strokeStyle = coal;
          context.lineWidth = 1.6;
          setAlpha(context, opacity * (0.3 + firePaths.bass * 0.7));
          context.stroke(firePaths.cracks);
        }
        if (arcadePaths) {
          // The night over the parapet: stars, the twinkling ones brighter,
          // the birds when they cross; then the river, lit at the surface,
          // glowing with the bass, with the arcade reflected in it.
          const arcadeWater = arcadeOwnColours ? ARCADE_WATER : canvasPaint;
          context.fillStyle = '#fff';
          setAlpha(context, opacity * 0.35);
          context.fill(arcadePaths.stars);
          setAlpha(context, opacity * (0.7 + arcadePaths.thump * 0.3));
          context.fill(arcadePaths.brightStars);
          context.strokeStyle = '#fff';
          context.lineWidth = 1.2;
          context.lineJoin = 'round';
          setAlpha(context, opacity * 0.8);
          context.stroke(arcadePaths.birds);
          if (isFilled) {
            context.fillStyle = arcadeWater;
            setAlpha(context, opacity * (0.55 + arcadePaths.bass * 0.25));
            context.fill(arcadePaths.river);
            context.save();
            context.clip(arcadePaths.river);
            context.fillStyle = arcadeOwnColours ? ARCADE_STONE : canvasPaint;
            setAlpha(context, opacity * 0.22);
            context.fill(arcadePaths.reflection);
            context.restore();
            const riverShade = context.createLinearGradient(
              0,
              arcadePaths.water,
              0,
              sceneBase,
            );
            riverShade.addColorStop(0, 'rgba(255,255,255,0.14)');
            riverShade.addColorStop(0.3, 'rgba(0,0,0,0.2)');
            riverShade.addColorStop(1, 'rgba(0,0,0,0.65)');
            context.fillStyle = riverShade;
            setAlpha(context, opacity);
            context.fill(arcadePaths.river);
          }
          context.strokeStyle = '#fff';
          context.lineWidth = 1;
          setAlpha(context, opacity * (0.12 + arcadePaths.bass * 0.15));
          context.stroke(arcadePaths.ripples);
        }
        if (warpPaths) {
          // The sky first, far to near, then the core's glow in the look's
          // colour breathing with the bass, the rings, the rocks; the
          // streaks are the figure and come after, with a glow of their own.
          context.fillStyle = '#fff';
          context.strokeStyle = '#fff';
          context.lineWidth = 1.2;
          context.lineCap = 'round';
          warpPaths.sky.forEach((band, layer) => {
            setAlpha(context, opacity * band.alpha);
            if (layer === 2) {
              context.stroke(band.path);
            } else {
              context.fill(band.path);
            }
          });
          // The core: a white glow that falls off fast, breathing with the
          // bass. A disc of the look's colour here read as a planet.
          const coreRadius = warpPaths.coreRadius * 1.6;
          const core = context.createRadialGradient(
            warpPaths.focusX,
            warpPaths.focusY,
            0,
            warpPaths.focusX,
            warpPaths.focusY,
            coreRadius,
          );
          core.addColorStop(0, 'rgba(255,255,255,0.85)');
          core.addColorStop(0.18, 'rgba(255,255,255,0.28)');
          core.addColorStop(0.5, 'rgba(255,255,255,0.06)');
          core.addColorStop(1, 'rgba(255,255,255,0)');
          context.fillStyle = core;
          setAlpha(context, opacity);
          context.beginPath();
          context.arc(
            warpPaths.focusX,
            warpPaths.focusY,
            coreRadius,
            0,
            Math.PI * 2,
          );
          context.fill();
          // The waves: each with its wake behind it, a soft wide glow under
          // a bright edge.
          warpPaths.rings.forEach((ring) => {
            context.strokeStyle = canvasPaint;
            context.lineWidth = ring.width;
            setAlpha(context, opacity * ring.alpha * 0.3);
            context.stroke(ring.wake);
            context.strokeStyle = '#fff';
            context.lineWidth = ring.width * 1.2;
            setAlpha(context, opacity * ring.alpha * 0.9);
            context.stroke(ring.path);
          });
          // The rocks: dark bodies edged in the look's colour, and lit up
          // white on the beat.
          // The asteroids: the trail first, then a grey body with its far
          // side in shadow and a crater or two, lit white on the beat, edged
          // in the look's colour.
          context.strokeStyle = canvasPaint;
          context.lineWidth = 2;
          setAlpha(context, opacity * (0.25 + warpPaths.thump * 0.35));
          context.stroke(warpPaths.rockTrails);
          context.fillStyle = '#6b6f78';
          setAlpha(context, opacity);
          context.fill(warpPaths.rocks);
          context.fillStyle = '#000';
          setAlpha(context, opacity * 0.45);
          context.fill(warpPaths.rockShade);
          context.fill(warpPaths.craters);
          context.fillStyle = '#fff';
          setAlpha(context, opacity * warpPaths.thump * 0.5);
          context.fill(warpPaths.rocks);
          context.strokeStyle = canvasPaint;
          context.lineWidth = 1.2 + warpPaths.thump * 1.8;
          setAlpha(context, opacity * (0.8 + warpPaths.thump * 0.2));
          context.stroke(warpPaths.rockEdges);
          // No glow pass over the streaks: at 2560 wide the figure's own
          // stroke is already the frame's biggest cost, see the halo note.
        }
        if (invasionPaths) {
          // The star field first, three layers, brighter in warp; then the
          // saucer, the bolts and the lasers, the ship with its engines,
          // the bursts, and a soft glow round the formation before the
          // aliens themselves are painted as the figure.
          context.strokeStyle = '#fff';
          context.lineCap = 'round';
          invasionPaths.stars.forEach((band, layer) => {
            context.lineWidth = 1 + layer * 0.6;
            setAlpha(
              context,
              opacity * band.alpha * (0.7 + invasionPaths.warp * 0.3),
            );
            context.stroke(band.path);
          });
          context.fillStyle = '#ff4d6d';
          setAlpha(context, opacity * 0.95);
          if (isFilled) {
            context.fill(invasionPaths.saucer);
          } else {
            context.strokeStyle = '#ff4d6d';
            context.stroke(invasionPaths.saucer);
          }
          context.strokeStyle = '#ff5d7a';
          context.lineWidth = invasionPaths.unit * 1.6;
          setAlpha(context, opacity * 0.3);
          context.stroke(invasionPaths.bolts);
          context.lineWidth = invasionPaths.unit * 0.6;
          setAlpha(context, opacity * 0.95);
          context.stroke(invasionPaths.bolts);
          context.strokeStyle = '#7dffb0';
          context.lineWidth = invasionPaths.unit * 1.6;
          setAlpha(context, opacity * 0.35);
          context.stroke(invasionPaths.shots);
          context.strokeStyle = '#fff';
          context.lineWidth = invasionPaths.unit * 0.55;
          setAlpha(context, opacity * 0.95);
          context.stroke(invasionPaths.shots);
          // The ship: the pixel fighter — flames first, then hull, canopy
          // and stripes, each its own colour — with a soft glow round the
          // hull that swells on the beat. Stroked, every layer is outlined.
          context.strokeStyle = '#8fd3ff';
          context.lineWidth = 5;
          context.lineJoin = 'round';
          setAlpha(context, opacity * (0.1 + invasionPaths.thump * 0.15));
          context.stroke(invasionPaths.hull);
          const paintPart = (path: Path2D, colour: string, alpha: number) => {
            setAlpha(context, opacity * alpha);
            if (isFilled) {
              context.fillStyle = colour;
              context.fill(path);
            } else {
              context.strokeStyle = colour;
              context.lineWidth = 1;
              context.stroke(path);
            }
          };
          paintPart(invasionPaths.flame, '#ff7a1f', 0.9);
          paintPart(invasionPaths.core, '#fff3b0', 1);
          paintPart(invasionPaths.hull, '#d6dee8', 1);
          paintPart(invasionPaths.stripes, '#ff4d6d', 1);
          paintPart(invasionPaths.canopy, '#6fe6ff', 1);
          context.fillStyle = '#fff';
          setAlpha(context, opacity * 0.95);
          context.fill(invasionPaths.shipFlash);
          context.fill(invasionPaths.muzzle);
          context.fillStyle = '#7fe3ff';
          setAlpha(context, opacity * 0.8);
          context.fill(invasionPaths.shield);
          // The bursts in the alien's own colour, fading.
          context.fillStyle = canvasPaint;
          invasionPaths.bursts.forEach((band) => {
            setAlpha(context, opacity * band.alpha);
            context.fill(band.path);
          });
          // The formation's glow.
          context.strokeStyle = canvasPaint;
          context.lineWidth = 3;
          setAlpha(context, opacity * (0.2 + invasionPaths.thump * 0.2));
          context.stroke(invasionPaths.shape);
        }
        if (cavePaths) {
          // The pool first: dark water in the look's colour, glowing with
          // the bass, with the rock reflected in it, then the rings and the
          // splashes on its surface, then the surface line. Filled, the
          // water is a body; stroked, the surface and the rings alone.
          const caveWater = caveOwnColours ? CAVE_WATER : canvasPaint;
          if (isFilled) {
            context.fillStyle = caveWater;
            setAlpha(context, opacity * (0.5 + cavePaths.bass * 0.25));
            context.fill(cavePaths.pool);
            // The rock's reflection, under the water's own shading so it
            // fades with depth rather than poking out of the floor.
            context.save();
            context.clip(cavePaths.pool);
            context.fillStyle = canvasPaint;
            setAlpha(context, opacity * 0.3);
            context.fill(cavePaths.reflections);
            context.restore();
            // Lit at the surface, dark at the bottom: still water.
            const water = context.createLinearGradient(
              0,
              cavePaths.poolTop,
              0,
              sceneBase,
            );
            water.addColorStop(0, 'rgba(255,255,255,0.18)');
            water.addColorStop(0.3, 'rgba(0,0,0,0.25)');
            water.addColorStop(1, 'rgba(0,0,0,0.7)');
            context.fillStyle = water;
            setAlpha(context, opacity);
            context.fill(cavePaths.pool);
          }
          context.strokeStyle = '#fff';
          context.lineWidth = 1;
          cavePaths.ripples.forEach((band) => {
            setAlpha(context, opacity * band.alpha * 0.5);
            context.stroke(band.path);
          });
          context.lineWidth = 1.2;
          setAlpha(context, opacity * 0.8);
          context.stroke(cavePaths.splash);
          context.lineWidth = 1;
          setAlpha(context, opacity * (0.3 + cavePaths.bass * 0.35));
          context.stroke(cavePaths.surface);
        }
        if (trussPaths) {
          // The sky first: dim stars, then the twinkling ones, which flare
          // with the beat.
          context.fillStyle = '#fff';
          setAlpha(context, opacity * 0.3);
          context.fill(trussPaths.stars);
          setAlpha(context, opacity * (0.7 + trussPaths.thump * 0.3));
          context.fill(trussPaths.brightStars);
          // The truss under the deck: four bands from the deck down, each
          // fainter than the one above, so the members sink into the dark;
          // within each, the members whose band is loud burn brighter, and
          // on a beat the whole truss glows wider for a moment.
          /**
           * The truss under the deck: four bands from the deck down, each
           * fainter than the one above, so the members sink into the dark;
           * within each, the members whose band is loud burn brighter, and
           * on a beat the whole truss glows wider for a moment.
           *
           * The glow pass goes on the low-resolution surface with the
           * water. It is the widest stroking in the scene — twelve passes
           * over every member of a full-screen truss at six pixels — and
           * it was ten milliseconds a frame on its own, which is the whole
           * frame budget for a blur nobody can see the edge of.
           */
          const bridgeGlow = trussPaths.thump;
          const paintMembers = (
            target: CanvasRenderingContext2D,
            glowing: boolean,
          ) => {
            trussPaths.members.forEach((band, depth) => {
              const fade = 0.9 - (depth / FADE_BANDS) * 0.75;
              band.forEach((members, bin) => {
                const burn = 0.45 + (bin / (LEVEL_BINS - 1)) * 0.75;
                target.strokeStyle = canvasPaint;
                if (glowing) {
                  target.lineWidth =
                    Math.max(1, strokeWidth * 0.7) + 5 * bridgeGlow;
                  setAlpha(target, opacity * fade * burn * bridgeGlow * 0.35);
                } else {
                  target.lineWidth = Math.max(1, strokeWidth * 0.7);
                  setAlpha(target, opacity * Math.min(1, fade * burn));
                }
                target.stroke(members);
              });
            });
          };
          paintMembers(context, false);
          context.strokeStyle = canvasPaint;
          setAlpha(context, opacity * 0.25);
          context.stroke(trussPaths.footing);
          // The sea behind the bridge: each swell a strip of the look's
          // colour, faint at the horizon and deeper as it nears, every
          // other one a shade darker so the swells read against each other
          // without a line on the water; brighter with the bass that lifts
          // it, under a thin bright horizon.
          const seaLift = 0.8 + trussPaths.bass * 0.5;
          const hazeTop = trussPaths.horizon - trussPaths.horizonHaze;
          const paintSea = (target: CanvasRenderingContext2D) => {
            if (bridgeGlow > 0) {
              paintMembers(target, true);
            }
            target.fillStyle = canvasPaint;
            trussPaths.sea.forEach((strip, index) => {
              const near = (index + 1) / trussPaths.sea.length;
              const shade = index % 2 === 0 ? 1 : 0.7;
              setAlpha(target, opacity * (0.06 + near * 0.3) * shade * seaLift);
              target.fill(strip);
            });
            // A band of haze sitting on the waterline, thicker with the
            // bass: without it the sea ended at a drawn line with black
            // above it. On the water's surface, because it is a soft
            // gradient over the same wide area and costs the same to blend.
            const haze = target.createLinearGradient(
              0,
              hazeTop,
              0,
              trussPaths.horizon + trussPaths.horizonHaze * 0.4,
            );
            haze.addColorStop(0, 'rgba(255,255,255,0)');
            haze.addColorStop(0.72, 'rgba(255,255,255,0.1)');
            haze.addColorStop(1, 'rgba(255,255,255,0)');
            target.fillStyle = haze;
            setAlpha(target, opacity * (0.5 + trussPaths.bass * 0.5));
            target.fillRect(
              plot.left - (plot.right - plot.left),
              hazeTop,
              (plot.right - plot.left) * 3,
              trussPaths.horizonHaze * 1.4,
            );
          };
          paintLowRes(paintSea);
          context.strokeStyle = '#fff';
          context.lineWidth = 1;
          setAlpha(context, opacity * 0.22);
          context.beginPath();
          context.moveTo(
            plot.left - (plot.right - plot.left),
            trussPaths.horizon,
          );
          context.lineTo(
            plot.right + (plot.right - plot.left),
            trussPaths.horizon,
          );
          context.stroke();
          // The suspension: piers and towers standing in the water, dark
          // silhouettes edged in the look's colour, or solid in the colour
          // when filled; the bracing between the legs, hangers faint, the
          // main cables bright.
          context.fillStyle = isFilled ? canvasPaint : '#000';
          setAlpha(context, opacity * (isFilled ? 0.95 : 0.7));
          context.fill(trussPaths.piers);
          context.fill(trussPaths.towers);
          context.fill(trussPaths.towersBelow);
          context.strokeStyle = canvasPaint;
          context.lineWidth = 1.2;
          setAlpha(context, opacity * 0.7);
          context.stroke(trussPaths.piers);
          setAlpha(context, opacity * 0.9);
          context.stroke(trussPaths.towers);
          context.stroke(trussPaths.towersBelow);
          context.lineWidth = 0.9;
          setAlpha(context, opacity * 0.55);
          context.stroke(trussPaths.bracing);
          context.stroke(trussPaths.bracingBelow);
          context.lineWidth = 0.8;
          setAlpha(context, opacity * 0.4);
          context.stroke(trussPaths.hangers);
          // The cables pump with the bass: a fine wire that thickens a little
          // and brightens with the kick, with a narrow tint of the look's
          // colour under it — a wide glow here eclipsed the rest of the scene.
          context.strokeStyle = canvasPaint;
          context.lineWidth = 2 + trussPaths.bass * 2.5;
          setAlpha(context, opacity * (0.12 + trussPaths.bass * 0.25));
          context.stroke(trussPaths.cables);
          context.strokeStyle = '#fff';
          context.lineWidth =
            1 + trussPaths.bass * 1.2 + trussPaths.thump * 0.5;
          setAlpha(
            context,
            opacity * (0.45 + trussPaths.bass * 0.45 + trussPaths.thump * 0.1),
          );
          context.stroke(trussPaths.cables);
        }
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
          if (valleyPaths) {
            // A retaining wall in shadow under every shelf, and the rim
            // above it catching the moon — brighter on the beat.
            context.fillStyle = '#000';
            setAlpha(context, opacity * 0.38);
            context.fill(valleyPaths.walls);
            context.strokeStyle = TERRACE_MOON;
            context.lineWidth = 1;
            setAlpha(context, opacity * (0.28 + valleyPaths.thump * 0.3));
            context.stroke(valleyPaths.rims);
          }
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
          // The heads glow in their own colour, and the ones on the beat
          // flare: a wider halo and a white core that the fill cannot give.
          context.strokeStyle = canvasPaint;
          context.lineJoin = 'round';
          context.lineWidth = 5;
          setAlpha(context, opacity * 0.28);
          context.stroke(stemLayers.tips);
          context.lineWidth = 14;
          setAlpha(context, opacity * 0.5);
          context.stroke(stemLayers.hot);
          setAlpha(context, opacity * tuning.fillOpacity);
          context.fill(stemLayers.tips);
          context.fillStyle = '#fff';
          setAlpha(context, opacity * 0.85);
          context.fill(stemLayers.hot);
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
              y: sceneTop,
              width: fluidRight - fluidLeft,
              height: sceneBase - sceneTop,
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
              sceneTop,
              sceneBase,
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
        } else if (isFilled && !trussPaths) {
          // The bridge has nothing to fill: its deck is a line over open
          // water, and "filled" is its towers and piers going solid.
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
          // The plane the waves roll across: rails to the vanishing point,
          // fading out as they reach it, so the distance the projection
          // describes is something you can see rather than infer.
          const rails = context.createLinearGradient(
            0,
            echoPaths.horizon,
            0,
            sceneBase,
          );
          rails.addColorStop(0, 'rgba(255,255,255,0)');
          rails.addColorStop(1, 'rgba(255,255,255,0.16)');
          context.strokeStyle = rails;
          context.lineWidth = 1;
          setAlpha(context, opacity * (0.5 + echoPaths.bass * 0.5));
          context.stroke(echoPaths.rails);
          // The bloom on the horizon, swelling with the bass, and a haze
          // above it so the far half of the scene is sky and not a void.
          const bloom = context.createLinearGradient(
            0,
            echoPaths.horizon - echoPaths.bloom,
            0,
            echoPaths.horizon + echoPaths.bloom * 0.5,
          );
          bloom.addColorStop(0, 'rgba(255,255,255,0)');
          bloom.addColorStop(0.66, 'rgba(255,255,255,0.14)');
          bloom.addColorStop(1, 'rgba(255,255,255,0)');
          context.fillStyle = bloom;
          setAlpha(context, opacity * (0.55 + echoPaths.bass * 0.45));
          context.fillRect(
            plot.left,
            echoPaths.horizon - echoPaths.bloom,
            plot.right - plot.left,
            echoPaths.bloom * 1.5,
          );
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
          // Back to front: each past row dimmer and thinner with depth, a
          // beat's row heavier and brighter all the way back. Drawn here at
          // full resolution — the steps are the geometry's own, so nothing
          // is gained by rasterising them coarsely and the edges stay hard.
          ((target: CanvasRenderingContext2D) => {
            echoPaths.waves.forEach((wave) => {
              const remaining = (1 - wave.depth) ** 1.5;
              if (wave.body) {
                target.fillStyle = canvasPaint;
                setAlpha(
                  target,
                  opacity * tuning.fillOpacity * 0.14 * remaining,
                );
                target.fill(wave.body);
              }
              target.strokeStyle = canvasPaint;
              target.lineWidth = 1 + wave.strength * 1.6;
              setAlpha(
                target,
                opacity * remaining * (0.45 + wave.strength * 0.5),
              );
              target.stroke(wave.line);
              if (wave.strength > 0.3) {
                target.strokeStyle = '#fff';
                target.lineWidth = 0.8;
                setAlpha(target, opacity * remaining * wave.strength * 0.6);
                target.stroke(wave.line);
              }
            });
          })(context);
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
          context.fill(createSparkPath(scope, clock, sceneBase, sceneTop));
        }
        if (cityPaths) {
          // The city's own light: a haze along the foot of the block with
          // the bass, then the dark windows, the lit ones, and the red
          // beacons on the masts.
          const haze = context.createLinearGradient(
            0,
            sceneBase - cityPaths.hazeHeight,
            0,
            sceneBase,
          );
          haze.addColorStop(0, 'rgba(255,196,120,0)');
          haze.addColorStop(1, 'rgba(255,196,120,0.22)');
          context.fillStyle = haze;
          setAlpha(context, opacity * (0.35 + cityPaths.bass * 0.5));
          context.fillRect(
            plot.left,
            sceneBase - cityPaths.hazeHeight,
            plot.right - plot.left,
            cityPaths.hazeHeight,
          );
          if (isFilled) {
            context.fillStyle = '#000';
            setAlpha(context, opacity * 0.35);
            context.fill(cityPaths.dim);
            context.fillStyle = CITY_WINDOW;
            setAlpha(context, opacity * (0.75 + cityPaths.thump * 0.25));
            context.fill(cityPaths.lit);
          }
          context.fillStyle = CITY_BEACON;
          setAlpha(context, opacity * 0.9);
          context.fill(cityPaths.beacons);
        }
        if (valleyPaths) {
          context.strokeStyle = '#fff';
          context.lineWidth = 1;
          context.lineCap = 'round';
          setAlpha(context, opacity * (0.35 + valleyPaths.thump * 0.4));
          context.stroke(valleyPaths.glints);
          context.fillStyle = TERRACE_FIREFLY;
          valleyPaths.fireflies.forEach((band) => {
            setAlpha(context, opacity * band.alpha);
            context.fill(band.path);
          });
          context.strokeStyle = '#10131f';
          context.lineWidth = 1.4;
          context.lineJoin = 'round';
          setAlpha(context, opacity * 0.9);
          context.stroke(valleyPaths.birds);
        }
        if (terraceJumper) {
          setAlpha(context, opacity);
          paintTerraceJumper(
            context,
            terraceJumper,
            plot.right - plot.left,
            depth,
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

        if (crystalPaths) {
          // The crystal's faces — lit on the left, shaded on the right — and
          // the glints at the tips.
          if (isFilled) {
            // A shaded right side on every spike: that is what separates a
            // spike from its neighbour. No lit side — white over the colour
            // lightened it toward pastel — and no edge lines, which read as
            // an outline drawn round the drawing.
            context.fillStyle = '#000';
            setAlpha(context, opacity * 0.26);
            context.fill(crystalPaths.shade);
          }
          context.strokeStyle = '#fff';
          context.lineWidth = 1.2;
          context.lineCap = 'round';
          setAlpha(context, opacity * 0.95);
          context.stroke(crystalPaths.glints);
        }
        if (stagePaths) {
          context.fillStyle = '#fff';
          stagePaths.motes.forEach((band) => {
            setAlpha(context, opacity * band.alpha);
            context.fill(band.path);
          });
          context.strokeStyle = '#fff';
          context.lineWidth = 1.3;
          context.lineJoin = 'round';
          setAlpha(context, opacity * 0.9);
          context.stroke(stagePaths.sparks);
        }
        if (fencePaths) {
          // The wood's grain and knots on the pickets; then the grass in
          // front of the fence in two greens, the fireflies in it, and the
          // birds over everything.
          const own = fenceOwnColours;
          context.strokeStyle = own ? FENCE_GRAIN : '#000';
          context.lineWidth = 1;
          setAlpha(context, opacity * (isFilled ? 0.35 : 0.6));
          context.stroke(fencePaths.grain);
          context.fillStyle = own ? FENCE_GRAIN : '#000';
          setAlpha(context, opacity * 0.45);
          context.fill(fencePaths.knots);
          context.lineCap = 'round';
          context.lineWidth = Math.max(1.4, fencePaths.sunRadius * 0.045);
          context.strokeStyle = own ? FENCE_GRASS : '#3a6a3a';
          setAlpha(context, opacity * 0.95);
          context.stroke(fencePaths.grass);
          context.strokeStyle = own ? FENCE_GRASS_LIT : '#5a8a4a';
          context.stroke(fencePaths.grassLit);
          context.fillStyle = FENCE_FIREFLY;
          fencePaths.fireflies.forEach((band) => {
            setAlpha(context, opacity * band.alpha);
            context.fill(band.path);
          });
          context.strokeStyle = '#2a2a2a';
          context.lineWidth = 1.4;
          context.lineJoin = 'round';
          setAlpha(context, opacity * 0.85);
          context.stroke(fencePaths.birds);
        }
        if (stormPaths) {
          // The lightning: a wide soft glow, the bolt, its forks; and the
          // flash, a wash of white over the whole plot that fades in a few
          // frames.
          if (stormPaths.boltLife > 0) {
            context.strokeStyle = STORM_BOLT;
            context.lineJoin = 'round';
            context.lineWidth = 7;
            setAlpha(context, opacity * stormPaths.boltLife * 0.25);
            context.stroke(stormPaths.bolt);
            context.lineWidth = 2;
            setAlpha(context, opacity * stormPaths.boltLife);
            context.stroke(stormPaths.bolt);
            context.lineWidth = 1.2;
            setAlpha(context, opacity * stormPaths.boltLife * 0.8);
            context.stroke(stormPaths.fork);
          }
          if (stormPaths.flash > 0.02) {
            context.fillStyle = '#fff';
            setAlpha(context, opacity * stormPaths.flash * 0.3);
            context.fillRect(
              plot.left - (plot.right - plot.left),
              sceneFrame.top,
              (plot.right - plot.left) * 3,
              sceneFrame.bottom - sceneFrame.top,
            );
          }
        }
        if (firePaths) {
          // The hotter middle and the white-hot core over the outer flame,
          // then the sparks. Stroked, the layers are outlines.
          const paintLayer = (path: Path2D, colour: string, alpha: number) => {
            setAlpha(context, opacity * alpha);
            if (isFilled) {
              context.fillStyle = colour;
              context.fill(path);
            } else {
              context.strokeStyle = colour;
              context.lineWidth = 1;
              context.stroke(path);
            }
          };
          paintLayer(firePaths.mid, fireOwnColours ? FIRE_MID : '#fff', 0.55);
          paintLayer(firePaths.core, fireOwnColours ? FIRE_CORE : '#fff', 0.85);
          context.fillStyle = fireOwnColours ? FIRE_MID : '#fff';
          firePaths.sparks.forEach((band, index) => {
            if (index === 0) {
              context.fillStyle = '#fff';
            } else {
              context.fillStyle = fireOwnColours ? COAL_COLOUR : canvasPaint;
            }
            setAlpha(context, opacity * band.alpha);
            context.fill(band.path);
          });
        }
        if (arcadePaths) {
          // The wall over the sky, the openings cut out of it, then the
          // masonry drawn on it: voussoir joints, keystones, capitals and
          // courses, the parapet. Stroked, the wall is its outline.
          const stone = arcadeOwnColours ? ARCADE_STONE : canvasPaint;
          const mortar = arcadeOwnColours ? ARCADE_MORTAR : '#000';
          if (isFilled) {
            // One fill for the wall, in the shaded stone: a second even-odd
            // pass for the shade cost a millisecond on its own.
            context.fillStyle = arcadeOwnColours ? ARCADE_SHADE : canvasPaint;
            setAlpha(context, opacity);
            context.fill(arcadePaths.wall, 'evenodd');
            context.fillStyle = stone;
            setAlpha(context, opacity * 0.9);
            context.fill(arcadePaths.keystones);
          }
          context.strokeStyle = mortar;
          context.lineWidth = 1;
          setAlpha(context, opacity * (isFilled ? 0.55 : 0.8));
          if (!isFilled) {
            // Filled, the openings' edges are the figure's own stroke.
            context.stroke(arcadePaths.wall);
          }
          context.stroke(arcadePaths.joints);
          context.stroke(arcadePaths.keystones);
          setAlpha(context, opacity * (isFilled ? 0.35 : 0.6));
          context.stroke(arcadePaths.courses);
          context.stroke(arcadePaths.parapet);
          // The lanterns: warm, and a flare when the band under them hits.
          context.fillStyle = '#ffd27a';
          setAlpha(context, opacity * 0.25);
          context.fill(arcadePaths.flares);
          context.strokeStyle = '#ffd27a';
          context.lineWidth = 1;
          setAlpha(context, opacity * 0.9);
          context.stroke(arcadePaths.lanterns);
          context.fillStyle = '#fff3c0';
          setAlpha(context, opacity * 0.9);
          context.fill(arcadePaths.lanterns);
          // The embers.
          context.fillStyle = '#ffb060';
          arcadePaths.embers.forEach((band) => {
            setAlpha(context, opacity * band.alpha);
            context.fill(band.path);
          });
        }
        if (invasionPaths) {
          // A hit alien flashes white.
          context.fillStyle = '#fff';
          setAlpha(context, opacity * 0.9);
          context.fill(invasionPaths.flash);
        }
        if (cavePaths) {
          // The rock's shading: the flank away from the light darkened, a
          // wet highlight down the lit flank — filled only; stroked, the
          // outline is the rock. Then the bead swelling at every tip, and
          // the drips in flight, each with its shine.
          if (isFilled) {
            context.fillStyle = '#000';
            setAlpha(context, opacity * 0.32);
            context.fill(cavePaths.shade);
            context.fillStyle = '#fff';
            setAlpha(context, opacity * 0.26);
            context.fill(cavePaths.light);
            context.strokeStyle = '#000';
            context.lineWidth = 1;
            setAlpha(context, opacity * 0.22);
            context.stroke(cavePaths.bands);
          }
          context.fillStyle = '#fff';
          setAlpha(context, opacity * 0.55);
          context.fill(cavePaths.beads);
          if (isFilled) {
            context.fillStyle = canvasPaint;
            setAlpha(context, opacity * 0.35);
            context.fill(cavePaths.drips);
            context.fillStyle = '#fff';
            setAlpha(context, opacity * 0.6);
            context.fill(cavePaths.drips);
          } else {
            context.strokeStyle = '#fff';
            context.lineWidth = 1;
            setAlpha(context, opacity * 0.8);
            context.stroke(cavePaths.drips);
          }
          context.fillStyle = '#fff';
          setAlpha(context, opacity * 0.95);
          context.fill(cavePaths.shine);
          // The ceiling last, over the roots: the stalactites grow out from
          // under its ragged edge, so the rock covers them, not the reverse.
          const caveRock = caveOwnColours ? CAVE_CEILING : canvasPaint;
          if (isFilled) {
            context.fillStyle = caveRock;
            setAlpha(context, opacity);
            context.fill(cavePaths.ceiling);
            context.fillStyle = '#000';
            setAlpha(context, opacity * 0.3);
            context.fill(cavePaths.ceiling);
          }
          context.strokeStyle = caveRock;
          context.lineWidth = 1;
          setAlpha(context, opacity * 0.7);
          context.stroke(cavePaths.ceiling);
          context.strokeStyle = '#000';
          setAlpha(context, opacity * 0.6);
          context.stroke(cavePaths.cracks);
        }
        if (trussPaths) {
          // The asphalt over the deck line, with light edges, then the cars
          // on it, each its own colour, then the lamps: the lit half flares
          // on the beat and settles back over 250ms.
          context.strokeStyle = '#000';
          context.lineWidth = trussPaths.roadHalf * 2;
          setAlpha(context, opacity * 0.65);
          context.stroke(figure);
          context.strokeStyle = '#fff';
          context.lineWidth = 1;
          setAlpha(context, opacity * 0.2);
          context.stroke(trussPaths.edges);
          context.lineWidth = Math.max(1, trussPaths.roadHalf * 0.3);
          setAlpha(context, opacity * 0.7);
          context.stroke(trussPaths.dashes);
          trussPaths.cars.forEach((car) => {
            // The car's own shape glows: a wide soft stroke of its body in
            // its colour, then a tighter one, both with the band under it.
            context.strokeStyle = car.colour;
            context.lineJoin = 'round';
            context.lineWidth = 6 + car.level * 10;
            setAlpha(context, opacity * car.level * 0.22);
            context.stroke(car.body);
            context.lineWidth = 2 + car.level * 4;
            setAlpha(context, opacity * car.level * 0.4);
            context.stroke(car.body);
            if (isFilled) {
              context.fillStyle = car.colour;
              setAlpha(context, opacity);
              context.fill(car.body);
              context.fillStyle = '#10242c';
              context.fill(car.dark);
            } else {
              // Stroked, the car is a wireframe like the bridge it drives
              // on: its outline and its windows in its colour, nothing
              // solid, so the two variants read as one design.
              context.lineWidth = 1.2;
              setAlpha(context, opacity);
              context.stroke(car.body);
              setAlpha(context, opacity * 0.7);
              context.stroke(car.dark);
            }
            // The wheels: a light rim round the tyre and a hub in the middle,
            // so they read as wheels rather than as two dark blobs.
            context.strokeStyle = '#fff';
            context.lineWidth = 1;
            setAlpha(context, opacity * 0.4);
            context.stroke(car.wheels);
            context.fillStyle = car.colour;
            setAlpha(context, opacity * 0.9);
            context.fill(car.hubs);
          });
          // The light the lamps throw onto the road, under the lamps
          // themselves: a lit bridge, rather than beads on a wire.
          context.fillStyle = '#fff';
          setAlpha(context, opacity * (0.05 + trussPaths.thump * 0.05));
          context.fill(trussPaths.lampCones);
          context.fillStyle = canvasPaint;
          setAlpha(context, opacity * 0.35);
          context.fill(trussPaths.lampsOff);
          context.fillStyle = '#fff';
          setAlpha(context, opacity * (0.45 + trussPaths.thump * 0.55));
          context.fill(trussPaths.lampsOn);
          // The lights on the water under the bridge, shimmering.
          context.strokeStyle = '#fff';
          context.lineWidth = 1;
          setAlpha(context, opacity * (0.12 + trussPaths.thump * 0.12));
          context.stroke(trussPaths.reflections);
          // Fireworks. Each burst arrives as bands painted back to front:
          // the coolest, faintest end of the tail first, the white-hot head
          // last, so one shell shows the whole colour ramp at once. See
          // bridgeFireworks for why that is what stops them reading cheap.
          context.lineCap = 'butt';
          trussPaths.fireworks.forEach((firework) => {
            const head = firework.bands[firework.bands.length - 1];
            if (firework.reflection) {
              context.strokeStyle = `hsl(${head.hue.toFixed(0)}, 100%, 66%)`;
              context.lineWidth = 1.6;
              setAlpha(context, opacity * firework.reflectionAlpha);
              context.stroke(firework.reflection);
            }
            if (firework.flash) {
              context.fillStyle = '#fff';
              setAlpha(context, opacity * 0.7);
              context.fill(firework.flash);
            }
            if (firework.ring) {
              context.strokeStyle = '#fff';
              context.lineWidth = firework.ringWidth;
              setAlpha(context, opacity * firework.ringAlpha);
              context.stroke(firework.ring);
            }
            firework.bands.forEach((band) => {
              context.strokeStyle = `hsl(${band.hue.toFixed(0)}, 100%, ${band.lightness.toFixed(0)}%)`;
              context.lineWidth = band.width;
              context.lineCap = band.round ? 'round' : 'butt';
              setAlpha(context, opacity * band.alpha);
              context.stroke(band.path);
            });
            if (firework.twinkle) {
              context.strokeStyle = '#fff';
              context.lineWidth = 2.2;
              setAlpha(context, opacity * 0.9);
              context.stroke(firework.twinkle);
            }
          });
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
            context.fillStyle = canvasPaint;
            setAlpha(context, opacity * depth * 0.9);
            context.fill(lane.hubs);
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
        if (isScene) {
          context.restore();
        }

        context.restore();
      });

      const transitioning = transitionRef.current.paint(context, now);
      return (
        transitioning ||
        moving ||
        hasGraphAmbientMotion(chosen) ||
        (isEuphoric && tuning.border)
      );
    },
    [curves, height, points, width, xScale, yScale],
  );

  const kickFrames = useSmoothFrames(drawFrame, { isEnabled: true });

  /**
   * Take the context when the element arrives, and let everything go when it
   * leaves.
   *
   * A callback ref rather than a mount effect because the element comes and goes
   * with the selected form: static traces leave the tree in silence while
   * scenery stays mounted. A mount-only effect could retain a removed canvas.
   *
   * Going away also resets what the drawing had settled into. The component
   * itself stays mounted through the gap, so without this the trace would come
   * back at whatever opacity, weight and glow it was at when the music stopped,
   * where it used to arrive fresh — it is a first appearance again, and it
   * should fade in like one.
   */
  const attachCanvas = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      intersectionRef.current?.disconnect();
      intersectionRef.current = null;
      canvasRef.current = canvas;
      contextRef.current = canvas ? canvas.getContext('2d') : null;
      computedRef.current = canvas ? window.getComputedStyle(canvas) : null;
      if (canvas) {
        intersectionRef.current = new IntersectionObserver((entries) => {
          visibleRef.current = entries.some((entry) => entry.isIntersecting);
          if (visibleRef.current) {
            kickFrames();
          }
        });
        intersectionRef.current.observe(canvas);
      }
      if (!canvas) {
        transitionRef.current.reset();
        easedRef.current = [];
        pumpRef.current = 0;
        shownOpacityRef.current = 0;
        shownStrokeWidthRef.current = lookRef.current.tuning.strokeWidth;
      }
    },
    [kickFrames],
  );

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

  // No early return on an empty frame any more. Leaving the document was what
  // made the drawing disappear the instant the music stopped — the pixels go
  // with the element, so a pause, a track change or a quiet passage blanked the
  // plot. Silence is now drawn rather than unmounted: `SILENT_POINTS` puts every
  // band on the floor and the form keeps its shape, which is also how the
  // scenery styles have always behaved.
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
