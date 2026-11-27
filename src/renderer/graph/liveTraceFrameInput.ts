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

import { type RefObject } from 'react';
import { type AxisScale, type NumberValue } from 'd3';
import { type ILiveFrame } from './liveFrameReader';
import { type IChartPointData, type ILiveCurveData } from './ChartController';
import { type GraphLookTransition } from './graphLookTransition';
import { type IResolvedLook } from '../../common/customLooks';
import { type TEngineLookPhase } from './engineLooks/EngineLookLayer';
import { type IEngineLookInput } from './engineLooks/engineLookInput';
import { type IAnalysisChannels } from './analysis/useAnalysisChannels';
import { type IAnalysisState } from './analysis/analysisFrame';
import { type ISceneViewState } from './sceneViews/drawSceneView';
import { type IGraphMotionState } from './graphMotion';
import { type IGhost, type ISpark } from './sawtoothScope';
import { type IEchoWave } from './echoWaves';
import { type CaveDrips } from './caveDrips';
import { type WarpTunnel } from './warpTunnel';
import { type StoneArcade } from './stoneArcade';
import { type Bonfire } from './bonfire';
import { type Rainstorm } from './rainstorm';
import { type CountryFence } from './countryFence';
import { type BraidStage } from './braidStage';
import { type CrystalSpikes } from './crystalSpikes';
import { type CitySkyline } from './citySkyline';
import { type SlopeField } from './slopeField';
import { type IDashTrails } from './dashTrails';
import { type IAccentState } from './graphAccents';
import { type ITextureMotion } from './textureMotion';
import { type NightSurfaces } from './nightSurfaces';

// What a frame of the live graph is drawn from: the component's refs, the
// look and the analyser's points, and the scales the plot was laid out in.

export interface IDrawLiveTraceFrameInput {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  contextRef: RefObject<CanvasRenderingContext2D | null>;
  visibleRef: RefObject<boolean>;
  isLiveRef: RefObject<boolean>;
  readFrameRef: RefObject<() => ILiveFrame | undefined>;
  points: readonly IChartPointData[];
  waveformRef: RefObject<readonly number[]>;
  easedRef: RefObject<IChartPointData[]>;
  width: number;
  height: number;
  transitionRef: RefObject<GraphLookTransition>;
  lookRef: RefObject<IResolvedLook>;
  fadeLeavingEngineLook: (mix: number) => void;
  enginePhaseRef: RefObject<TEngineLookPhase>;
  heldForFadeRef: RefObject<boolean>;
  engineDrawnRef: RefObject<boolean>;
  engineInputRef: RefObject<IEngineLookInput | undefined>;
  blankRef: RefObject<boolean>;
  yScale: AxisScale<NumberValue>;
  curves: ILiveCurveData[];
  xScale: AxisScale<NumberValue>;
  isForegroundRef: RefObject<boolean>;
  isGridHiddenRef: RefObject<boolean>;
  projectedRef: RefObject<[number, number][]>;
  liveProjectedRef: RefObject<[number, number][]>;
  computedRef: RefObject<CSSStyleDeclaration | null>;
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
  channels: IAnalysisChannels;
  eqResponseRef: RefObject<IChartPointData[] | undefined>;
  analysisRef: RefObject<IAnalysisState>;
  previewPointsRef: RefObject<IChartPointData[]>;
  sceneViewRef: RefObject<ISceneViewState>;
  fluidWaveRef: RefObject<number[]>;
  fluidBarsRef: RefObject<number[]>;
  motionRef: RefObject<IGraphMotionState>;
  sawtoothScopeRef: RefObject<{
    ghosts: IGhost[];
    beatLevel: number;
    trackedAt: number;
    flareAt: number;
    sparks: ISpark[];
  }>;
  echoWavesRef: RefObject<{
    waves: IEchoWave[];
    beatLevel: number;
    bass: number;
    trackedAt: number;
    pending: number;
  }>;
  caveClockRef: RefObject<number>;
  caveDripsRef: RefObject<CaveDrips>;
  warpClockRef: RefObject<number>;
  warpRef: RefObject<WarpTunnel>;
  arcadeClockRef: RefObject<number>;
  arcadeRef: RefObject<StoneArcade>;
  bonfireClockRef: RefObject<number>;
  bonfireRef: RefObject<Bonfire>;
  stormClockRef: RefObject<number>;
  stormRef: RefObject<Rainstorm>;
  fenceClockRef: RefObject<number>;
  fenceRef: RefObject<CountryFence>;
  braidClockRef: RefObject<number>;
  braidStageRef: RefObject<BraidStage>;
  crystalClockRef: RefObject<number>;
  crystalRef: RefObject<CrystalSpikes>;
  cityClockRef: RefObject<number>;
  cityRef: RefObject<CitySkyline>;
  roadTripRef: RefObject<{
    beatLevel: number;
    trackedAt: number;
    flashAt: number;
    glow: number;
    hill: number[];
  }>;
  slopeClockRef: RefObject<number>;
  slopeFieldRef: RefObject<SlopeField>;
  slopeFlowRef: RefObject<number>;
  dashTrailsRef: RefObject<IDashTrails>;
  stemClockRef: RefObject<number>;
  stemLevelsRef: RefObject<number[]>;
  stemFlareRef: RefObject<number[]>;
  pumpRef: RefObject<number>;
  accentStateRef: RefObject<IAccentState>;
  /** Where the music has carried the look's texture (`textureMotion.ts`). */
  textureMotionRef: RefObject<ITextureMotion>;
  shownOpacityRef: RefObject<number>;
  shownStrokeWidthRef: RefObject<number>;
  nightRef: RefObject<NightSurfaces>;
  haloCanvasRef: RefObject<HTMLCanvasElement | null>;
}
