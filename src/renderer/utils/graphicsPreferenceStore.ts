/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type {
  IGraphicsPreferenceState,
  TGpuPreference,
} from 'common/graphicsPreference';

/**
 * Which graphics card the app runs on, as main keeps it
 * (`main/graphicsPreference.ts`): the saved choice, the one this launch was
 * started with, and whether the choice means anything here. Asked once, the
 * first time anything reads it; a change is written through main and the
 * answer main gives back is what is shown, so the row says "after restart"
 * exactly while the two disagree.
 */

interface IGraphicsBridge {
  graphicsPreference?: () => Promise<IGraphicsPreferenceState>;
  setGraphicsPreference?: (
    gpu: TGpuPreference,
  ) => Promise<IGraphicsPreferenceState>;
}

const bridge = (): IGraphicsBridge | undefined =>
  window.electron?.ipcRenderer as IGraphicsBridge | undefined;

/** Until main answers: a choice that means nothing, shown as nothing. */
const UNKNOWN: IGraphicsPreferenceState = {
  chosen: 'auto',
  atLaunch: 'auto',
  supported: false,
};

let state = UNKNOWN;
let asked = false;
const listeners = new Set<() => void>();

const publish = (next: IGraphicsPreferenceState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

const ask = () => {
  if (asked) {
    return;
  }
  asked = true;
  bridge()
    ?.graphicsPreference?.()
    .then(publish)
    .catch(() => undefined);
};

export const readGraphicsPreference = (): IGraphicsPreferenceState => {
  ask();
  return state;
};

export const setGraphicsPreference = (gpu: TGpuPreference) => {
  bridge()
    ?.setGraphicsPreference?.(gpu)
    .then(publish)
    .catch(() => undefined);
};

export const subscribeGraphicsPreference = (listener: () => void) => {
  ask();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useGraphicsPreference = (): IGraphicsPreferenceState =>
  useSyncExternalStore(subscribeGraphicsPreference, readGraphicsPreference);

/** For a test: forget what main said, so the next read asks again. */
export const resetGraphicsPreferenceForTesting = () => {
  state = UNKNOWN;
  asked = false;
};
