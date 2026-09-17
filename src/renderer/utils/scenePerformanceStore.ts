/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  DEFAULT_SCENE_PERFORMANCE,
  normalizeScenePerformance,
  sameScenePerformance,
  type IScenePerformance,
} from 'common/scenePerformance';
import { readStored, writeStored } from './graphStorage';

/**
 * The listener's frame rate and resolution choice for Plus visualizers
 * (`common/scenePerformance.ts`), kept on this computer, one for every scene.
 *
 * Told to main as well, because the desktop background is another window
 * with a storage of its own and follows the same choice: main keeps it beside
 * the backgrounds' own settings and hands it to each monitor's page.
 */

const STORAGE_KEY = 'fluideq.scenePerformance';

interface IPerformanceBridge {
  setScenePerformance?: (value: IScenePerformance) => void;
}

const bridge = (): IPerformanceBridge | undefined =>
  window.electron?.ipcRenderer as IPerformanceBridge | undefined;

const read = (): IScenePerformance => {
  const stored = readStored(STORAGE_KEY);
  if (stored === null) {
    return DEFAULT_SCENE_PERFORMANCE;
  }
  try {
    return normalizeScenePerformance(JSON.parse(stored));
  } catch {
    // A damaged entry means the defaults, which is what it stood for.
    return DEFAULT_SCENE_PERFORMANCE;
  }
};

let value = read();
const listeners = new Set<() => void>();
let told = false;

const tellMain = () => {
  told = true;
  bridge()?.setScenePerformance?.(value);
};

export const readScenePerformance = (): IScenePerformance => {
  // Main learns the choice the first time anything reads it, so a desktop
  // background set before the graph's menu was ever opened draws by it too.
  if (!told) {
    tellMain();
  }
  return value;
};

export const setScenePerformance = (next: Partial<IScenePerformance>) => {
  const merged = normalizeScenePerformance({ ...value, ...next });
  if (sameScenePerformance(merged, value)) {
    return;
  }
  value = merged;
  writeStored(STORAGE_KEY, JSON.stringify(value));
  tellMain();
  listeners.forEach((listener) => listener());
};

export const subscribeScenePerformance = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useScenePerformance = (): IScenePerformance =>
  useSyncExternalStore(subscribeScenePerformance, readScenePerformance);

/** For a test: back to what a fresh install has, without touching storage. */
export const resetScenePerformanceForTesting = () => {
  value = read();
  told = false;
  listeners.forEach((listener) => listener());
};
