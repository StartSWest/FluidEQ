/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILightingFrame } from './lightingModel';

/**
 * What the window tells main about the desk lights, and what main shows the
 * window of them.
 *
 * The lamps are drawn by `FluidEQ-Scenes.exe`, which main runs (`lampScenes.ts`),
 * so they light the desk with the window in the tray or let go of. What only
 * the window knows is handed over whole on every change: the look the member
 * chose and whether the account may play it, whether the live displays are
 * paused, the time of day the window asks of its scenes, and its accent.
 * Main keeps the last one, so the desk carries on as it was told when the
 * window goes.
 */

/** Main ← window: the lamps' scene and the window's part of it. */
export const LIGHTING_SCENE_CHANNEL = 'lighting-scene';
/** Main → window: each frame the lamps showed, while the page is open. */
export const LIGHTING_PREVIEW_CHANNEL = 'lighting-preview';

/** The Plus look the desk plays (`lampScene.ts` chooses it). */
export interface ILampScene {
  /** The look the frames are stamped with; its lighting profile is kept under it. */
  lookId: string;
  /** The look at the content it is at now: a new version is loaded when this moves. */
  identity: string;
  /** Its colours, for the frames it cannot be drawn for. */
  swatch: readonly string[];
  /** Somebody's own scene, drawn through the flash limiter. */
  guarded: boolean;
}

/** The window's time of day: the clock's, or a value it holds. */
export type TLampDaylight = { clock: true } | { clock: false; value: number };

export interface ILampSceneChoice {
  /** Nothing when the member's look is not a Plus one the account owns. */
  scene: ILampScene | null;
  /** The live displays are paused: the desk holds what it showed. */
  paused: boolean;
  daylight: TLampDaylight;
  /** The window's accent, unit RGB, for a scene that paints with it. */
  accent: [number, number, number];
}

/** The picture the lamps' scene was drawn as, for the page's swatch. */
export interface ILampPicture {
  width: number;
  height: number;
  /** `width × height × 3` sRGB bytes, top row first. */
  rgb: Uint8Array;
}

export interface ILampPreview {
  frame: ILightingFrame;
  /** Only with a frame drawn from the scene itself, never its colours. */
  picture?: ILampPicture;
}

/** No swatch or look id main would act on is longer than this. */
const MAX_TEXT = 512;
const MAX_SWATCH = 64;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_TEXT;

const unit = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : undefined;

const readScene = (raw: unknown): ILampScene | null | undefined => {
  if (raw === null) {
    return null;
  }
  if (
    !isRecord(raw) ||
    !isText(raw.lookId) ||
    !isText(raw.identity) ||
    typeof raw.guarded !== 'boolean' ||
    !Array.isArray(raw.swatch) ||
    raw.swatch.length > MAX_SWATCH ||
    !raw.swatch.every(isText)
  ) {
    return undefined;
  }
  return {
    lookId: raw.lookId,
    identity: raw.identity,
    swatch: [...(raw.swatch as string[])],
    guarded: raw.guarded,
  };
};

const readDaylight = (raw: unknown): TLampDaylight | undefined => {
  if (!isRecord(raw)) {
    return undefined;
  }
  if (raw.clock === true) {
    return { clock: true };
  }
  return raw.clock === false &&
    typeof raw.value === 'number' &&
    Number.isFinite(raw.value)
    ? { clock: false, value: raw.value }
    : undefined;
};

/** What the window sent, or nothing when it is not a choice main can act on. */
export const readLampSceneChoice = (
  raw: unknown,
): ILampSceneChoice | undefined => {
  if (!isRecord(raw) || typeof raw.paused !== 'boolean') {
    return undefined;
  }
  const scene = readScene(raw.scene);
  const daylight = readDaylight(raw.daylight);
  const accent = Array.isArray(raw.accent) ? raw.accent.map(unit) : undefined;
  if (
    scene === undefined ||
    daylight === undefined ||
    accent?.length !== 3 ||
    accent.some((channel) => channel === undefined)
  ) {
    return undefined;
  }
  return {
    scene,
    paused: raw.paused,
    daylight,
    accent: accent as [number, number, number],
  };
};
