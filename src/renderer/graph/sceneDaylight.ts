/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  clampDaylight,
  clockDaylight,
  followDaylight,
  SCENE_DAYLIGHT_MAX,
  SCENE_DAYLIGHT_MIN,
  SCENE_DAYLIGHT_PARAM,
  type IDaylightFollower,
} from 'common/sceneDaylight';
import type { IScenePack } from 'common/scenePacks';
import {
  getSceneDaylightSetting,
  useSceneDaylightSetting,
} from '../utils/sceneDaylightSetting';
import { getThemeShade, useThemeShade } from '../utils/theme';
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

/**
 * THE CLOCK, AS THE PAGE'S COMPONENTS SEE IT. A scene reads the time of day
 * on every frame it draws (`createDaylightFollower`), and a clock read there
 * is always the clock's; but a component — the Daylight slider's reading,
 * the window colour's step of the day — only draws when told something
 * changed. The frames already being drawn are what tell it: each read of
 * the clock through `pageDaylight` rings the components when the whole
 * number has moved, which in a morning or an evening is about every ninety
 * seconds and the rest of the day never. With no scene drawing, the window
 * coming back into view or into focus asks the clock again.
 */
const clockListeners = new Set<() => void>();
let rungClock = Math.round(clockDaylight(new Date()));

const readClock = (): number => {
  const daylight = clockDaylight(new Date());
  const whole = Math.round(daylight);
  if (whole !== rungClock) {
    rungClock = whole;
    clockListeners.forEach((listener) => listener());
  }
  return daylight;
};

const askClockAgain = () => {
  readClock();
};

const subscribeClock = (listener: () => void) => {
  if (clockListeners.size === 0) {
    window.addEventListener('focus', askClockAgain);
    document.addEventListener('visibilitychange', askClockAgain);
  }
  clockListeners.add(listener);
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0) {
      window.removeEventListener('focus', askClockAgain);
      document.removeEventListener('visibilitychange', askClockAgain);
    }
  };
};

/**
 * The time of day the window asks of its scenes: the Brightness's, the
 * clock's, or the one the listener set apart in Window colours
 * (`sceneDaylightSetting.ts`), when Brightness changes only the window.
 */
export const pageDaylight = (): number => {
  const setting = getSceneDaylightSetting();
  if (setting.source === 'clock') {
    return readClock();
  }
  return setting.source === 'brightness'
    ? daylightOfShade(getThemeShade())
    : setting.daylight;
};

/** The same, kept current for a component, to the whole number. */
export const usePageDaylight = (): number => {
  const setting = useSceneDaylightSetting();
  const shade = useThemeShade();
  const clock = useSyncExternalStore(subscribeClock, () => rungClock);
  if (setting.source === 'clock') {
    return clock;
  }
  return setting.source === 'brightness'
    ? daylightOfShade(shade)
    : setting.daylight;
};

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

export type { IDaylightFollower };

/** `followDaylight`, reading the window's own time of day unless told another. */
export const createDaylightFollower = (
  read: () => number = pageDaylight,
): IDaylightFollower => followDaylight(read);
