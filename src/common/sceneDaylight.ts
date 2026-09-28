/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePack } from './scenePacks';

/**
 * THE TIME OF DAY A SCENE IS PLAYED AT (Ivan, 2026-09-27: "can plus viz also
 * light with the theme if dark more toward the night and if light more
 * toward the day ... 0 fully night 100 fully day").
 *
 * Every scene has a control of this id, 0 to 100, and draws night at 0, day
 * at 100 and a believable blend of the two at every value between. FluidEQ
 * sets it itself, from the window's Brightness (0 for Black, 100 for the
 * light end of Ocean), and eases it when the Brightness moves, so the scene
 * dims into night or brightens into day with the window.
 *
 * A control rather than a uniform of its own, on purpose: every FluidEQ
 * declares a pack's controls from the pack itself, so a scene that answers
 * to the time of day still compiles on an app that has never heard of it -
 * there it is simply a slider, standing where the pack's `value` says. A new
 * uniform would have broken every such scene on every older app.
 */
export const SCENE_DAYLIGHT_PARAM = 'daylight';
export const SCENE_DAYLIGHT_MIN = 0;
export const SCENE_DAYLIGHT_MAX = 100;

/** `value` held to the time of day's own range. */
export const clampDaylight = (value: number): number =>
  Math.min(SCENE_DAYLIGHT_MAX, Math.max(SCENE_DAYLIGHT_MIN, value));

/** Whether `pack` answers to the time of day. */
export const hasSceneDaylight = (pack: Pick<IScenePack, 'params'>): boolean =>
  pack.params.some((param) => param.id === SCENE_DAYLIGHT_PARAM);

/**
 * Whether a project's raw `params` carry the time of day as FluidEQ sets it:
 * its id, over exactly 0 to 100. The Studio requires it of every scene it
 * builds; a scene already out in the world is never refused for lacking it.
 */
export const declaresSceneDaylight = (params: unknown): boolean =>
  Array.isArray(params) &&
  params.some(
    (param: unknown) =>
      typeof param === 'object' &&
      param !== null &&
      (param as Record<string, unknown>).id === SCENE_DAYLIGHT_PARAM &&
      (param as Record<string, unknown>).min === SCENE_DAYLIGHT_MIN &&
      (param as Record<string, unknown>).max === SCENE_DAYLIGHT_MAX,
  );
