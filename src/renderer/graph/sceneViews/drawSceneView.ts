/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import type { ILookTuning } from 'common/customLooks';
import type { ResolvedGraphPalette } from 'common/graphStyles';
import type { TSceneViewStyle } from 'common/graphSceneViews';
import { lookPaintColours } from '../../utils/windowInk';
import type { IChartPointData } from '../ChartController';
import {
  followReadings,
  type IAnalysisBand,
  type IAnalysisPlot,
} from '../analysis/analysisFrame';
import {
  PICTURE_ALPHA,
  TEXTURE_ALPHA,
  fillTexturePattern,
} from '../fillTextures';
import {
  clampUnit,
  type ISceneDrawn,
  type ISceneFrame,
  type ISceneLook,
  type ISceneReading,
  type TSceneInk,
} from './sceneFrame';
import {
  createSceneMusic,
  hearMusic,
  type ISceneMusicState,
} from './sceneMusic';
import { createLedWallState, drawLedWall, type ILedWallState } from './ledWall';
import {
  createGlassTowersState,
  drawGlassTowers,
  type IGlassTowersState,
} from './glassTowers';
import { createTideState, drawTide, type ITideState } from './tide';
import { createHaloState, drawHalo, type IHaloState } from './halo';
import {
  createSynthwaveState,
  drawSynthwave,
  type ISynthwaveState,
} from './synthwave';
import { createLedBarsState, drawLedBars, type ILedBarsState } from './ledBars';
import {
  createNeonBarsState,
  drawNeonBars,
  type INeonBarsState,
} from './neonBars';
import { createBars3dState, drawBars3d, type IBars3dState } from './bars3d';
import {
  createSpectrumWaveState,
  drawSpectrumWave,
  type ISpectrumWaveState,
} from './spectrumWave';
import {
  createSilkWavesState,
  drawSilkWaves,
  type ISilkWavesState,
} from './silkWaves';
import {
  createMirrorBarsState,
  drawMirrorBars,
  type IMirrorBarsState,
} from './mirrorBars';
import {
  createPixelBarsState,
  drawPixelBars,
  type IPixelBarsState,
} from './pixelBars';
import {
  createBouncingDotsState,
  drawBouncingDots,
  type IBouncingDotsState,
} from './bouncingDots';
import {
  createSparkBarsState,
  drawSparkBars,
  type ISparkBarsState,
} from './sparkBars';
import {
  createGlitchBarsState,
  drawGlitchBars,
  type IGlitchBarsState,
} from './glitchBars';
import {
  createFallingBlocksState,
  drawFallingBlocks,
  type IFallingBlocksState,
} from './fallingBlocks';
import { createFibersState, drawFibers, type IFibersState } from './fibers';
import {
  createAfterglowState,
  drawAfterglow,
  type IAfterglowState,
} from './afterglow';
import {
  createHalftoneState,
  drawHalftone,
  type IHalftoneState,
} from './halftone';
import { createHorizonState, drawHorizon, type IHorizonState } from './horizon';

/**
 * The one door into the drawn scenes (`graphSceneViews.ts`).
 *
 * What all of them share happens here: the reading is put on the plot's
 * scale and eased by the look's attack and release, the music is listened to
 * once for the frame (`sceneMusic.ts`), the style editor is read once
 * (`ISceneLook`), the colours are chosen — the look's own when it has any,
 * the scene's own when it is on Auto with none, the palette's otherwise —
 * and a filled scene's body gets the look's texture printed in it, the way
 * every other form's does.
 */

export interface ISceneViewState {
  key: string;
  levels: Float64Array;
  live: Float64Array;
  xs: Float64Array;
  axis: Float64Array;
  seeded: boolean;
  music: ISceneMusicState;
  ledWall: ILedWallState;
  towers: IGlassTowersState;
  tide: ITideState;
  halo: IHaloState;
  synthwave: ISynthwaveState;
  ledBars: ILedBarsState;
  neonBars: INeonBarsState;
  bars3d: IBars3dState;
  spectrumWave: ISpectrumWaveState;
  silkWaves: ISilkWavesState;
  mirrorBars: IMirrorBarsState;
  pixelBars: IPixelBarsState;
  bouncingDots: IBouncingDotsState;
  sparkBars: ISparkBarsState;
  glitchBars: IGlitchBarsState;
  fallingBlocks: IFallingBlocksState;
  fibers: IFibersState;
  afterglow: IAfterglowState;
  halftone: IHalftoneState;
  horizon: IHorizonState;
}

export const createSceneViewState = (): ISceneViewState => ({
  key: '',
  levels: new Float64Array(0),
  live: new Float64Array(0),
  xs: new Float64Array(0),
  axis: new Float64Array(0),
  seeded: false,
  music: createSceneMusic(),
  ledWall: createLedWallState(),
  towers: createGlassTowersState(),
  tide: createTideState(),
  halo: createHaloState(),
  synthwave: createSynthwaveState(),
  ledBars: createLedBarsState(),
  neonBars: createNeonBarsState(),
  bars3d: createBars3dState(),
  spectrumWave: createSpectrumWaveState(),
  silkWaves: createSilkWavesState(),
  mirrorBars: createMirrorBarsState(),
  pixelBars: createPixelBarsState(),
  bouncingDots: createBouncingDotsState(),
  sparkBars: createSparkBarsState(),
  glitchBars: createGlitchBarsState(),
  fallingBlocks: createFallingBlocksState(),
  fibers: createFibersState(),
  afterglow: createAfterglowState(),
  halftone: createHalftoneState(),
  horizon: createHorizonState(),
});

export interface ISceneViewRequest {
  style: TSceneViewStyle;
  context: CanvasRenderingContext2D;
  ratio: number;
  plot: IAnalysisPlot;
  window: { width: number; height: number };
  bands: readonly IAnalysisBand[];
  deltaMs: number;
  playing: boolean;
  /** The reading's frequencies. */
  points: readonly IChartPointData[];
  /** The reading as it arrived. */
  live: readonly IChartPointData[];
  /** Each point's column in CSS pixels. */
  columns: readonly (readonly [number, number])[];
  tuning: ILookTuning;
  /** The look's palette as resolved: `auto` has become the form's own. */
  resolvedPalette: ResolvedGraphPalette;
  /** The look's own stops, if it has any. */
  colours: readonly string[];
  glow: number;
  state: ISceneViewState;
}

/** Colour by, from the palette the look resolves to. */
const INK_OF: Record<ResolvedGraphPalette, TSceneInk> = {
  signal: 'flat',
  rainbow: 'frequency',
  level: 'level',
  heat: 'heat',
};

/**
 * The stops a scene is painted in: the look's own, or with none the window's
 * — Normal mode's primary and secondary, Rainbow mode's palette — as every
 * other look is (`windowInk.ts`). Each scene carried a set of its own on
 * Auto, and drew in it whatever the window was dressed in.
 */
export const sceneColours = (
  resolved: ResolvedGraphPalette,
  colours: readonly string[],
): readonly string[] => lookPaintColours(resolved, colours);

/** The style editor, read once for the frame. */
export const sceneLook = (
  tuning: ILookTuning,
  resolved: ResolvedGraphPalette,
): ISceneLook => ({
  ink: INK_OF[resolved],
  pieces: tuning.columns,
  gap: tuning.gap,
  filled: tuning.filled,
  opacity: clampUnit(tuning.fillOpacity),
  lineWidth: Math.max(0.5, tuning.strokeWidth),
  accents: tuning.accents,
  textured: tuning.filled && tuning.texture !== 'none',
});

const DRAW: Record<
  TSceneViewStyle,
  (frame: ISceneFrame, state: ISceneViewState) => ISceneDrawn
> = {
  ledwall: (frame, state) => drawLedWall(frame, state.ledWall),
  towers: (frame, state) => drawGlassTowers(frame, state.towers),
  tide: (frame, state) => drawTide(frame, state.tide),
  halo: (frame, state) => drawHalo(frame, state.halo),
  synthwave: (frame, state) => drawSynthwave(frame, state.synthwave),
  ledbars: (frame, state) => drawLedBars(frame, state.ledBars),
  neonbars: (frame, state) => drawNeonBars(frame, state.neonBars),
  bars3d: (frame, state) => drawBars3d(frame, state.bars3d),
  spectrumwave: (frame, state) => drawSpectrumWave(frame, state.spectrumWave),
  silkwaves: (frame, state) => drawSilkWaves(frame, state.silkWaves),
  mirrorbars: (frame, state) => drawMirrorBars(frame, state.mirrorBars),
  pixelbars: (frame, state) => drawPixelBars(frame, state.pixelBars),
  bouncedots: (frame, state) => drawBouncingDots(frame, state.bouncingDots),
  sparkbars: (frame, state) => drawSparkBars(frame, state.sparkBars),
  glitchbars: (frame, state) => drawGlitchBars(frame, state.glitchBars),
  fallblocks: (frame, state) => drawFallingBlocks(frame, state.fallingBlocks),
  fibers: (frame, state) => drawFibers(frame, state.fibers),
  afterglow: (frame, state) => drawAfterglow(frame, state.afterglow),
  halftone: (frame, state) => drawHalftone(frame, state.halftone),
  horizon: (frame, state) => drawHorizon(frame, state.horizon),
};

/** A reading in plot gain units as a fraction of the plot's depth. */
const asFraction = (gain: number) => (gain - MIN_GAIN) / (MAX_GAIN - MIN_GAIN);

/**
 * The look's texture, printed in the body a filled scene drew: clipped to
 * the body and laid in the window's own pixels, so a tile stays square, in
 * `overlay` so one tile serves every colour — as every other filled form
 * prints it (`LiveTraceCanvas`).
 */
const printTexture = (
  frame: ISceneFrame,
  tuning: ILookTuning,
  body: Path2D,
): void => {
  const { context, ratio, window } = frame;
  const pattern = fillTexturePattern(context, {
    texture: tuning.texture,
    image: tuning.textureImage,
    scale: ratio,
  });
  if (!pattern) {
    return;
  }
  const isPicture = tuning.texture === 'image';
  context.save();
  context.clip(body);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.globalCompositeOperation = isPicture ? 'source-atop' : 'overlay';
  context.globalAlpha =
    frame.look.opacity * (isPicture ? PICTURE_ALPHA : TEXTURE_ALPHA);
  context.fillStyle = pattern;
  context.fillRect(0, 0, window.width, window.height);
  context.restore();
};

/** A drawn scene's request without the canvas it would be painted on. */
export type TSceneViewReadRequest = Omit<
  ISceneViewRequest,
  'context' | 'ratio'
>;

/**
 * The half of a drawn scene's frame that is not painting: the reading put on
 * the plot's scale and eased, the music heard, the colours and the style
 * editor read. What the 2D scenes paint from here, and what the engine's own
 * looks are stepped from (`engineLooks/`), so the two read the music alike.
 * Nothing while there is too little reading to lay anything out.
 */
export const readSceneView = (
  request: TSceneViewReadRequest,
): { reading: ISceneReading; moving: boolean } | undefined => {
  const { state, points, live, columns, tuning } = request;
  const size = points.length;
  if (size < 2 || columns.length < size || live.length < size) {
    return undefined;
  }
  const key = `${request.style}|${size}`;
  if (state.key !== key) {
    state.key = key;
    state.levels = new Float64Array(size);
    state.live = new Float64Array(size);
    state.xs = new Float64Array(size);
    state.axis = new Float64Array(size);
    state.seeded = false;
  }
  for (let index = 0; index < size; index += 1) {
    state.live[index] = clampUnit(asFraction(live[index].y));
    const [column] = columns[index];
    state.xs[index] = column;
    state.axis[index] = points[index].x;
  }
  let moving = false;
  if (state.seeded) {
    moving = followReadings(
      state.levels,
      state.live,
      request.deltaMs,
      tuning.attackMs,
      tuning.releaseMs,
    );
  } else {
    state.levels.set(state.live);
    state.seeded = true;
  }
  const hearing = hearMusic(
    state.music,
    state.live,
    state.axis,
    request.deltaMs,
    request.playing,
  );

  return {
    reading: {
      plot: request.plot,
      window: request.window,
      bands: request.bands,
      deltaMs: request.deltaMs,
      playing: request.playing,
      levels: state.levels,
      xs: state.xs,
      axis: state.axis,
      music: state.music,
      colours: sceneColours(request.resolvedPalette, request.colours),
      look: sceneLook(tuning, request.resolvedPalette),
      glow: request.glow,
    },
    moving: moving || hearing,
  };
};

const drawSceneView = (request: ISceneViewRequest): boolean => {
  const read = readSceneView(request);
  if (!read) {
    return false;
  }
  const frame: ISceneFrame = {
    ...read.reading,
    context: request.context,
    ratio: request.ratio,
  };
  const drawn = DRAW[request.style](frame, request.state);
  if (drawn.body && frame.look.textured) {
    printTexture(frame, request.tuning, drawn.body);
  }
  return drawn.moving || read.moving;
};

export default drawSceneView;
