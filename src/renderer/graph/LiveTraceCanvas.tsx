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
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MIN_GAIN } from 'common/constants';
import useSmoothFrames from 'renderer/utils/useSmoothFrames';
import { useGraphGridHidden, useGraphLook } from 'renderer/utils/graphStyle';
import { analysisNeeds, legendWords } from 'common/graphAnalysis';
import type { TranslationKey } from 'common/i18n';
import {
  useLiveAudioFrame,
  useLiveAudioControl,
} from '../audio/LiveAudioContext';
import { hasGraphAmbientMotion } from './graphMotion';
import { IChromeBox } from './invaderCabinet';
import { resolveLookWaveform, useLookPreviewPoints } from './lookPreview';
import EngineLookLayer, {
  type TEngineLookPhase,
} from './engineLooks/EngineLookLayer';
import type { IEngineLookInput } from './engineLooks/engineLookInput';
import { useEngineLookUsable } from './engineLooks/engineLookHealth';
import useLeavingEngineLook from './engineLooks/useLeavingEngineLook';
import { engineLookPack, isEngineLookStyle } from './engineLooks/engineLooks';
import useAnalysisChannels from './analysis/useAnalysisChannels';
import {
  ILegendPlace,
  isSameLegendPlace,
  takeLegendFrame,
} from './analysis/legendPlace';
import { GRAPH_SILENT_POINTS } from './liveGraphBand';
import { useTranslation } from '../utils/I18nContext';
import { IChartPointData, ILiveCurveData } from './ChartController';
import { resolvePresentedStrokeWidth } from './liveTracePaint';

import { useIsRootEuphoric } from '../utils/euphoriaMode';

import createSceneStates from './liveTraceSceneStates';
import drawLiveTraceFrame from './drawLiveTraceFrame';

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
  /**
   * The EQ's total response in decibels, for Before & after.
   *
   * What is captured is the OUTPUT — everything here has already been through
   * the chain — so the only way to show the music before the EQ is to take
   * this back out of the reading, point by point. No other view reads it.
   */
  eqResponse?: IChartPointData[];
  /**
   * Whether a measuring view names its readings in a key: yes wherever it is
   * the picture, no where it plays behind another drawing (`EqScreen`).
   */
  hasKey?: boolean;
  /**
   * Where that key stands now, in the chart's coordinates, whenever it moves
   * or goes — for what the chart draws over the canvas to keep off it.
   */
  onLegendPlace?: (place: ILegendPlace | undefined) => void;
}

/** A look being left says nothing more about where the engine is. */
const ignoreEnginePhase = () => undefined;

const LiveTraceCanvas = ({
  curves,
  xScale,
  yScale,
  width,
  height,
  offsetLeft,
  offsetTop,
  isForeground,
  eqResponse,
  hasKey = true,
  onLegendPlace,
}: ILiveTraceCanvasProps) => {
  // Through refs, so a new callback never rebuilds the frame loop.
  const onLegendPlaceRef = useRef(onLegendPlace);
  onLegendPlaceRef.current = onLegendPlace;
  const legendPlaceRef = useRef<ILegendPlace | undefined>(undefined);
  // The measurement, straight from the analyser. This component re-renders with
  // every frame and nothing above it does — which is the entire arrangement.
  // The graph's own points, the plot's whole width with its bottom octaves
  // resolved (`liveGraphBand.ts`), so the cuts can be seen doing their work.
  const { graphPoints: livePoints, waveform } = useLiveAudioFrame();
  const { isPaused, readFrame } = useLiveAudioControl();
  const readFrameRef = useRef(readFrame);
  readFrameRef.current = readFrame;
  const playingRef = useRef(false);
  // Built once, on mount — see `createSceneStates` — and handed to the refs
  // below as their first values, which the drawing then owns and replaces.
  const [scenes] = useState(createSceneStates);
  const motionRef = useRef(scenes.motion);
  const terraceJumperRef = useRef(scenes.terraceJumper);
  const trussBridgeRef = useRef(scenes.trussBridge);
  const caveDripsRef = useRef(scenes.caveDrips);
  const caveClockRef = useRef(0);
  const invasionRef = useRef(scenes.invasion);
  const invaderCabinetRef = useRef(scenes.invaderCabinet);
  /** Whether the last frame drawn was the arcade, to tell an arrival. */
  const wasInvadersRef = useRef(false);
  const invasionClockRef = useRef(0);
  const warpRef = useRef(scenes.warp);
  const warpClockRef = useRef(0);
  const arcadeRef = useRef(scenes.arcade);
  const arcadeClockRef = useRef(0);
  const bonfireRef = useRef(scenes.bonfire);
  const bonfireClockRef = useRef(0);
  const stormRef = useRef(scenes.storm);
  const stormClockRef = useRef(0);
  const fenceRef = useRef(scenes.fence);
  const fenceClockRef = useRef(0);
  const braidStageRef = useRef(scenes.braidStage);
  const braidClockRef = useRef(0);
  const crystalRef = useRef(scenes.crystal);
  const crystalClockRef = useRef(0);
  const valleyRef = useRef(scenes.valley);
  const valleyClockRef = useRef(0);
  const nightRef = useRef(scenes.night);
  const cityRef = useRef(scenes.city);
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
  const slopeFieldRef = useRef(scenes.slopeField);
  const slopeClockRef = useRef(0);
  const bubbleStormRef = useRef(scenes.bubbleStorm);
  const bubbleMotesRef = useRef(scenes.bubbleMotes);
  const bubbleMotesClockRef = useRef(0);
  const sawtoothScopeRef = useRef(scenes.sawtoothScope);
  const pulseMonitorRef = useRef(scenes.pulseMonitor);
  const echoWavesRef = useRef(scenes.echoWaves);
  const roadTripRef = useRef(scenes.roadTrip);
  const dashTrailsRef = useRef(scenes.dashTrails);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /**
   * The app's own chrome lying over this canvas, in the canvas's pixels:
   * the titlebar and the transport bar where they overlap it, the graph's
   * controls strip, and in full screen the creature pinned in the top-left
   * corner. A scene that prints along the canvas's edge — the arcade's
   * score — moves clear of these rather than under them.
   *
   * Measured from the DOM rather than assumed, so a hidden bar counts as no
   * bar, and re-measured whenever the canvas or the strip changes size —
   * which is what entering and leaving full screen does to both.
   */
  const chromeRef = useRef<readonly IChromeBox[]>([]);
  const visibleRef = useRef(true);
  const intersectionRef = useRef<IntersectionObserver | null>(null);
  /** Stops watching the canvas for a lost drawing surface — see `attachCanvas`. */
  const contextWatchRef = useRef<() => void>(undefined);
  const transitionRef = useRef(scenes.transition);
  // Held rather than fetched per frame: the computed style is a live object
  // bound to the element, and it goes stale with the context if the canvas is
  // ever replaced, so the two are taken together.
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const computedRef = useRef<CSSStyleDeclaration | null>(null);

  // Only the live trace has a look; every other curve on this chart is the
  // user's own tuning and has one right way to be drawn.
  const { t } = useTranslation();
  const look = useGraphLook();
  /**
   * Left and right measured apart, and only while something is drawing them.
   *
   * Two more long windows on the capture is real work, so the analysers are
   * built when a measuring view is showing with Left & right chosen and taken
   * down the moment either stops being true.
   */
  const channels = useAnalysisChannels(
    analysisNeeds(look.style, look.tuning.channels === 'split'),
  );
  const analysisRef = useRef(scenes.analysis);
  const sceneViewRef = useRef(scenes.sceneView);
  /**
   * What the legend calls each channel, on a ref: the drawing runs on its own
   * frames and a language change must not rebuild the whole loop.
   */
  const channelLabelsRef = useRef<readonly [string, string]>(['L', 'R']);
  channelLabelsRef.current = [
    t('graph.channel.left'),
    t('graph.channel.right'),
  ];
  /** The words a measuring view's key uses, on a ref for the same reason. */
  const legendRef = useRef(scenes.legend);
  legendRef.current = legendWords((key) =>
    t(`graph.legend.${key}` as TranslationKey),
  );
  const eqResponseRef = useRef(eqResponse);
  eqResponseRef.current = eqResponse;
  const hasKeyRef = useRef(hasKey);
  hasKeyRef.current = hasKey;
  const ambient = hasGraphAmbientMotion(look.style);
  playingRef.current = ambient || !isPaused;
  const isRainbow = useIsRootEuphoric();
  const lookRef = useRef(look);
  lookRef.current = look;

  // The look painted by the scene engine instead of on this canvas, where it
  // can be (`engineLooks/engineLooks.ts`); laid out here every frame all the
  // same, and handed over through `engineInputRef`.
  const enginePack = engineLookPack(look.style);
  const isEngineUsable = useEngineLookUsable(look.style);
  const isEngineDrawn =
    enginePack !== undefined &&
    isEngineUsable &&
    isEngineLookStyle(look.style, look.tuning);
  const engineDrawnRef = useRef(isEngineDrawn);
  engineDrawnRef.current = isEngineDrawn;
  /** What the engine is handed: the look's layout, written in place. */
  const engineInputRef = useRef<IEngineLookInput | undefined>(undefined);
  /**
   * Where the engine is with the look (`EngineLookLayer`). Until it can draw
   * it, this canvas draws the look as it always did, so a look chosen never
   * shows an empty plot while the engine builds it; once the engine draws,
   * the layout goes to it and this canvas keeps its last picture until a
   * frame of that layout is on screen; then this canvas holds only words.
   * Back to building with every new look, before the engine has heard of it.
   */
  const enginePhaseRef = useRef<TEngineLookPhase>('building');
  // Before the phase goes back to the start below: whether the engine was
  // showing the look being left is what keeps its picture on screen.
  const engineLayers = useLeavingEngineLook(
    { style: look.style, pack: isEngineDrawn ? enginePack : undefined },
    enginePhaseRef,
  );
  const fadeLeavingEngineLook = engineLayers.fade;
  const enginePhaseStyleRef = useRef(look.style);
  if (enginePhaseStyleRef.current !== look.style) {
    enginePhaseStyleRef.current = look.style;
    enginePhaseRef.current = 'building';
  }
  /** Whether nothing is on this canvas while the engine paints the look. */
  const blankRef = useRef(false);
  /** The page drew the look this frame only because a crossfade is on. */
  const heldForFadeRef = useRef(false);

  // Whether the trace has the response plot to itself. This is true both in the
  // user's Wave only mode and when APO is off, because in either case there is
  // no applied response for the wave to sit behind.
  const isForegroundRef = useRef(isForeground);
  isForegroundRef.current = isForeground;

  // Whether there is a frequency axis left for the trace to be honest about.
  // Read here rather than derived from the props, because the margins the chart
  // drops when the grid goes are not the same question as whether anything on
  // the plot is still measured against 10Hz — see the stretch in the frame loop.
  const isGridHidden = useGraphGridHidden();
  const isGridHiddenRef = useRef(isGridHidden);
  isGridHiddenRef.current = isGridHidden;

  // Picking a look against silence shows nothing, so changing one plays a
  // single frame of spectrum and then lets go. Placed here rather than at the
  // source because it is a property of the drawing, not of the measurement:
  // nothing else reading the analyser — the meter, the Smart EQ solver, the
  // rhythm game — should ever see an invented frame.
  const previewPoints = useLookPreviewPoints(livePoints, look.id);
  // What the frame loop reports as painted: the preview's own identity, which
  // is what lets it go, even where the drawing shows the floor in its place.
  const previewPointsRef = useRef(previewPoints);
  previewPointsRef.current = previewPoints;
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
    return GRAPH_SILENT_POINTS;
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
  // Whether what is drawn is the capture itself — not a look preview, not the
  // silent floor — which is the only time the frame may read the analyser for
  // itself instead of waiting for the next React frame.
  const isLiveRef = useRef(false);
  isLiveRef.current = points === livePoints;
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
  const accentStateRef = useRef(scenes.accent);
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
      const moved = drawLiveTraceFrame(
        {
          canvasRef,
          contextRef,
          visibleRef,
          isLiveRef,
          readFrameRef,
          points,
          waveformRef,
          easedRef,
          width,
          height,
          transitionRef,
          lookRef,
          fadeLeavingEngineLook,
          enginePhaseRef,
          heldForFadeRef,
          engineDrawnRef,
          engineInputRef,
          blankRef,
          yScale,
          curves,
          xScale,
          isForegroundRef,
          isGridHiddenRef,
          projectedRef,
          liveProjectedRef,
          computedRef,
          playingRef,
          channelLabelsRef,
          legendRef,
          hasKeyRef,
          channels,
          eqResponseRef,
          analysisRef,
          previewPointsRef,
          sceneViewRef,
          fluidWaveRef,
          fluidBarsRef,
          motionRef,
          sawtoothScopeRef,
          pulseMonitorRef,
          echoWavesRef,
          trussClockRef,
          trussBridgeRef,
          caveClockRef,
          caveDripsRef,
          wasInvadersRef,
          invasionRef,
          invaderCabinetRef,
          invasionClockRef,
          chromeRef,
          warpClockRef,
          warpRef,
          arcadeClockRef,
          arcadeRef,
          bonfireClockRef,
          bonfireRef,
          stormClockRef,
          stormRef,
          fenceClockRef,
          fenceRef,
          braidClockRef,
          braidStageRef,
          crystalClockRef,
          crystalRef,
          valleyClockRef,
          valleyRef,
          cityClockRef,
          cityRef,
          roadTripRef,
          slopeClockRef,
          slopeFieldRef,
          bubbleMotesClockRef,
          bubbleMotesRef,
          slopeFlowRef,
          dashTrailsRef,
          terraceJumperRef,
          stemClockRef,
          stemLevelsRef,
          stemFlareRef,
          pumpRef,
          bubbleStormRef,
          accentStateRef,
          shownOpacityRef,
          shownStrokeWidthRef,
          seaCanvasRef,
          nightRef,
          haloCanvasRef,
        },
        deltaMs,
      );
      // The key's place after this frame, told only when it changed.
      const canvas = canvasRef.current;
      const frame = canvas ? takeLegendFrame(canvas) : undefined;
      if (frame && !isSameLegendPlace(frame.place, legendPlaceRef.current)) {
        legendPlaceRef.current = frame.place;
        onLegendPlaceRef.current?.(frame.place);
      }
      return moved;
    },
    // `channels` is the per-channel reader, whose identity never changes —
    // named here because the loop reads it and a dependency list that lies
    // about what a callback reads is worse than one that is slightly long.
    // So is `fadeLeavingEngineLook`.
    [
      channels,
      curves,
      fadeLeavingEngineLook,
      height,
      points,
      width,
      xScale,
      yScale,
    ],
  );

  // One frame more after a crossfade that held the engine back, even in a
  // silence that would stop the loop: that frame hands the look over.
  const drawFrameThenHandOver = useCallback(
    (deltaMs: number) => drawFrame(deltaMs) || heldForFadeRef.current,
    [drawFrame],
  );
  const kickFrames = useSmoothFrames(drawFrameThenHandOver, {
    isEnabled: true,
    target: canvasRef,
  });

  /** The engine's phase with the look, and a frame drawn for the change. */
  const handleEnginePhase = useCallback(
    (phase: TEngineLookPhase) => {
      enginePhaseRef.current = phase;
      kickFrames();
    },
    [kickFrames],
  );

  /**
   * A new size is drawn before it is painted.
   *
   * The canvas's box takes its size from this render and its backing store
   * only from the next frame the loop draws — one display frame later at
   * best, two at the graph's thirty — so every resize painted the last
   * picture stretched over the new box: a whole scene squashed to the docked
   * graph's height on the way out of full screen (Ivan, 2026-09-26: "the
   * scene itself kind of compresses when exiting full screen"). A draw that
   * advances no time is the same picture at the size the box now has, and a
   * layout effect lands it before the paint that shows the box.
   */
  const drawFrameRef = useRef(drawFrame);
  drawFrameRef.current = drawFrame;
  useLayoutEffect(() => {
    drawFrameRef.current(0);
  }, [width, height]);

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
      contextWatchRef.current?.();
      contextWatchRef.current = undefined;
      intersectionRef.current?.disconnect();
      intersectionRef.current = null;
      canvasRef.current = canvas;
      contextRef.current = canvas ? canvas.getContext('2d') : null;
      computedRef.current = canvas ? window.getComputedStyle(canvas) : null;
      if (canvas) {
        // A 2D canvas can lose its backing store under graphics pressure -
        // which a visualizer scene on the same window is exactly the source
        // of - and it fails SILENTLY: the context object stays, every draw
        // goes nowhere, and the trace freezes on its last pixels while the
        // scene, which is the one thing in the app that already handles
        // this, carries on beside it. Prevented, so the browser restores it,
        // and the context taken again and the loop restarted when it does.
        const lost = (event: Event) => {
          event.preventDefault();
          contextRef.current = null;
        };
        const restored = () => {
          contextRef.current = canvas.getContext('2d');
          kickFrames();
        };
        canvas.addEventListener('contextlost', lost);
        canvas.addEventListener('contextrestored', restored);
        contextWatchRef.current = () => {
          canvas.removeEventListener('contextlost', lost);
          canvas.removeEventListener('contextrestored', restored);
        };
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

  // Where the app's chrome lies over the canvas — see `chromeRef`. Only the
  // pieces that actually cover it count: a strip scrolled away or a creature
  // on a different display is no reason to push a readout down.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const wrapper = canvas.closest('.graph-wrapper');
    const strips = wrapper
      ? [...wrapper.querySelectorAll('.live-output-controls')]
      : [];
    const measure = () => {
      const box = canvas.getBoundingClientRect();
      chromeRef.current = [
        ...strips,
        ...document.querySelectorAll(
          '.window-titlebar, .now-playing-bar, .fullscreen-chrome > *',
        ),
      ]
        .map((piece) => piece.getBoundingClientRect())
        .filter(
          (rect) =>
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > box.top &&
            rect.top < box.bottom &&
            rect.right > box.left &&
            rect.left < box.right,
        )
        .map((rect) => ({
          left: rect.left - box.left,
          right: rect.right - box.left,
          top: rect.top - box.top,
          bottom: rect.bottom - box.top,
        }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    strips.forEach((strip) => observer.observe(strip));
    measure();
    return () => observer.disconnect();
  }, [width, height]);

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
    <>
      {/* Under the canvas, so the last look's picture fades out over the
          engine's on a change of look (`graphLookTransition.ts`). */}
      {engineLayers.layers.map((layer) => (
        <EngineLookLayer
          key={layer.key}
          style={layer.style}
          pack={layer.pack}
          inputRef={engineInputRef}
          onPhase={layer.leaving ? ignoreEnginePhase : handleEnginePhase}
          asleep={layer.leaving}
          onHost={layer.leaving ? engineLayers.onLeavingHost : undefined}
          left={offsetLeft}
          top={offsetTop}
          width={width}
          height={height}
        />
      ))}
      <canvas
        ref={attachCanvas}
        className="chart-live-canvas"
        // The chart's own box, to the pixel. The backing store is sized in the
        // frame loop; these are CSS pixels and only say where the drawing sits.
        style={{ left: offsetLeft, top: offsetTop, width, height }}
        // A drawing of something the legend already names, with nothing in it
        // to reach with a pointer or a reader.
        aria-hidden
      />
    </>
  );
};

export default LiveTraceCanvas;
