/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SMOOTH_FRAME_MS } from './smoothing';

/**
 * How hard a Plus visualizer is allowed to drive the GPU, and how its picture
 * is finished, as the listener chose it: on the graph, in the Studio and on
 * the desktop alike.
 *
 * - The frame rate. `display` draws every frame the monitor shows — 60, 100,
 *   144, whatever it runs at; the two caps are for a hot laptop or a desktop
 *   background that should not cost a fan. On battery, `display` is held to
 *   sixty by itself. Scenes used to be held at thirty everywhere, which was
 *   the 2D graph's budget applied to a picture that costs the page nothing.
 * - The resolution. `auto` draws at the panel's own pixels while the GPU
 *   keeps up with the frame rate, and smaller when it does not
 *   (`sceneHealth.ts`). `native` never draws smaller. The three presets are
 *   what games call DLSS or FSR Quality, Balanced and Performance: always
 *   drawn at that fraction of the panel and brought up to size every frame.
 * - The scaler that brings a smaller picture up to size: AMD's FSR 1 (sharp,
 *   `sceneUpscale.ts`) or a plain smooth stretch, which costs nothing.
 * - Smooth edges. `fast` is FXAA over the finished picture; `best` draws the
 *   scene larger than the panel and averages it down — real anti-aliasing,
 *   for the GPUs that can afford it — with FXAA on what is left.
 *
 * Shared with main because the desktop background is drawn in another window
 * with a storage of its own; the choice travels there through main.
 */

export type TSceneFrameRate = 'display' | 'sixty' | 'thirty';
export type TSceneResolution =
  'auto' | 'native' | 'quality' | 'balanced' | 'performance';
export type TSceneUpscaler = 'fsr' | 'simple';
export type TSceneSmoothing = 'off' | 'fast' | 'best';

/**
 * The smallest picture `auto` may draw, as a scale of the panel: the
 * controller's rungs stop here, and a scene still too slow for the smallest
 * allowed picture slows to thirty frames a second before it stops
 * (`sceneHealth.ts`). 0.35 is the controller's own floor — every scene runs
 * somewhere; a listener who would rather have a sharper picture at a lower
 * rate raises it.
 */
export const SCENE_AUTO_FLOORS = [0.35, 0.5, 0.67, 0.85] as const;
export type TSceneAutoFloor = (typeof SCENE_AUTO_FLOORS)[number];

export interface IScenePerformance {
  frameRate: TSceneFrameRate;
  resolution: TSceneResolution;
  /** Only read under `auto`. */
  autoFloor: TSceneAutoFloor;
  upscaler: TSceneUpscaler;
  smoothing: TSceneSmoothing;
}

export const SCENE_FRAME_RATES: readonly TSceneFrameRate[] = [
  'display',
  'sixty',
  'thirty',
];

export const SCENE_RESOLUTIONS: readonly TSceneResolution[] = [
  'auto',
  'native',
  'quality',
  'balanced',
  'performance',
];

export const SCENE_UPSCALERS: readonly TSceneUpscaler[] = ['fsr', 'simple'];

export const SCENE_SMOOTHINGS: readonly TSceneSmoothing[] = [
  'off',
  'fast',
  'best',
];

/**
 * What a listener gets before touching the View menu: every frame the
 * display offers, the controller choosing the size, AMD's FSR bringing a
 * smaller picture up, and FXAA over it — the fast smoothing, a millisecond at
 * 1440p on a laptop's discrete chip and two on its integrated one, which is
 * what Ivan chose as the default on 2026-09-16.
 */
export const DEFAULT_SCENE_PERFORMANCE: IScenePerformance = {
  frameRate: 'display',
  resolution: 'auto',
  autoFloor: 0.35,
  upscaler: 'fsr',
  smoothing: 'fast',
};

/**
 * The presets' scales: AMD's own FSR Quality, Balanced and Performance,
 * which are what the upscale pass is tuned for. Fixed, whatever the GPU
 * does — that is what a preset is for.
 */
export const SCENE_PRESET_SCALES: Record<
  Exclude<TSceneResolution, 'auto' | 'native'>,
  number
> = {
  quality: 0.77,
  balanced: 0.67,
  performance: 0.5,
};

/**
 * How much larger than the panel `best` smoothing draws, each way: four
 * samples per pixel, averaged. Held to the same pixel budget as everything
 * else (`useSceneRunner.ts`), so a 4K panel gets what fits.
 */
export const SCENE_SUPERSAMPLE = 2;

/**
 * The scale a resolution choice pins the picture to, or undefined when the
 * controller decides (`auto`).
 */
export const scenePinnedScale = (
  resolution: TSceneResolution,
): number | undefined => {
  switch (resolution) {
    case 'auto':
      return undefined;
    case 'native':
      return 1;
    default:
      return SCENE_PRESET_SCALES[resolution];
  }
};

/**
 * The least time between two drawn frames for a frame-rate choice. Zero means
 * every frame the display offers, which is how euphoria has always drawn.
 * On battery the display rate is held to sixty: a laptop unplugged is not
 * where a hundred and forty-four frames a second earn their power.
 */
export const scenePaceMs = (
  frameRate: TSceneFrameRate,
  onBattery = false,
): number => {
  switch (frameRate) {
    case 'display':
      return onBattery ? 1000 / 60 : 0;
    case 'sixty':
      return 1000 / 60;
    case 'thirty':
    default:
      return SMOOTH_FRAME_MS;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const oneOf = <T extends string | number>(
  list: readonly T[],
  value: unknown,
): value is T => list.some((entry) => entry === value);

export const isScenePerformance = (raw: unknown): raw is IScenePerformance =>
  isRecord(raw) &&
  oneOf(SCENE_FRAME_RATES, raw.frameRate) &&
  oneOf(SCENE_RESOLUTIONS, raw.resolution) &&
  oneOf(SCENE_AUTO_FLOORS, raw.autoFloor) &&
  oneOf(SCENE_UPSCALERS, raw.upscaler) &&
  oneOf(SCENE_SMOOTHINGS, raw.smoothing);

/** A stored or received value, repaired field by field to something usable. */
export const normalizeScenePerformance = (raw: unknown): IScenePerformance => {
  if (!isRecord(raw)) {
    return DEFAULT_SCENE_PERFORMANCE;
  }
  return {
    frameRate: oneOf(SCENE_FRAME_RATES, raw.frameRate)
      ? raw.frameRate
      : DEFAULT_SCENE_PERFORMANCE.frameRate,
    resolution: oneOf(SCENE_RESOLUTIONS, raw.resolution)
      ? raw.resolution
      : DEFAULT_SCENE_PERFORMANCE.resolution,
    autoFloor: oneOf(SCENE_AUTO_FLOORS, raw.autoFloor)
      ? raw.autoFloor
      : DEFAULT_SCENE_PERFORMANCE.autoFloor,
    upscaler: oneOf(SCENE_UPSCALERS, raw.upscaler)
      ? raw.upscaler
      : DEFAULT_SCENE_PERFORMANCE.upscaler,
    smoothing: oneOf(SCENE_SMOOTHINGS, raw.smoothing)
      ? raw.smoothing
      : DEFAULT_SCENE_PERFORMANCE.smoothing,
  };
};

export const sameScenePerformance = (
  a: IScenePerformance,
  b: IScenePerformance,
): boolean =>
  a.frameRate === b.frameRate &&
  a.resolution === b.resolution &&
  a.autoFloor === b.autoFloor &&
  a.upscaler === b.upscaler &&
  a.smoothing === b.smoothing;
