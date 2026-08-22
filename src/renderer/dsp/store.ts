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

/**
 * Whether the chain is running, and — crucially — whether it ever tried.
 *
 * Three states rather than a boolean, because the boolean version shipped and
 * lied. `LibraryPlayerProvider` only mounts once the user has opened the
 * Library (`hasOpenedLibrary` in `App.tsx`), and the engine lives inside it,
 * so opening the DSP tab first means the engine has not run at all. With one
 * flag that is indistinguishable from a failure, and the panel told people
 * audio processing "could not start on this machine" when nothing had been
 * attempted and the machine was fine.
 */
export type TDspEngineState = 'idle' | 'running' | 'failed';

let settings: IDspSettings = DSP_DEFAULTS;
let loaded = false;
let engineState: TDspEngineState = 'idle';
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

/**
 * Apply settings now. Audible immediately, not written to disk.
 *
 * Split from persistence for the same reason the volume fader is: a vertical
 * slider dragged across its range fires a change per step, and
 * `localStorage.setItem` is synchronous. The sound has to follow the pointer,
 * so the saving gets out of its way and happens once, on release.
 */
export const applyDspSettings = (next: IDspSettings): void => {
  settings = clampDspSettings(next);
  loaded = true;
  emit();
};

/** Write whatever is currently applied. Called when a gesture ends. */
export const persistDspSettings = (): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(readDspSettings()));
  } catch {
    // A full or disabled store costs persistence, not the session. The chain
    // keeps running on whatever is in memory.
  }
};

/** Apply and persist in one step, for a control with no drag to protect. */
export const writeDspSettings = (next: IDspSettings): void => {
  applyDspSettings(next);
  persistDspSettings();
};

/** Reported by the engine. Only it may move this off `idle`. */
export const setDspEngineState = (next: TDspEngineState): void => {
  if (next === engineState) {
    return;
  }
  engineState = next;
  emit();
};

export const readDspEngineState = (): TDspEngineState => engineState;

export const useDspSettings = (): IDspSettings =>
  useSyncExternalStore(subscribe, readDspSettings, readDspSettings);

export const useDspEngineState = (): TDspEngineState =>
  useSyncExternalStore(subscribe, readDspEngineState, readDspEngineState);
