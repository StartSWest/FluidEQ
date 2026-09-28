/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILookTuning } from 'common/customLooks';
import { isAnalysisStyle, type TAnalysisStyle } from 'common/graphAnalysis';
import { GRAPH_STYLE_LABELS, type GraphStyle } from 'common/graphStyles';
import { SCENE_CONTRACT_VERSION } from 'common/sceneUniformContract';
import { SCENE_PACK_SCHEMA, type IScenePack } from 'common/scenePacks';
import type { ISceneViewState } from '../sceneViews/drawSceneView';
import type { ISceneReading } from '../sceneViews/sceneFrame';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import LOOK_GLSL from './lookGlsl';
import ANALYSIS_GLSL from './analysisGlsl';
import { designedShader, isDesignedLookStyle } from './designed/designedLooks';
import type {
  IEngineAnalysisLook,
  TEngineAnalysisStep,
} from './analysisLookTypes';
import analyzerLook from './analyzerLook';
import averageLook from './averageLook';
import { energyLook, notesLook, rtaLook } from './barsLook';
import compareLook from './compareLook';
import loudnessLook from './loudnessLook';
import midSideLook from './midSideLook';
import phaseLook from './phaseLook';
import scopeLook from './scopeLook';
import spectrogramLook from './spectrogramLook';
import waterfallLook from './waterfallLook';
import afterglowLook from './afterglowLook';
import bars3dLook from './bars3dLook';
import bouncingDotsLook from './bouncingDotsLook';
import sparkBarsLook from './sparkBarsLook';
import ledBarsLook from './ledBarsLook';
import fallingBlocksLook from './fallingBlocksLook';
import fibersLook from './fibersLook';
import haloLook from './haloLook';
import horizonLook from './horizonLook';
import glassTowersLook from './glassTowersLook';
import glitchBarsLook from './glitchBarsLook';
import spectrumWaveLook from './spectrumWaveLook';
import halftoneLook from './halftoneLook';
import ledWallLook from './ledWallLook';
import mirrorBarsLook from './mirrorBarsLook';
import pixelBarsLook from './pixelBarsLook';
import neonBarsLook from './neonBarsLook';
import silkWavesLook from './silkWavesLook';
import synthwaveLook from './synthwaveLook';
import tideLook from './tideLook';

/**
 * Which of the graph's looks the engine draws, and what it draws them from.
 *
 * Ivan, 2026-09-27: "can we move standar viualer to tree js and they will
 * play faster" — then "do it moe it to the nre engine". A look listed here is
 * laid out on the page as it always was and painted by the scene engine on
 * the GPU, in its worker, instead of on the page's 2D canvas: measured on
 * this machine's Intel UHD at a 1906x498 deck, the 2D looks cost the GPU
 * process 1.2 to 8.9 ms a frame to rasterise and the page 1-2 ms of script.
 * A look not listed yet, a look with a texture printed in its body, and any
 * look on a machine where the engine cannot run are drawn in 2D as before
 * (`engineLookHealth.ts`), which is also every look's fallback.
 */

/** Lays one frame of a look out, advancing its state in the page's own. */
export type TEngineLookStep = (
  reading: ISceneReading,
  scene: ISceneViewState,
  input: IEngineLookInput,
) => boolean;

interface IEngineLookEntry {
  glsl: string;
  step: TEngineLookStep;
}

const entry = <TState>(look: IEngineLook<TState>): IEngineLookEntry => ({
  glsl: look.glsl,
  step: (reading, scene, input) =>
    look.step(reading, look.stateOf(scene), input),
});

/**
 * The measuring views the engine draws: laid out by the page's own reading
 * (`readAnalysisView`) and advanced by each view's own functions, with their
 * words and key still printed on the page (`paintAnalysisOverlay`).
 */
const ANALYSIS_LOOKS: Partial<Record<TAnalysisStyle, IEngineAnalysisLook>> = {
  analyzer: analyzerLook,
  average: averageLook,
  compare: compareLook,
  energy: energyLook,
  loudness: loudnessLook,
  midside: midSideLook,
  notes: notesLook,
  phase: phaseLook,
  rta: rtaLook,
  scope: scopeLook,
  spectrogram: spectrogramLook,
  waterfall: waterfallLook,
};

const LOOKS: Partial<Record<GraphStyle, IEngineLookEntry>> = {
  afterglow: entry(afterglowLook),
  bars3d: entry(bars3dLook),
  bouncedots: entry(bouncingDotsLook),
  fallblocks: entry(fallingBlocksLook),
  fibers: entry(fibersLook),
  glitchbars: entry(glitchBarsLook),
  halftone: entry(halftoneLook),
  halo: entry(haloLook),
  horizon: entry(horizonLook),
  ledbars: entry(ledBarsLook),
  ledwall: entry(ledWallLook),
  mirrorbars: entry(mirrorBarsLook),
  neonbars: entry(neonBarsLook),
  pixelbars: entry(pixelBarsLook),
  silkwaves: entry(silkWavesLook),
  sparkbars: entry(sparkBarsLook),
  spectrumwave: entry(spectrumWaveLook),
  synthwave: entry(synthwaveLook),
  tide: entry(tideLook),
  towers: entry(glassTowersLook),
};

/** The shader a look is drawn with, after the parts every look shares. */
const shaderOf = (style: GraphStyle): string | undefined => {
  if (isAnalysisStyle(style)) {
    const view = ANALYSIS_LOOKS[style];
    return view ? `${LOOK_GLSL}${ANALYSIS_GLSL}${view.glsl}` : undefined;
  }
  const designed = designedShader(style);
  if (designed !== undefined) {
    return `${LOOK_GLSL}${designed}`;
  }
  const look = LOOKS[style];
  return look ? `${LOOK_GLSL}${look.glsl}` : undefined;
};

/**
 * Whether the engine draws `style` with `tuning`: a texture printed in the
 * body is still the 2D canvas's, so a look wearing one stays there.
 */
export const isEngineLookStyle = (
  style: GraphStyle,
  tuning: Pick<
    ILookTuning,
    'filled' | 'texture' | 'accents' | 'accentBehind' | 'border'
  >,
): boolean =>
  shaderOf(style) !== undefined &&
  !(tuning.filled && tuning.texture !== 'none') &&
  // A designed scene's border, and lit peaks hidden behind its figure, are
  // the page's general painter's, cut against the figure's own path: with
  // either on, the scene stays on the page whole. Lit peaks in front are
  // printed by the page over the engine's picture.
  !(
    isDesignedLookStyle(style) &&
    (tuning.border || (tuning.accents && tuning.accentBehind))
  );

/** The step for a frame of the drawn look `style`. */
export const engineLookStep = (
  style: GraphStyle,
): TEngineLookStep | undefined => LOOKS[style]?.step;

/** The step for a frame of the measuring view `style`. */
export const engineAnalysisStep = (
  style: TAnalysisStyle,
): TEngineAnalysisStep | undefined => ANALYSIS_LOOKS[style]?.step;

/**
 * Bumped when a look's shader changes, so a program the engine keeps by its
 * source is built again rather than taken from a cache under the old one.
 */
const LOOK_PACK_VERSION = 1;

const packs = new Map<GraphStyle, IScenePack>();

/** The look as a scene pack, which is what the engine runs. */
export const engineLookPack = (style: GraphStyle): IScenePack | undefined => {
  const source = shaderOf(style);
  if (source === undefined) {
    return undefined;
  }
  const known = packs.get(style);
  if (known) {
    return known;
  }
  const pack: IScenePack = {
    schema: SCENE_PACK_SCHEMA,
    id: `fluideq-look:${style}`,
    version: LOOK_PACK_VERSION,
    contract: SCENE_CONTRACT_VERSION,
    names: { en: GRAPH_STYLE_LABELS[style] },
    fallbackStyle: style,
    swatch: [],
    source,
    params: [],
  };
  packs.set(style, pack);
  return pack;
};
