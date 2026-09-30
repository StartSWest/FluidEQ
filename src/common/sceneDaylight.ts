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

/**
 * The control as a project's `pack.json` declares it (`declaresSceneDaylight`
 * is the rule it meets): the starter writes it, and the sentence telling a
 * member whose scene has none shows it. Never a slider on screen — FluidEQ
 * sets it — so its English name is the only one it needs.
 */
export const SCENE_DAYLIGHT_CONTROL = {
  id: SCENE_DAYLIGHT_PARAM,
  names: { en: 'Daylight' },
  min: SCENE_DAYLIGHT_MIN,
  max: SCENE_DAYLIGHT_MAX,
  value: SCENE_DAYLIGHT_MIN,
} as const;

/**
 * The same, as it is written in the file: filled into the sentence rather
 * than written out in each of its ten languages, since it is what goes in
 * `pack.json`, not words.
 */
export const SCENE_DAYLIGHT_DECLARATION = JSON.stringify(
  SCENE_DAYLIGHT_CONTROL,
);

/** `value` held to the time of day's own range. */
export const clampDaylight = (value: number): number =>
  Math.min(SCENE_DAYLIGHT_MAX, Math.max(SCENE_DAYLIGHT_MIN, value));

/**
 * The clock's time of day, in minutes after local midnight: the sky
 * brightens from 05:30 to full day at 08:00, holds it until 17:30, and dims
 * to night by 20:00 — a morning and an evening of two and a half hours
 * each, eased at both ends so neither starts or lands with a step. For the
 * Window colours menu's "Daylight follows the clock" (Ivan, 2026-09-29:
 * "an option that follows the time, so when it is on it follows the
 * daytime"). Fixed hours rather than the sun's: FluidEQ knows the
 * computer's clock and not where on the earth it stands, and the scenes'
 * night and day are looks, not an almanac.
 */
const DAWN_STARTS = 5.5 * 60;
const DAY_STARTS = 8 * 60;
const DUSK_STARTS = 17.5 * 60;
const NIGHT_STARTS = 20 * 60;

/** 0 to 1 between `from` and `to`, eased so it leaves and lands flat. */
const eased = (value: number, from: number, to: number) => {
  const share = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return share * share * (3 - 2 * share);
};

/** The time of day the clock gives a scene at `date`, 0 night to 100 day. */
export const clockDaylight = (date: Date): number => {
  const minutes =
    date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  const light =
    minutes < DUSK_STARTS
      ? eased(minutes, DAWN_STARTS, DAY_STARTS)
      : 1 - eased(minutes, DUSK_STARTS, NIGHT_STARTS);
  return SCENE_DAYLIGHT_MIN + light * (SCENE_DAYLIGHT_MAX - SCENE_DAYLIGHT_MIN);
};

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
