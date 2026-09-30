/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { clampDaylight, SCENE_DAYLIGHT_MIN } from 'common/sceneDaylight';
import { readStored, writeStored } from './graphStorage';

/**
 * Where a Plus visualizer's time of day comes from (Ivan, 2026-09-29):
 *
 * - `brightness`: the window's Brightness, dark to night and light to day —
 *   how every scene has played since it learned day and night
 *   (`graph/sceneDaylight.ts`), and still the default;
 * - `clock`: the computer's clock, night at night and day by day ("an option
 *   that follows the time, so when it is on it follows the daytime",
 *   `clockDaylight`);
 * - `own`: the Daylight the listener set, while Brightness changes only the
 *   window ("if off the user can select an individual time of day for the
 *   scene and an individual brightness for the app").
 *
 * Set in the Window colours menu, beside Brightness and Transparency, and
 * kept for the full app and the amp apart, as those two are
 * (`applySceneDaylightScope`, from `App.tsx`).
 */
export type TDaylightSource = 'brightness' | 'clock' | 'own';

export interface ISceneDaylightSetting {
  source: TDaylightSource;
  /** 0 night to 100 full day; what the scene plays at on its `own`. */
  daylight: number;
}

export type TSceneDaylightScope = 'app' | 'player';

const KEYS: Record<TSceneDaylightScope, string> = {
  app: 'fluideq.sceneDaylight',
  player: 'fluideq.sceneDaylight.player',
};

const FOLLOWING: ISceneDaylightSetting = {
  source: 'brightness',
  daylight: SCENE_DAYLIGHT_MIN,
};

const SOURCES: readonly TDaylightSource[] = ['brightness', 'clock', 'own'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSource = (value: unknown): value is TDaylightSource =>
  SOURCES.some((source) => source === value);

/**
 * Where a stored setting says its time of day comes from. The first build of
 * this choice had two ways, kept as `followsBrightness`; one written then is
 * read as the same choice.
 */
const sourceOf = (stored: Record<string, unknown>) => {
  if (isSource(stored.source)) {
    return stored.source;
  }
  if (typeof stored.followsBrightness === 'boolean') {
    return stored.followsBrightness ? 'brightness' : 'own';
  }
  return undefined;
};

/** What was kept for a scope, or undefined where nothing usable was. */
const readSetting = (
  scope: TSceneDaylightScope,
): ISceneDaylightSetting | undefined => {
  const stored = readStored(KEYS[scope]);
  if (stored === null) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    // A value this version did not write; the scene follows Brightness, as
    // it did before there was a choice.
    return undefined;
  }
  if (!isRecord(parsed)) {
    return undefined;
  }
  const source = sourceOf(parsed);
  if (
    !source ||
    typeof parsed.daylight !== 'number' ||
    !Number.isFinite(parsed.daylight)
  ) {
    return undefined;
  }
  return { source, daylight: clampDaylight(parsed.daylight) };
};

const appSetting = readSetting('app') ?? FOLLOWING;
const chosen: Record<TSceneDaylightScope, ISceneDaylightSetting> = {
  app: appSetting,
  // The amp starts on the app's choice until it is given one of its own.
  player: readSetting('player') ?? appSetting,
};
let scope: TSceneDaylightScope = 'app';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

const choose = (next: ISceneDaylightSetting) => {
  const was = chosen[scope];
  if (next.source === was.source && next.daylight === was.daylight) {
    return;
  }
  chosen[scope] = next;
  writeStored(KEYS[scope], JSON.stringify(next));
  notify();
};

/** The window has become the app or the amp: that one's choice applies. */
export const applySceneDaylightScope = (next: TSceneDaylightScope) => {
  if (next === scope) {
    return;
  }
  scope = next;
  notify();
};

export const getSceneDaylightSetting = (): ISceneDaylightSetting =>
  chosen[scope];

/**
 * Where the time of day comes from. Set on its `own`, the scene stays at the
 * time of day it is at (`current`), so letting go of Brightness or the clock
 * changes nothing on screen until the Daylight slider is moved.
 */
export const setDaylightSource = (source: TDaylightSource, current: number) =>
  choose(
    source === 'own'
      ? { source, daylight: clampDaylight(current) }
      : { ...chosen[scope], source },
  );

/** The time of day a scene keeps while it is set on its own. */
export const setSceneDaylight = (daylight: number) =>
  choose({ ...chosen[scope], daylight: clampDaylight(daylight) });

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useSceneDaylightSetting = (): ISceneDaylightSetting =>
  useSyncExternalStore(subscribe, getSceneDaylightSetting, () => FOLLOWING);
