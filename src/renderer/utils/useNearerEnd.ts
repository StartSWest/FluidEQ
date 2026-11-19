/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SCENE_DAYLIGHT_MAX, SCENE_DAYLIGHT_MIN } from 'common/sceneDaylight';
import { usePageDaylight } from '../graph/sceneDaylight';
import type { TWindowEnd } from './windowTimeNames';

/** From here up the scene's hour is nearer its day than its night. */
const DAY_FROM = (SCENE_DAYLIGHT_MIN + SCENE_DAYLIGHT_MAX) / 2;

/** The end of the day the scene's hour is nearer: the Studio Brightness's ends. */
export function useNearerEnd(): TWindowEnd {
  return usePageDaylight() >= DAY_FROM ? 'day' : 'night';
}
