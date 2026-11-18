/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import type { TWindowTime } from './sceneDayColours';

/**
 * What each time of a scene's window colours is called, wherever a person
 * reads it: the editors' two tabs and the Studio Brightness's two ends.
 * Apart from `sceneDayColours.ts`, which main loads and which names nothing.
 */
const WINDOW_TIME_NAME: Record<TWindowTime, TranslationKey> = {
  night: 'graph.sceneColours.night',
  day: 'graph.sceneColours.day',
};

export default WINDOW_TIME_NAME;
