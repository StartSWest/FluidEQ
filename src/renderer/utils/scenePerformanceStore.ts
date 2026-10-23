/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useSyncExternalStore } from 'react';
import {
  DEFAULT_SCENE_PERFORMANCE,
  DEFAULT_STANDARD_PERFORMANCE,
  normalizeScenePerformance,
  sameScenePerformance,
  type IScenePerformance,
  type TScenePerformanceGroup,
} from 'common/scenePerformance';
import { readStored, writeStored } from './graphStorage';

/**
 * Two independent drawing preferences: one for Standard looks and one for
 * Plus scenes. Moving Standard looks onto the scene engine must not make
 * them inherit Plus's lower resolution or its edge smoothing.
 *
 * Plus is told to main as well, because the desktop background is another window
 * with a storage of its own and follows the same choice: main keeps it beside
 * the backgrounds' own settings and hands it to each monitor's page.
 */

const STORAGE_KEYS: Record<TScenePerformanceGroup, string> = {
  // Keep the existing key so every saved Plus choice survives the split.
  plus: 'fluideq.scenePerformance',
  standard: 'fluideq.standardPerformance',
};
const DEFAULTS = {
  plus: DEFAULT_SCENE_PERFORMANCE,
  standard: DEFAULT_STANDARD_PERFORMANCE,
};

interface IPerformanceBridge {
  setScenePerformance?: (value: IScenePerformance) => void;
}

const bridge = (): IPerformanceBridge | undefined =>
  window.electron?.ipcRenderer as IPerformanceBridge | undefined;

const read = (group: TScenePerformanceGroup): IScenePerformance => {
  const defaults = DEFAULTS[group];
  const stored = readStored(STORAGE_KEYS[group]);
  if (stored === null) {
    return defaults;
  }
  try {
    return normalizeScenePerformance(JSON.parse(stored), defaults);
  } catch {
    // A damaged entry means the defaults, which is what it stood for.
    return defaults;
  }
};

let values = { plus: read('plus'), standard: read('standard') };
const listeners = new Set<() => void>();
let told = false;

const tellMain = () => {
  told = true;
  bridge()?.setScenePerformance?.(values.plus);
};

export const readScenePerformance = (
  group: TScenePerformanceGroup = 'plus',
): IScenePerformance => {
  // Main learns the choice the first time anything reads it, so a desktop
  // background set before the graph's menu was ever opened draws by it too.
  if (group === 'plus' && !told) {
    tellMain();
  }
  return values[group];
};

export const setScenePerformance = (
  next: Partial<IScenePerformance>,
  group: TScenePerformanceGroup = 'plus',
) => {
  const merged = normalizeScenePerformance(
    { ...values[group], ...next },
    DEFAULTS[group],
  );
  if (sameScenePerformance(merged, values[group])) {
    return;
  }
  values[group] = merged;
  writeStored(STORAGE_KEYS[group], JSON.stringify(merged));
  if (group === 'plus') {
    tellMain();
  }
  listeners.forEach((listener) => listener());
};

export const subscribeScenePerformance = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useScenePerformance = (
  group: TScenePerformanceGroup = 'plus',
): IScenePerformance =>
  useSyncExternalStore(
    subscribeScenePerformance,
    useCallback(() => readScenePerformance(group), [group]),
  );

/** For a test: back to what a fresh install has, without touching storage. */
export const resetScenePerformanceForTesting = () => {
  values = { plus: read('plus'), standard: read('standard') };
  told = false;
  listeners.forEach((listener) => listener());
};
