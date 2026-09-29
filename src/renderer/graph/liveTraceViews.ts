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

import { analysisNeeds, type TAnalysisStyle } from 'common/graphAnalysis';
import {
  canGraphGlow,
  type GraphStyle,
  resolveGraphPalette,
} from 'common/graphStyles';
import { type TSceneViewStyle } from 'common/graphSceneViews';
import { type RefObject } from 'react';
import {
  IEuphoriaPaint,
  isEuphoriaFigureStroke,
  isSelfColouredLook,
  readEuphoriaHue,
  resolveFigureStroke,
} from './liveTracePaint';
import {
  lookPaintColours,
  windowMateColours,
  windowViewPalette,
} from '../utils/windowInk';
import {
  type IAnalysisBand,
  type IAnalysisState,
  rampRgba,
} from './analysis/analysisFrame';
import drawAnalysisView, {
  type IAnalysisReadRequest,
  paintAnalysisOverlay,
  readAnalysisView,
} from './analysis/drawAnalysisView';
import { engineAnalysisStep, engineLookStep } from './engineLooks/engineLooks';
import { readAnalysisLookInput } from './engineLooks/analysisLookInput';
import { noteLookPreviewPainted } from './lookPreview';
import drawSceneView, {
  type ISceneViewState,
  readSceneView,
  type TSceneViewReadRequest,
} from './sceneViews/drawSceneView';
import { readLookInput } from './engineLooks/lookInput';
import { type ILookTuning, type IResolvedLook } from '../../common/customLooks';
import { type IChartPointData } from './ChartController';
import { type IAnalysisChannels } from './analysis/useAnalysisChannels';
import { type IEngineLookInput } from './engineLooks/engineLookInput';
import { type GraphLookTransition } from './graphLookTransition';

// The live graph's looks that draw themselves and leave the frame: the
// measuring views (spectrogram, waterfall, the stereo instruments) and the
// drawn scenes, each handed the frame and the plot.

interface IDrawMeasuringFrameInput {
  chosen: TAnalysisStyle;
  tuning: ILookTuning;
  computedRef: RefObject<CSSStyleDeclaration | null>;
  lookRef: RefObject<IResolvedLook>;
  figureBands: () => IAnalysisBand[];
  ratio: number;
  plot: { left: number; right: number; top: number; bottom: number };
  motionDeltaMs: number;
  playingRef: RefObject<boolean>;
  channelLabelsRef: RefObject<readonly [string, string]>;
  legendRef: RefObject<
    Record<
      | 'average'
      | 'phase'
      | 'width'
      | 'live'
      | 'peak'
      | 'max'
      | 'before'
      | 'after',
      string
    >
  >;
  hasKeyRef: RefObject<boolean>;
  eased: IChartPointData[];
  data: readonly IChartPointData[];
  projected: [number, number][];
  channels: IAnalysisChannels;
  eqResponseRef: RefObject<IChartPointData[] | undefined>;
  analysisRef: RefObject<IAnalysisState>;
  isEngineTaking: boolean;
  engineInputFor: (style: GraphStyle) => IEngineLookInput;
  width: number;
  height: number;
  isHanding: boolean;
  context: CanvasRenderingContext2D;
  transitionRef: RefObject<GraphLookTransition>;
  now: number;
  blankRef: RefObject<boolean>;
  rising: boolean;
  previewPointsRef: RefObject<IChartPointData[]>;
  moving: boolean;
}

/**
 * A measuring view's frame, when the look is one: what the frame returns
 * (whether anything is still moving), or undefined for any other look.
 */
export const drawMeasuringFrame = ({
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
}: IDrawMeasuringFrameInput) => {
  const needs = analysisNeeds(chosen, tuning.channels === 'split');
  const isEuphoric = document.documentElement.classList.contains('is-euphoric');
  const euphoria: IEuphoriaPaint = {
    isOn: isEuphoric,
    hue:
      isEuphoric && computedRef.current
        ? readEuphoriaHue(computedRef.current)
        : 0,
  };
  const viewPalette = windowViewPalette(
    chosen,
    lookRef.current.palette,
    resolveGraphPalette(chosen, lookRef.current.palette),
    lookRef.current.colours,
  );
  const viewColours = lookPaintColours(viewPalette, lookRef.current.colours);
  /**
   * The edge is the READING on these views — the analyser's own curve,
   * the ridge of a waterfall slice — so it exists whether or not the
   * look asked for a border, which is why the resolver is told the
   * figure is stroked. What the resolver is for here is the one thing
   * it decides that this code should not: which colour wins while the
   * rainbow border is on.
   */
  const edgePaint =
    resolveFigureStroke(
      rampRgba(viewColours, 1, 1),
      false,
      tuning.border,
      isSelfColouredLook(viewPalette, viewColours),
      euphoria,
    ) ?? rampRgba(viewColours, 1, 1);
  const bands = figureBands();
  const request: IAnalysisReadRequest = {
    style: chosen,
    ratio,
    plot,
    bands,
    deltaMs: motionDeltaMs,
    playing: playingRef.current,
    tuning,
    colours: viewColours,
    mateColours:
      lookRef.current.colours.length === 0
        ? windowMateColours(viewPalette)
        : undefined,
    palette: viewPalette,
    edge: {
      colour: edgePaint,
      width: Math.max(1, tuning.strokeWidth),
      isEuphoria: isEuphoriaFigureStroke(tuning.border, euphoria),
    },
    glow: isEuphoric && canGraphGlow(chosen) ? tuning.glow : 0,
    channelLabels: channelLabelsRef.current,
    legend: legendRef.current,
    keyed: hasKeyRef.current,
    points: eased,
    live: data,
    columns: projected,
    /**
     * The pair this view draws, when it draws one. Mid & side reads a
     * different pair from the Channels row's, and three views read the
     * samples rather than a spectrum; `analysisNeeds` is the one place
     * that decides which, so the reader and the drawing cannot
     * disagree about what was measured.
     */
    channels:
      chosen === 'midside'
        ? channels.readMidSide()
        : (tuning.channels === 'split' && channels.read()) || undefined,
    scope: needs.scope ? channels.scope() : undefined,
    eqResponse: eqResponseRef.current,
    state: analysisRef.current,
  };
  let moved = false;
  let lettered = true;
  const step = isEngineTaking ? engineAnalysisStep(chosen) : undefined;
  if (step) {
    // Laid out here, painted by the engine (`EngineLookLayer`), and
    // lettered here over it once it shows.
    const read = readAnalysisView(request);
    lettered = false;
    if (read) {
      const input = engineInputFor(chosen);
      readAnalysisLookInput(input, read.readings, { width, height });
      moved = step(read.readings, request.state, input) || read.moving;
      if (!isHanding) {
        read.readings.forEach((reading) => {
          lettered =
            paintAnalysisOverlay(
              chosen,
              { ...reading, context },
              request.state,
            ) || lettered;
        });
      }
    }
  } else {
    moved = drawAnalysisView({ ...request, context });
  }
  if (isHanding) {
    // Kept going until the engine shows a frame of this layout.
    return true;
  }
  const settling = transitionRef.current.paint(context, now);
  blankRef.current = isEngineTaking && !settling && !lettered;
  if (!settling && !rising) {
    noteLookPreviewPainted(previewPointsRef.current);
  }
  return settling || moved || moving;
};

interface IDrawSceneViewFrameInput {
  chosen: TSceneViewStyle;
  plot: { left: number; right: number; top: number; bottom: number };
  width: number;
  height: number;
  figureBands: () => IAnalysisBand[];
  motionDeltaMs: number;
  playingRef: RefObject<boolean>;
  eased: IChartPointData[];
  data: readonly IChartPointData[];
  projected: [number, number][];
  tuning: ILookTuning;
  lookRef: RefObject<IResolvedLook>;
  sceneViewRef: RefObject<ISceneViewState>;
  isEngineTaking: boolean;
  engineInputFor: (style: GraphStyle) => IEngineLookInput;
  isHanding: boolean;
  transitionRef: RefObject<GraphLookTransition>;
  context: CanvasRenderingContext2D;
  now: number;
  blankRef: RefObject<boolean>;
  moving: boolean;
  ratio: number;
}

/**
 * A drawn scene's frame, when the look is one: what the frame returns, or
 * undefined for any other look.
 */
export const drawSceneViewFrame = ({
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
}: IDrawSceneViewFrameInput) => {
  /**
   * The drawn scenes (`graphSceneViews.ts`) draw themselves too, for the
   * same reason: each is layers, lights and particles rather than one
   * figure. They are handed the look as chosen, so on Auto with no
   * colours of its own a scene can paint itself the way the real thing
   * looks.
   */
  const request: TSceneViewReadRequest = {
    style: chosen,
    plot,
    window: { width, height },
    bands: figureBands(),
    deltaMs: motionDeltaMs,
    playing: playingRef.current,
    points: eased,
    live: data,
    columns: projected,
    tuning,
    resolvedPalette: resolveGraphPalette(chosen, lookRef.current.palette),
    colours: lookRef.current.colours,
    glow: document.documentElement.classList.contains('is-euphoric')
      ? tuning.glow
      : 0,
    state: sceneViewRef.current,
  };
  const step = isEngineTaking ? engineLookStep(chosen) : undefined;
  if (step) {
    // Laid out here, painted by the engine (`EngineLookLayer`).
    const read = readSceneView(request);
    let moved = false;
    if (read) {
      const input = engineInputFor(chosen);
      readLookInput(input, read.reading);
      moved = step(read.reading, sceneViewRef.current, input) || read.moving;
    }
    if (isHanding) {
      // Kept going until the engine shows a frame of this layout.
      return true;
    }
    const settling = transitionRef.current.paint(context, now);
    blankRef.current = !settling;
    return settling || moved || moving;
  }
  const moved = drawSceneView({ ...request, context, ratio });
  const settling = transitionRef.current.paint(context, now);
  return settling || moved || moving;
};
