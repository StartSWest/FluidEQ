/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  DSP_DEFAULTS,
  IDspSettings,
  clampDspSettings,
} from '../../common/dsp/chain';

/**
 * Where the DSP settings live, and why they live outside React state.
 *
 * Two components need them and neither can own them. The panel is rendered by
 * `App`; the engine has to run where the `<audio>` element is, which is inside
 * `LibraryPlayerContext`. Lifting the state to a common ancestor would mean
 * re-rendering the whole player tree on every knob turn, and passing it down
 * would mean threading it through components that have nothing to do with it.
 *
 * Deliberately NOT part of `IState`. `IState` is what gets rendered into
 * Equalizer APO's config, and nothing here reaches APO — this is a Web Audio
 * graph on FluidEQ's own player. Putting it there would make every knob turn
 * rewrite a config file and force APO to reload, for a setting APO never reads.
 */
const STORAGE_KEY = 'fluideq.dsp.v1';

const readStored = (): IDspSettings => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? clampDspSettings(JSON.parse(stored)) : DSP_DEFAULTS;
  } catch {
    // Unreadable or unparseable storage is the same answer as no storage;
    // clamping already covers a blob written by a different build.
    return DSP_DEFAULTS;
  }
};

let settings: IDspSettings = DSP_DEFAULTS;
let loaded = false;
let engineActive = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * The current settings, loaded from storage on first read.
 *
 * Lazily rather than at module load: this module is imported by the player,
 * which is constructed before the renderer has necessarily settled, and a
 * `localStorage` read at import time is a side effect on an import.
 */
export const readDspSettings = (): IDspSettings => {
  if (!loaded) {
    settings = readStored();
    loaded = true;
  }
  return settings;
};

export const writeDspSettings = (next: IDspSettings): void => {
  settings = clampDspSettings(next);
  loaded = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // A full or disabled store costs persistence, not the session. The chain
    // keeps running on whatever is in memory.
  }
  emit();
};

/** Reported by the engine so the panel can say when it could not start. */
export const setDspEngineActive = (active: boolean): void => {
  if (active === engineActive) {
    return;
  }
  engineActive = active;
  emit();
};

export const readDspEngineActive = (): boolean => engineActive;

export const useDspSettings = (): IDspSettings =>
  useSyncExternalStore(subscribe, readDspSettings, readDspSettings);

export const useDspEngineActive = (): boolean =>
  useSyncExternalStore(subscribe, readDspEngineActive, readDspEngineActive);
