/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { THIRTY_A_SECOND_MS } from './smoothing';

/**
 * How a scene is drawn, as the listener chose it: on the graph, in the Studio
 * and on the desktop alike, and in FluidWallpapers, which draws with this
 * engine and offers the same choices under the same words.
 *
 * Two choices and nothing else (Ivan, 2026-11-27: "I dont want that many
 * options so lets do auto, balance, and full").
 *
 * - The frame rate. `display` draws every frame the monitor shows — 60, 100,
 *   144, whatever it runs at; the caps are for a hot laptop or a desktop
 *   background that should not cost a fan, and `fifteen` is FluidWallpapers'
 *   battery rate. On battery, `display` is held to sixty by itself.
 * - The quality, which is everything else about the picture: its size, the
 *   scaler that brings a smaller picture up to the panel, and the edge
 *   smoothing (`sceneQualityPlan`). Five separate rows used to say these —
 *   resolution, smallest size, scaler, smooth edges, graphics card — and a
 *   listener had to know what each one cost to choose well.
 *
 * Shared with main because the desktop background is drawn in another window
 * with a storage of its own; the choice travels there through main.
 */

export type TSceneFrameRate = 'display' | 'sixty' | 'thirty' | 'fifteen';
export type TSceneQuality = 'auto' | 'balanced' | 'full';

export interface IScenePerformance {
  frameRate: TSceneFrameRate;
  quality: TSceneQuality;
}

export type TScenePerformanceGroup = 'standard' | 'plus';

/** Every frame rate the engine draws at. */
export const SCENE_FRAME_RATES: readonly TSceneFrameRate[] = [
  'display',
  'sixty',
  'thirty',
  'fifteen',
];

/**
 * The frame rates FluidEQ's own menu offers, in the order it cycles them.
 * Fifteen is left out: it exists for a wallpaper on battery, and a fourth
 * stop on a visualizer's row is one more thing to read for nobody.
 */
export const SCENE_MENU_FRAME_RATES: readonly TSceneFrameRate[] = [
  'display',
  'sixty',
  'thirty',
];

export const SCENE_QUALITIES: readonly TSceneQuality[] = [
  'auto',
  'balanced',
  'full',
];

/**
 * What a listener gets before touching anything: every frame the display
 * offers, and the best picture the graphics card holds at that rate. The
 * Standard looks and the Plus scenes each keep their own choice, from this
 * same start.
 */
export const DEFAULT_SCENE_PERFORMANCE: IScenePerformance = {
  frameRate: 'display',
  quality: 'auto',
};

/**
 * How much larger than the panel a scene is drawn for its edges, each way:
 * four samples per pixel, averaged down. Held to the same pixel budget as
 * everything else (`useSceneRunner.ts`), so a 4K panel gets what fits.
 */
export const SCENE_SUPERSAMPLE = 2;

/**
 * The smallest picture Auto draws, as a share of the panel, before it holds
 * the frame rate instead (`sceneLadder.ts`). A twelfth of the pixels: six of
 * the shipped scenes cost 72 to 137 ms a frame at 4K on a laptop's built-in
 * graphics and kept up only down here, and a soft picture of the scene is
 * what a viewer takes over a slide show of it.
 */
export const SCENE_AUTO_FLOOR = 0.35;

/** Balanced never draws under half the panel each way (Ivan, 2026-11-27). */
export const SCENE_BALANCED_FLOOR = 0.5;

/**
 * What is drawn: a scene, or one of the Standard looks. A look is a flat
 * drawing whose shader already gives every line and edge its own coverage,
 * so the finishing passes have nothing to add to it: drawing it larger and
 * averaging down costs four times the fill for the same edges, and FXAA over
 * it only softens hairlines that were exact. What its quality moves is its
 * size alone.
 */
export type TScenePicture = 'scene' | 'look';

/**
 * How a quality choice draws.
 *
 * - `floor`: the smallest share of the panel the size may come down to, or
 *   `top` where it never comes down: the picture stays at its largest and
 *   the frame rate gives way first.
 * - `supersample`: whether the largest size is drawn larger than the panel
 *   and averaged down, wherever the pixel budget leaves room.
 * - `fsr`: whether a picture drawn smaller is brought up by AMD's FSR 1
 *   (sharp, `sceneUpscale.ts`) rather than the compositor's plain stretch.
 *   Tried wherever it is asked for, and given up for the session on a GPU
 *   where its passes prove too dear (`SCENE_FINISH_SHARE`).
 * - `fxaa`: whether FXAA runs over whatever the supersample does not fully
 *   resolve, which at 4K is all of it.
 */
export interface ISceneQualityPlan {
  floor: number | 'top';
  supersample: boolean;
  fsr: boolean;
  fxaa: boolean;
}

const SCENE_PLANS: Record<TSceneQuality, ISceneQualityPlan> = {
  // The best the GPU holds at the frame rate: from the supersampled size
  // down as far as the rate forces it, and back up when there is room.
  auto: { floor: SCENE_AUTO_FLOOR, supersample: true, fsr: true, fxaa: true },
  // Lighter: never larger than the panel, never under half of it, FXAA
  // over every frame.
  balanced: {
    floor: SCENE_BALANCED_FLOOR,
    supersample: false,
    fsr: true,
    fxaa: true,
  },
  // Full size with full edge smoothing on every frame.
  full: { floor: 'top', supersample: true, fsr: true, fxaa: true },
};

const LOOK_PLANS: Record<TSceneQuality, ISceneQualityPlan> = {
  auto: {
    floor: SCENE_AUTO_FLOOR,
    supersample: false,
    fsr: false,
    fxaa: false,
  },
  balanced: {
    floor: SCENE_BALANCED_FLOOR,
    supersample: false,
    fsr: false,
    fxaa: false,
  },
  full: { floor: 'top', supersample: false, fsr: false, fxaa: false },
};

export const sceneQualityPlan = (
  quality: TSceneQuality,
  picture: TScenePicture = 'scene',
): ISceneQualityPlan =>
  picture === 'look' ? LOOK_PLANS[quality] : SCENE_PLANS[quality];

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
    case 'fifteen':
      return 1000 / 15;
    case 'thirty':
    default:
      return THIRTY_A_SECOND_MS;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const oneOf = <T extends string>(
  list: readonly T[],
  value: unknown,
): value is T => list.some((entry) => entry === value);

export const isScenePerformance = (raw: unknown): raw is IScenePerformance =>
  isRecord(raw) &&
  oneOf(SCENE_FRAME_RATES, raw.frameRate) &&
  oneOf(SCENE_QUALITIES, raw.quality);

/**
 * The quality a choice saved before the three existed stood for, or nothing
 * where it said nothing. A listener who pinned the picture to full size gets
 * Full; one who chose a fixed preset, or raised the smallest size Automatic
 * could draw, asked for a lighter or sharper floor and gets Balanced; the
 * rest were on Automatic, which is Auto.
 */
const qualityOfEarlierChoice = (
  raw: Record<string, unknown>,
): TSceneQuality | undefined => {
  switch (raw.resolution) {
    case 'native':
      return 'full';
    case 'quality':
    case 'balanced':
    case 'performance':
      return 'balanced';
    case 'auto':
      return typeof raw.autoFloor === 'number' &&
        raw.autoFloor >= SCENE_BALANCED_FLOOR
        ? 'balanced'
        : 'auto';
    default:
      return undefined;
  }
};

/** A stored or received value, repaired field by field to something usable. */
export const normalizeScenePerformance = (
  raw: unknown,
  defaults: IScenePerformance = DEFAULT_SCENE_PERFORMANCE,
): IScenePerformance => {
  if (!isRecord(raw)) {
    return defaults;
  }
  return {
    frameRate: oneOf(SCENE_FRAME_RATES, raw.frameRate)
      ? raw.frameRate
      : defaults.frameRate,
    quality: oneOf(SCENE_QUALITIES, raw.quality)
      ? raw.quality
      : (qualityOfEarlierChoice(raw) ?? defaults.quality),
  };
};

export const sameScenePerformance = (
  a: IScenePerformance,
  b: IScenePerformance,
): boolean => a.frameRate === b.frameRate && a.quality === b.quality;
