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

import { isAnalysisStyle } from 'common/graphAnalysis';
import { isSceneViewStyle } from 'common/graphSceneViews';
import {
  canGraphFill,
  type GraphStyle,
  type Projected,
} from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';

import { type IEngineLookInput } from './engineLooks/engineLookInput';
import { createLookInput } from './engineLooks/lookInput';
import { getWaveTransform } from './liveTracePaint';
import getGraphMotionDelta from './graphMotionPacing';
import { setAlpha } from './liveTraceStyle';
import easeTraceToward from './traceEasing';
import { traceStretch } from './traceStretch';
import { type IAnalysisBand } from './analysis/analysisFrame';
import { noteLookPreviewPainted } from './lookPreview';

import { hasGraphAmbientMotion } from './graphMotion';

import INVADER_INKS from './invaderInks';
import paintCurves from './liveTraceCurvePass';

import presentFigure from './liveTracePresentation';
import shapeFigure from './liveTraceFigureShape';
import layOutScenes from './liveTraceSceneLayouts';
import layOutInstruments from './liveTraceInstrumentLayouts';
import { drawMeasuringFrame, drawSceneViewFrame } from './liveTraceViews';
import drawDesignedFrame from './liveTraceDesignedFrame';
import { IDrawLiveTraceFrameInput } from './liveTraceFrameInput';

// One frame of the live graph, drawn from the component's refs: the canvas
// sized and cleared, the curve eased toward the music, the look's scenery
// advanced and laid out, and the curves painted — or the frame handed to
// the engine when the look is its.

/**
 * Draw one frame; true while anything on it is still moving, which is what
 * keeps the frame loop running (`useSmoothFrames`).
 */
const drawLiveTraceFrame = (
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
  }: IDrawLiveTraceFrameInput,
  deltaMs: number,
) => {
  const canvas = canvasRef.current;
  const context = contextRef.current;
  if (!canvas || !context || !visibleRef.current || document.hidden) {
    return false;
  }
  // Measured at this frame when the trace is live: the pump's frame was
  // 16 ms old at the median by the time it was drawn. The same length or
  // it is not the same axis, and the eased buffers are sized to `points`.
  const fresh = isLiveRef.current ? readFrameRef.current() : undefined;
  const data =
    fresh && fresh.graphPoints.length === points.length
      ? fresh.graphPoints
      : points;
  const frameWaveform =
    fresh && data === fresh.graphPoints ? fresh.waveform : waveformRef.current;
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
  // The engine's picture of the look being left goes out in the frames
  // the new look comes in (`useLeavingEngineLook`).
  fadeLeavingEngineLook(transitionRef.current.mixAt(now));
  // Where the engine is with the look, when it paints it: see
  // `enginePhaseRef`. Handing over, this canvas is left as it is. A look
  // the engine has not shown yet is drawn here until its crossfade is
  // over, and only then handed over, whole: handed over halfway, it
  // jumped from half strength to full.
  const isHeldForFade =
    transitionRef.current.isFading && enginePhaseRef.current !== 'showing';
  heldForFadeRef.current = isHeldForFade && engineDrawnRef.current;
  const phase =
    engineDrawnRef.current && !isHeldForFade
      ? enginePhaseRef.current
      : undefined;
  const isEngineTaking = phase === 'drawing' || phase === 'showing';
  const isHanding = phase === 'drawing';
  /** The engine's input for `style`: one per look, written in place. */
  const engineInputFor = (style: GraphStyle): IEngineLookInput => {
    const known = engineInputRef.current;
    if (known && known.style === style) {
      return known;
    }
    const made = createLookInput(style);
    engineInputRef.current = made;
    return made;
  };
  // Cleared in device pixels, so the rounding above cannot leave a seam of
  // last frame's drawing along an edge. Not while the engine paints the
  // look and nothing has been drawn here since the last clear: a clear
  // is still a frame of this canvas for the compositor.
  if (!isHanding && !(phase === 'showing' && blankRef.current)) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
  blankRef.current = false;
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
  const motionDeltaMs = getGraphMotionDelta(deltaMs, plotDepth * heightScale);
  const rise = getEaseFactor(motionDeltaMs, tuning.attackMs);
  const fall = getEaseFactor(motionDeltaMs, tuning.releaseMs);
  // A look preview counts as painted only once no point is still rising.
  const easing = easeTraceToward(eased, data, rise, fall);
  let { moving } = easing;
  const { rising } = easing;

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
   * Edge to edge where the sound stops short of an edge, and only there
   * (`traceStretch`).
   *
   * BOTH CONDITIONS, and neither is decoration. Soloed but ruled, the
   * frequency labels underneath would name the wrong columns. Gridless with
   * the curves still up, the trace would cross an EQ response drawn on the
   * real axis and the two would disagree about where 1kHz is. Only "wave
   * only" plus no grid leaves the drawing alone on the card, and only then
   * is stretching it free.
   */
  const { from: firstX, scale: stretch } =
    isForegroundRef.current && isGridHiddenRef.current
      ? traceStretch(
          plot.left,
          plot.right,
          Number(xScale(eased[0].x)) || plot.left,
          Number(xScale(eased[eased.length - 1].x)) || plot.right,
        )
      : { from: 0, scale: 1 };

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
   * The measuring views draw themselves and leave.
   *
   * None of them is one path, so none of them can be expressed as a
   * figure the rest of this loop knows how to paint: the spectrogram is a
   * raster, the waterfall is fifty-six figures in perspective, and the
   * stereo view is three instruments in a box. They are handed the frame
   * and the plot and take it from there (`analysis/`), which is also what
   * lets them read left and right separately without every scene below
   * having to learn what a second channel is.
   */
  /**
   * The band each copy of the figure stands in, from the wave controls
   * (height, position, mirrored, upside down): the measuring views and
   * the drawn scenes both lay themselves out in these.
   */
  const figureBands = (): IAnalysisBand[] =>
    curves.map((curve) => {
      const wave = getWaveTransform(curve, baseline, plot.top);
      const restY = plot.bottom * wave.scaleY + wave.translateY;
      const fullY = plot.top * wave.scaleY + wave.translateY;
      const flipped = fullY > restY;
      return {
        top: flipped ? restY : fullY,
        bottom: flipped ? fullY : restY,
        flipped,
        opacity: curve.opacity,
      };
    });
  if (isAnalysisStyle(chosen)) {
    return drawMeasuringFrame({
      chosen,
      tuning,
      computedRef,
      lookRef,
      figureBands,
      ratio,
      plot,
      motionDeltaMs,
      playingRef,
      channelLabelsRef,
      legendRef,
      hasKeyRef,
      eased,
      data,
      projected,
      channels,
      eqResponseRef,
      analysisRef,
      isEngineTaking,
      engineInputFor,
      width,
      height,
      isHanding,
      context,
      transitionRef,
      now,
      blankRef,
      rising,
      previewPointsRef,
      moving,
    });
  }

  if (isSceneViewStyle(chosen)) {
    return drawSceneViewFrame({
      chosen,
      plot,
      width,
      height,
      figureBands,
      motionDeltaMs,
      playingRef,
      eased,
      data,
      projected,
      tuning,
      lookRef,
      sceneViewRef,
      isEngineTaking,
      engineInputFor,
      isHanding,
      transitionRef,
      context,
      now,
      blankRef,
      moving,
      ratio,
    });
  }

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
   * The axis runs 10Hz to 25kHz with the grid on, and the reading stops
   * at the output's Nyquist — 24kHz on a 48kHz endpoint, less on a
   * slower one — so the drawing has nothing to say in the last stretch
   * of plot. The wave already respects that, because it is built from
   * the points; the bars were laid out edge to edge and so ran past both
   * ends of the data, out over the axis labels.
   */
  const fluidLeft = projected[0][0];
  const fluidRight = projected[projected.length - 1][0];
  const {
    pulsePaths,
    echoPaths,
    sawTrace,
    stems,
    pulseGrid,
    moving: layOutInstrumentsMoving,
  } = layOutInstruments({
    isWaveForm,
    isFluidForm,
    tuning,
    moving,
    fluidWaveRef,
    frameWaveform,
    motionDeltaMs,
    fluidBarsRef,
    data,
    chosen,
    sceneSpace,
    projected,
    sceneBase,
    motionRef,
    sawtoothScopeRef,
    sceneTop,
    playingRef,
    pulseMonitorRef,
    isGridHiddenRef,
    width,
    height,
    depth,
    baseline,
    echoWavesRef,
    isFilled,
  });
  moving = layOutInstrumentsMoving;
  const {
    roadPaths,
    trussPaths,
    cavePaths,
    invasionPaths,
    warpPaths,
    arcadePaths,
    firePaths,
    stormPaths,
    fencePaths,
    valleyPaths,
    fieldColumns,
    cityPaths,
    fieldPaths,
    motePaths,
    terraceScene,
    valleyColumns,
    cabinetFrame,
    crystalPaths,
    stagePaths,
    shelterPath,
    moving: layOutScenesMoving,
  } = layOutScenes({
    chosen,
    sceneSpace,
    projected,
    tuning,
    playingRef,
    trussClockRef,
    motionDeltaMs,
    moving,
    trussBridgeRef,
    liveProjected,
    sceneTop,
    sceneBase,
    depth,
    skyFrame,
    caveClockRef,
    caveDripsRef,
    wasInvadersRef,
    invasionRef,
    invaderCabinetRef,
    invasionClockRef,
    curves,
    baseline,
    plot,
    height,
    chromeRef,
    width,
    frameWaveform,
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
    motionRef,
    slopeClockRef,
    slopeFieldRef,
    bubbleMotesClockRef,
    bubbleMotesRef,
  });
  moving = layOutScenesMoving;
  const {
    shape,
    figure,
    blinkingSatellites,
    scatter,
    isEuphoric,
    euphoria,
    terraceJumper,
    piecePaths,
    slopeFlow,
    overflowsPlot,
    dashTrails,
    scatterPaths,
    stemLayers,
    connector,
    terraceTiers,
    moving: shapeFigureMoving,
  } = shapeFigure({
    pulsePaths,
    echoPaths,
    roadPaths,
    trussPaths,
    cavePaths,
    invasionPaths,
    warpPaths,
    arcadePaths,
    firePaths,
    stormPaths,
    fencePaths,
    valleyPaths,
    sawTrace,
    stems,
    chosen,
    isFluidForm,
    fluidLeft,
    sceneTop,
    fluidRight,
    sceneBase,
    fluidBarsRef,
    tuning,
    figurePoints,
    fluidWaveRef,
    isFilled,
    playingRef,
    slopeFlowRef,
    motionDeltaMs,
    moving,
    fieldColumns,
    pulseGrid,
    cityPaths,
    fieldPaths,
    motePaths,
    motionRef,
    terraceScene,
    sceneSpace,
    projected,
    dashTrailsRef,
    valleyColumns,
    terraceJumperRef,
    liveProjected,
    stemClockRef,
    stemLevelsRef,
    stemFlareRef,
    baseline,
    depth,
    lookRef,
    computedRef,
  });
  moving = shapeFigureMoving;

  const {
    designed,
    paintPalette,
    paintColours,
    energy,
    isSelfColoured,
    opacity,
    strokeWidth,
    haloPath,
    lit,
    swell,
    paintPeaks,
    needsOutside,
    figureStrokeWidth,
    fenceOwnColours,
    stormOwnColours,
    fireOwnColours,
    arcadeOwnColours,
    caveOwnColours,
    fluidOwnColours,
    isEuphoriaEdge,
    moving: presentFigureMoving,
  } = presentFigure({
    projected,
    baseline,
    depth,
    tuning,
    chosen,
    pumpRef,
    motionDeltaMs,
    moving,
    pulsePaths,
    echoPaths,
    roadPaths,
    trussPaths,
    shape,
    isFilled,
    isFluidForm,
    figure,
    fluidWaveRef,
    plot,
    warpPaths,
    firePaths,
    arcadePaths,
    invasionPaths,
    cavePaths,
    stormPaths,
    fencePaths,
    bubbleStormRef,
    motionRef,
    playingRef,
    figurePoints,
    sceneBase,
    sceneTop,
    blinkingSatellites,
    scatter,
    accentStateRef,
    deltaMs,
    curves,
    shownOpacityRef,
    isForegroundRef,
    shownStrokeWidthRef,
    lookRef,
    isEuphoric,
    euphoria,
    context,
    isEngineTaking,
    motePaths,
    cabinetFrame,
    invaderCabinetRef,
    invasionRef,
    invasionClockRef,
    valleyPaths,
    valleyColumns,
    terraceJumper,
    cityPaths,
    piecePaths,
    fieldPaths,
    slopeFlow,
    fieldColumns,
    pulseMonitorRef,
    pulseGrid,
    width,
    height,
  });
  moving = presentFigureMoving;
  if (designed) {
    return drawDesignedFrame({
      designed,
      paintPalette,
      paintColours,
      curves,
      scenePlot,
      energy,
      engineInputFor,
      chosen,
      width,
      height,
      plot,
      baseline,
      depth,
      sceneTop,
      sceneBase,
      isFilled,
      tuning,
      isSelfColoured,
      euphoria,
      opacity,
      strokeWidth,
      haloPath,
      lit,
      swell,
      isHanding,
      context,
      paintPeaks,
      transitionRef,
      now,
      blankRef,
      moving,
      isEuphoric,
    });
  }

  context.lineCap = 'round';
  context.lineJoin = 'round';

  // The arcade's screen edges — ground, score, hi-score, spare ships and
  // credit — once, in the window's own pixels and under everything,
  // before any curve's transform is set. Through the wave they would
  // float mid-panel at half height, print upside down in the mirror and
  // shake when the ship is hit.
  if (cabinetFrame) {
    const paintEdge = (path: Path2D, colour: string, alpha: number) => {
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
    const { frame: frameInk } = INVADER_INKS;
    paintEdge(
      cabinetFrame.ground,
      frameInk.ground.colour,
      frameInk.ground.alpha,
    );
    paintEdge(cabinetFrame.spare, frameInk.spare.colour, frameInk.spare.alpha);
    paintEdge(
      cabinetFrame.readout,
      frameInk.readout.colour,
      frameInk.readout.alpha,
    );
  }

  paintCurves({
    curves,
    baseline,
    plot,
    chosen,
    projected,
    tuning,
    motionRef,
    isFilled,
    bubbleStormRef,
    figure,
    context,
    seaCanvasRef,
    canvas,
    height,
    needsOutside,
    figureStrokeWidth,
    sceneBase,
    pulsePaths,
    pulseMonitorRef,
    stormPaths,
    stormRef,
    stormClockRef,
    invasionPaths,
    invasionRef,
    invasionClockRef,
    overflowsPlot,
    depth,
    paintPalette,
    paintColours,
    scenePlot,
    energy,
    dashTrails,
    opacity,
    strokeWidth,
    pulseGrid,
    motePaths,
    fieldPaths,
    cityPaths,
    nightRef,
    ratio,
    valleyPaths,
    sceneTop,
    haloPath,
    isSelfColoured,
    euphoria,
    scatterPaths,
    stemLayers,
    haloCanvasRef,
    lit,
    swell,
    paintPeaks,
    crystalPaths,
    stagePaths,
    fencePaths,
    fenceOwnColours,
    stormOwnColours,
    firePaths,
    fireOwnColours,
    arcadePaths,
    arcadeOwnColours,
    warpPaths,
    shelterPath,
    cavePaths,
    caveOwnColours,
    trussPaths,
    roadPaths,
    connector,
    blinkingSatellites,
    terraceTiers,
    isFluidForm,
    fluidLeft,
    fluidRight,
    fluidBarsRef,
    isEuphoric,
    fluidOwnColours,
    piecePaths,
    echoPaths,
    sawTrace,
    sawtoothScopeRef,
    terraceJumper,
    isEuphoriaEdge,
    roadTripRef,
  });

  const transitioning = transitionRef.current.paint(context, now);
  if (!transitioning && !rising) {
    noteLookPreviewPainted(previewPointsRef.current);
  }
  return (
    transitioning ||
    moving ||
    hasGraphAmbientMotion(chosen) ||
    (isEuphoric && tuning.border)
  );
};

export default drawLiveTraceFrame;
