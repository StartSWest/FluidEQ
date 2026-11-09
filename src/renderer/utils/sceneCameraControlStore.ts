/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  normalizeSceneCameraControl,
  sameSceneCameraControl,
  type ISceneCameraControl,
} from 'common/sceneCameraControl';
import { readStored, writeStored } from './graphStorage';

/**
 * How the camera of a 3D scene is moved (`common/sceneCameraControl.ts`):
 * one choice for every scene the window draws, read on every gesture by
 * `sceneInteraction.ts`, so a change holds from the next move.
 *
 * Told to main as well, as the drawing choice is (`scenePerformanceStore`):
 * the desktop background is another window with a storage of its own, and
 * its helper is what reads the key over the desktop.
 */

export const SCENE_CAMERA_CONTROL_KEY = 'fluideq.sceneCameraControl';

interface ICameraControlBridge {
  setSceneCameraControl?: (value: ISceneCameraControl) => void;
}

const bridge = (): ICameraControlBridge | undefined =>
  window.electron?.ipcRenderer as ICameraControlBridge | undefined;

const read = (): ISceneCameraControl => {
  const stored = readStored(SCENE_CAMERA_CONTROL_KEY);
  if (stored === null) {
    return normalizeSceneCameraControl(undefined);
  }
  try {
    return normalizeSceneCameraControl(JSON.parse(stored));
  } catch {
    // A damaged entry means the default, which is what it stood for.
    return normalizeSceneCameraControl(undefined);
  }
};

let value = read();
let told = false;
const listeners = new Set<() => void>();

const tellMain = () => {
  told = true;
  bridge()?.setSceneCameraControl?.(value);
};

export const readSceneCameraControl = (): ISceneCameraControl => {
  // Main learns the choice the first time anything reads it, so a desktop
  // background started before the View menu was ever opened follows it.
  if (!told) {
    tellMain();
  }
  return value;
};

export const setSceneCameraControl = (next: Partial<ISceneCameraControl>) => {
  const merged = normalizeSceneCameraControl({ ...value, ...next });
  if (sameSceneCameraControl(merged, value)) {
    return;
  }
  value = merged;
  writeStored(SCENE_CAMERA_CONTROL_KEY, JSON.stringify(merged));
  tellMain();
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useSceneCameraControl = (): ISceneCameraControl =>
  useSyncExternalStore(subscribe, readSceneCameraControl);

/** For a test: back to what storage holds, and main not yet told. */
export const resetSceneCameraControlForTesting = () => {
  value = read();
  told = false;
  listeners.forEach((listener) => listener());
};
