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

/**
 * The rate the audio graph runs at, once there is one.
 *
 * 48 kHz until the engine says otherwise, because that is what Windows shared
 * mode almost always gives and it has to be *something* for the EQ curve to be
 * drawn against before playback has begun. The curve is drawn from filter
 * coefficients, and coefficients depend on this — so a wrong value here shows
 * up as a response that does not match what will be heard.
 */
const ASSUMED_SAMPLE_RATE = 48_000;

let settings: IDspSettings = DSP_DEFAULTS;
let loaded = false;
let engineState: TDspEngineState = 'idle';
let sampleRate = ASSUMED_SAMPLE_RATE;
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

/** Reported by the engine once its context exists. */
export const setDspSampleRate = (next: number): void => {
  if (!Number.isFinite(next) || next <= 0 || next === sampleRate) {
    return;
  }
  sampleRate = next;
  emit();
};

export const readDspSampleRate = (): number => sampleRate;

export const useDspSampleRate = (): number =>
  useSyncExternalStore(subscribe, readDspSampleRate, readDspSampleRate);

/**
 * The post-chain analyser the EQ page draws its spectrum from.
 *
 * A plain module value, not React state: the graph reads it inside an
 * animation frame sixty times a second, and routing that through a render
 * would be sixty renders a second for a canvas that repaints itself anyway.
 *
 * Typed loosely so nothing outside the engine imports Web Audio — jsdom has
 * none of it, which is why the graph builder is structural too.
 */
export interface IDspAnalyser {
  frequencyBinCount: number;
  getFloatFrequencyData(target: Float32Array): void;
}

let analyser: IDspAnalyser | undefined;

export const setDspAnalyser = (next: IDspAnalyser | undefined): void => {
  analyser = next;
};

export const readDspAnalyser = (): IDspAnalyser | undefined => analyser;

/**
 * Phase correlation of what leaves the chain, reported by the worklet.
 *
 * A plain module value read inside the meter's own animation frame, for the
 * same reason the analyser is: it arrives about twenty-three times a second and
 * routing it through React state would be that many renders for something that
 * paints itself.
 *
 * +1 is identical channels, 0 unrelated, negative is content that will partly
 * cancel the moment anything sums to mono. Starts at 1 because silence has no
 * correlation to report and 0 would read as a warning about nothing.
 */
let correlation = 1;

export const setDspCorrelation = (next: number): void => {
  if (Number.isFinite(next)) {
    correlation = Math.max(-1, Math.min(1, next));
  }
};

export const readDspCorrelation = (): number => correlation;

export const useDspSettings = (): IDspSettings =>
  useSyncExternalStore(subscribe, readDspSettings, readDspSettings);

export const useDspEngineState = (): TDspEngineState =>
  useSyncExternalStore(subscribe, readDspEngineState, readDspEngineState);
