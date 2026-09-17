/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the wave stands: how tall it is drawn and how far its floor is
 * lifted from the bottom edge.
 *
 * Two settings the graph has always had, which a Plus scene is built around
 * — the band its spectrum is drawn in, the room its subject stands in — so
 * the same scene under a low wave and under a full one is two different
 * pictures. An author sets it on the Studio's stage and it is published with
 * the scene (`IScenePack.wave`); a listener's own change wins over it and is
 * remembered per scene, with a way back to what the author meant.
 *
 * Held in `common` because three places now agree on it: the pack, the
 * Studio's stage, and the graph.
 */

export interface ISceneWave {
  /** 0.05 to 1, as the graph's slider: the share of the panel it fills. */
  height: number;
  /** 0 (standing on the bottom edge) to 1 (its floor at the middle). */
  position: number;
}

/** The wave never disappears completely under its own height control. */
export const MIN_SCENE_WAVE_HEIGHT = 0.05;

/** What the graph starts with: the full height, standing on the bottom. */
export const DEFAULT_SCENE_WAVE: ISceneWave = { height: 1, position: 0 };

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** Values as a slider shows them: whole percents, which is what it sets. */
const tidy = (value: number) => Math.round(value * 100) / 100;

export const sameSceneWave = (a: ISceneWave, b: ISceneWave) =>
  Math.abs(a.height - b.height) < 1e-6 &&
  Math.abs(a.position - b.position) < 1e-6;

export const isDefaultSceneWave = (wave: ISceneWave) =>
  sameSceneWave(wave, DEFAULT_SCENE_WAVE);

/**
 * A wave read from a scene's `pack.json` or from this computer's own store,
 * or nothing when it says nothing usable.
 *
 * Kept in range rather than refused, as a response is: a height past the
 * slider's end is still the author's meaning, and the ends are what the wave
 * can actually be drawn in.
 */
export const readSceneWave = (raw: unknown): ISceneWave | undefined => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return undefined;
  }
  const { height, position } = raw as Record<string, unknown>;
  if (
    typeof height !== 'number' ||
    !Number.isFinite(height) ||
    typeof position !== 'number' ||
    !Number.isFinite(position)
  ) {
    return undefined;
  }
  return {
    height: tidy(clamp(height, MIN_SCENE_WAVE_HEIGHT, 1)),
    position: tidy(clamp(position, 0, 1)),
  };
};
