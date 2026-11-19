/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useState } from 'react';
import { SCENE_DAYLIGHT_MAX, SCENE_DAYLIGHT_MIN } from 'common/sceneDaylight';
import { usePageDaylight } from '../graph/sceneDaylight';
import {
  hourOfStop,
  nearestStop,
  type TWindowColourStop,
} from './sceneDayColours';
import {
  getSceneDaylightSetting,
  setSceneDaylight,
} from './sceneDaylightSetting';
import { setThemeShade } from './theme';
import { THEME_SHADE_MAX, THEME_SHADE_MIN } from './themeShade';
import type { TWindowEnd } from './windowTimeNames';

/** The Brightness that asks a scene for `daylight` (`daylightOfShade`'s inverse). */
const shadeOfDaylight = (daylight: number): number =>
  Math.round(
    THEME_SHADE_MIN +
      ((daylight - SCENE_DAYLIGHT_MIN) /
        (SCENE_DAYLIGHT_MAX - SCENE_DAYLIGHT_MIN)) *
        (THEME_SHADE_MAX - THEME_SHADE_MIN),
  );

/**
 * Carries the hour exactly onto `stop` (Ivan, 2026-11-18: "I want when the
 * color is chosen to change the app so I can see it right there"), through
 * whatever the hour comes from: the Brightness (the Studio always), or the
 * time of day set on its own. The window then wears that point's colours,
 * and the picker's colours on the whole window are that point's. The clock
 * is the clock and is never moved; the point still opens.
 */
const carryHourTo = (stop: TWindowColourStop) => {
  const { source } = getSceneDaylightSetting();
  if (source === 'clock') {
    return;
  }
  if (source === 'own') {
    setSceneDaylight(hourOfStop(stop));
  } else {
    setThemeShade(shadeOfDaylight(hourOfStop(stop)));
  }
};

/** The point the scene's hour is nearest now. */
export function useNearestStop(): TWindowColourStop {
  return nearestStop(usePageDaylight());
}

/** From here up the scene's hour is nearer its day than its night. */
const DAY_FROM = (SCENE_DAYLIGHT_MIN + SCENE_DAYLIGHT_MAX) / 2;

/** The end of the day the scene's hour is nearer: the Studio Brightness's ends. */
export function useNearerEnd(): TWindowEnd {
  return usePageDaylight() >= DAY_FROM ? 'day' : 'night';
}

/**
 * Which point's colours a window colour editor has open: the point the
 * scene's hour is nearest, and the next one the moment the Brightness - or
 * the clock - carries the hour nearer to it. A point pressed by hand moves
 * the hour onto it, so the hour and the open point agree; with the clock in
 * charge the pressed point stays open until the hour comes nearer another.
 *
 * The two directions never feed each other (Ivan, 2026-11-18: "make sure
 * you don't create a loop ... don't jump the slider back"): the hour moving
 * opens a point through the state alone, and only a press on a point - the
 * setter returned here - moves the hour, onto the point pressed, where the
 * nearest point already is the one open.
 */
export default function useEditedStop(): [
  TWindowColourStop,
  (stop: TWindowColourStop) => void,
] {
  const nearest = useNearestStop();
  const [editing, setEditing] = useState<TWindowColourStop>(nearest);
  const [followed, setFollowed] = useState<TWindowColourStop>(nearest);
  // Adjusted while rendering, as React has state follow a prop: in an
  // effect the editor would first draw the old point's colours for a frame.
  if (followed !== nearest) {
    setFollowed(nearest);
    setEditing(nearest);
  }
  const press = useCallback((stop: TWindowColourStop) => {
    setEditing(stop);
    carryHourTo(stop);
  }, []);
  return [editing, press];
}
