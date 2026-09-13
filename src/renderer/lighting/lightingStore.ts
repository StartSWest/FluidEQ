/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  DEFAULT_LIGHTING_SETTINGS,
  type ILightingSettings,
  type ILightingState,
} from 'common/lighting/lightingModel';

/**
 * The window's copy of dynamic lighting's state, as the main process last
 * pushed it, and the one way to change the settings.
 *
 * Outside React, like the entitlement store: the graph's lamp button, the
 * Plus page and the lighting loop all read it, and none of them owns it.
 */

const bridge = () => window.electron?.ipcRenderer;

export const NO_LIGHTING_STATE: ILightingState = {
  supported: false,
  searching: false,
  settings: DEFAULT_LIGHTING_SETTINGS,
  devices: [],
  synapse: 'unknown',
  hasRazerDevices: false,
  heldByWindows: [],
  canOpenRazerChroma: false,
  live: false,
};

interface IStoreView {
  state: ILightingState;
  /** Main has answered at least once; until then nothing is known. */
  loaded: boolean;
}

let view: IStoreView = { state: NO_LIGHTING_STATE, loaded: false };
const listeners = new Set<() => void>();
let unsubscribeMain: (() => void) | undefined;

const set = (state: ILightingState) => {
  view = { state, loaded: true };
  listeners.forEach((listener) => listener());
};

const connect = () => {
  const api = bridge();
  if (unsubscribeMain || !api?.onLightingState) {
    return;
  }
  unsubscribeMain = api.onLightingState(set);
  api
    .lightingState()
    .then(set)
    .catch(() => undefined);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  connect();
  return () => {
    listeners.delete(listener);
  };
};

export const useLighting = (): IStoreView =>
  useSyncExternalStore(
    subscribe,
    () => view,
    () => view,
  );

export const setLightingSettings = (next: Partial<ILightingSettings>) => {
  const api = bridge();
  if (!api?.setLightingSettings) {
    return;
  }
  // Shown at once; main's answer replaces it a moment later.
  set({ ...view.state, settings: { ...view.state.settings, ...next } });
  api
    .setLightingSettings(next)
    .then(set)
    .catch(() => undefined);
};

/** For tests: forget everything main said. */
export const resetLightingStore = () => {
  unsubscribeMain?.();
  unsubscribeMain = undefined;
  view = { state: NO_LIGHTING_STATE, loaded: false };
};
