/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  clampDaylight,
  SCENE_DAYLIGHT_MAX,
  SCENE_DAYLIGHT_MIN,
  SCENE_DAYLIGHT_PARAM,
} from 'common/sceneDaylight';
import type { IScenePack } from 'common/scenePacks';
import { getThemeShade } from '../utils/theme';
import { THEME_SHADE_MAX, THEME_SHADE_MIN } from '../utils/themeShade';

/**
 * The time of day the window's Brightness asks of a scene
 * (`common/sceneDaylight.ts`): Black is full night, the light end of Ocean
 * full day, and every step of the slider between is that share of the way.
 */
export const daylightOfShade = (shade: number): number =>
  clampDaylight(
    SCENE_DAYLIGHT_MIN +
      ((shade - THEME_SHADE_MIN) / (THEME_SHADE_MAX - THEME_SHADE_MIN)) *
        (SCENE_DAYLIGHT_MAX - SCENE_DAYLIGHT_MIN),
  );

export const pageDaylight = (): number => daylightOfShade(getThemeShade());

/**
 * The time of day a scene's author set it at, as its control's `value`: what
 * it plays at where nothing hands it the window's (a desktop monitor that
 * does not follow the graph). Night for a scene that does not say.
 */
export const authoredDaylight = (pack: Pick<IScenePack, 'params'>): number =>
  clampDaylight(
    pack.params.find((param) => param.id === SCENE_DAYLIGHT_PARAM)?.value ??
      SCENE_DAYLIGHT_MIN,
  );

/**
 * The time of day a scene's colour for the window is measured at, in steps
 * a quarter of the day apart: each step is measured once, so dragging the
 * Brightness does not set a drawing off for every value it passes, and the
 * window takes the colour of the scene's night, its day, and three hours
 * between.
 */
export const daylightTintStep = (daylight: number): number =>
  Math.round(daylight / 25) * 25;

/**
 * How long a playing scene takes to go most of the way (63%) to a new time
 * of day. Dragging the Brightness is followed with no lag worth seeing; a
 * jump - the amp and the app keep a Brightness each - dims or brightens the
 * scene over about a second instead of cutting.
 */
const FOLLOW_MS = 350;
/** Closer than this, the scene is at the time of day it was asked for. */
const ARRIVED = 0.01;

export interface IDaylightFollower {
  /** The time of day to draw this frame at, `deltaMs` after the last. */
  next(deltaMs: number): number;
}

/**
 * The time of day a playing scene is drawn at, frame by frame: where the
 * Brightness is on its first frame, and eased after that, by the frames'
 * own time and never a clock of its own.
 */
export const createDaylightFollower = (
  read: () => number = pageDaylight,
): IDaylightFollower => {
  let value: number | undefined;
  return {
    next: (deltaMs) => {
      const target = read();
      if (value === undefined || Math.abs(value - target) < ARRIVED) {
        value = target;
      } else {
        value =
          target +
          (value - target) * Math.exp(-Math.max(deltaMs, 0) / FOLLOW_MS);
      }
      return value;
    },
  };
};
