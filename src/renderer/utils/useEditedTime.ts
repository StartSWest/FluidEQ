/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useState } from 'react';
import { SCENE_DAYLIGHT_MAX, SCENE_DAYLIGHT_MIN } from 'common/sceneDaylight';
import { pageDaylight, usePageDaylight } from '../graph/sceneDaylight';
import type { TWindowTime } from './sceneDayColours';
import {
  getSceneDaylightSetting,
  setSceneDaylight,
} from './sceneDaylightSetting';
import { setThemeShade } from './theme';
import { DARK_END_SHADE, THEME_SHADE_MAX, THEME_SHADE_MIN } from './themeShade';

/** From here up the scene's hour is nearer its day than its night. */
const DAY_FROM = (SCENE_DAYLIGHT_MIN + SCENE_DAYLIGHT_MAX) / 2;

/**
 * Where a press on Night or Day puts the hour (Ivan, 2026-11-18: "click
 * night or day also move the sliders, 25% on night and 75% on day"): a
 * quarter in from each end, well inside its own half, so the tab pressed is
 * the one the hour then stands nearer.
 */
const HOUR_OF: Record<TWindowTime, number> = {
  night: SCENE_DAYLIGHT_MIN + (SCENE_DAYLIGHT_MAX - SCENE_DAYLIGHT_MIN) / 4,
  day: SCENE_DAYLIGHT_MIN + ((SCENE_DAYLIGHT_MAX - SCENE_DAYLIGHT_MIN) * 3) / 4,
};

/** The Brightness that asks a scene for `daylight` (`daylightOfShade`'s inverse). */
const shadeOfDaylight = (daylight: number): number =>
  Math.round(
    THEME_SHADE_MIN +
      ((daylight - SCENE_DAYLIGHT_MIN) /
        (SCENE_DAYLIGHT_MAX - SCENE_DAYLIGHT_MIN)) *
        (THEME_SHADE_MAX - THEME_SHADE_MIN),
  );

/**
 * Where a press puts the Brightness. Day's 75 was the last shade of the dark
 * window (the white one starts past `DARK_END_SHADE`, 76), so a press on Day
 * painted the day colours for a moment and then settled the window dark
 * (Ivan, 2026-11-18: "when I select day, for a moment it's light, but then
 * it gets dark"). Day is the middle of the white window's range instead, a
 * Brightness the day colours are worn at; Night stays at its quarter.
 */
const SHADE_OF: Record<TWindowTime, number> = {
  night: shadeOfDaylight(HOUR_OF.night),
  day: Math.round((DARK_END_SHADE + 1 + THEME_SHADE_MAX) / 2),
};

/**
 * Carries the hour to `time`'s quarter, through whatever the hour comes
 * from: the Brightness (the Studio always), or the time of day set on its
 * own. Only when the hour is nearer the other time: a press on the time
 * already near leaves the slider where it was put. The clock is the clock
 * and is never moved; the tab still opens.
 */
const carryHourTo = (time: TWindowTime) => {
  const { source } = getSceneDaylightSetting();
  const nearNow: TWindowTime = pageDaylight() >= DAY_FROM ? 'day' : 'night';
  if (source === 'clock' || nearNow === time) {
    return;
  }
  if (source === 'own') {
    setSceneDaylight(HOUR_OF[time]);
  } else {
    setThemeShade(SHADE_OF[time]);
  }
};

/** The time the scene's hour is nearer now: its night's or its day's. */
export function useNearerTime(): TWindowTime {
  return usePageDaylight() >= DAY_FROM ? 'day' : 'night';
}

/**
 * Which time's colours a window colour editor has open (Ivan, 2026-11-18:
 * "que el slider también seleccione el card de colores de día si paso a día
 * y así para si paso a noche"): the time the scene's hour is nearer, and
 * the other one the moment the Brightness - or the clock - carries the hour
 * across the middle of the day. A tab pressed by hand stays open until the
 * hour crosses again, so looking at the night's colours at noon is still a
 * click away.
 *
 * The two directions never feed each other (Ivan, 2026-11-18: "make sure
 * you don't create a loop ... don't jump the slider back"): the hour moving
 * opens a tab through the state alone, and only a press on a tab - the
 * setter returned here - moves the hour, and then only across the middle,
 * to the quarter of the time pressed, where the hour already agrees with it.
 */
export default function useEditedTime(): [
  TWindowTime,
  (time: TWindowTime) => void,
] {
  const nearer = useNearerTime();
  const [editing, setEditing] = useState<TWindowTime>(nearer);
  const [followed, setFollowed] = useState<TWindowTime>(nearer);
  // Adjusted while rendering, as React has state follow a prop: in an
  // effect the editor would first draw the old time's colours for a frame.
  if (followed !== nearer) {
    setFollowed(nearer);
    setEditing(nearer);
  }
  const press = useCallback((time: TWindowTime) => {
    setEditing(time);
    carryHourTo(time);
  }, []);
  return [editing, press];
}
