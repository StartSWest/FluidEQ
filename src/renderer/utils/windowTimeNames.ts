/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import type { TWindowColourStop } from './sceneDayColours';

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

/**
 * What each of the five points of a scene's window colours is called on the
 * editors' cards (Ivan, 2026-11-18: "0, 25, 50 and 75 ... plus 100% which is
 * the white one"): the hour, and the name of the three that have one.
 */
export const WINDOW_STOP_NAME: Record<TWindowColourStop, TranslationKey> = {
  '0': 'graph.sceneColours.stopNight',
  '25': 'graph.sceneColours.stop25',
  '50': 'graph.sceneColours.stop50',
  '75': 'graph.sceneColours.stopDay',
  '100': 'graph.sceneColours.stopWhite',
};

export default WINDOW_TIME_NAME;
