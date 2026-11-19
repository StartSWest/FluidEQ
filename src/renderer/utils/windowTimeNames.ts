/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';

/** The two ends of a scene's day: the Studio Brightness's two labels. */
export type TWindowEnd = 'night' | 'day';
export const WINDOW_ENDS: readonly TWindowEnd[] = ['night', 'day'];

/**
 * What each end of a scene's day is called, wherever a person reads it.
 * Apart from `sceneDayColours.ts`, which main loads and which names nothing.
 */
const WINDOW_TIME_NAME: Record<TWindowEnd, TranslationKey> = {
  night: 'graph.sceneColours.night',
  day: 'graph.sceneColours.day',
};

export default WINDOW_TIME_NAME;
