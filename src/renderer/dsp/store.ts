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
import { TDspAnalyserStage } from './monitorOutputs';
import { ILibraryNormalizationAnalysis } from '../../common/library/types';

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

/**
 * Isolate is dropped HERE, on the way out of storage, and nowhere else.
 *
 * It belongs to this one moment: a monitoring mode that survived a restart
 * would have the rack playing harmonics only, with the control that did it two
 * tabs away. But it was first written into `clampDspSettings`, which looked
 * like the same thing and is not — that runs on every patch AND on every
 * message to the worklet, so the flag was stripped between the button and the
 * audio and the mode could never do anything at all.
 *
 * The lesson is the one the sanitiser's own name gives: it exists to make an
 * untrusted blob safe, and "should not persist" is a fact about storage rather
 * than about validity.
 */
const readStored = (): IDspSettings => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DSP_DEFAULTS;
    }
    const settings = clampDspSettings(JSON.parse(stored));
    return {
      ...settings,
      eq: { ...settings.eq, isolate: false },
      exciter: { ...settings.exciter, isolate: false },
    };
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
const IS_DEV = process.env.NODE_ENV !== 'production';

let settings: IDspSettings = DSP_DEFAULTS;
let loaded = false;
let engineState: TDspEngineState = 'idle';
let sampleRate = ASSUMED_SAMPLE_RATE;
/** Ephemeral A/B control. Production is hard-wired to the safe path. */
let outputSafetyEnabled = true;
const listeners = new Set<() => void>();
const outputSafetyListeners = new Set<() => void>();
const inputAnalysisListeners = new Set<() => void>();
const normalizerMeterListeners = new Set<() => void>();

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

export const readDspOutputSafetyEnabled = (): boolean => outputSafetyEnabled;

export const setDspOutputSafetyEnabled = (next: boolean): void => {
  if (!IS_DEV || next === outputSafetyEnabled) {
    return;
  }
  outputSafetyEnabled = next;
  emit();
};

export const useDspOutputSafetyEnabled = (): boolean =>
  useSyncExternalStore(
    subscribe,
    readDspOutputSafetyEnabled,
    readDspOutputSafetyEnabled,
  );

export interface IDspOutputSafetyMeter {
  enabled: boolean;
  truePeakFactor: 1 | 2 | 4;
  postFilterNormalizer: {
    gainReductionDb: number;
    inputTruePeakDb: number;
  };
  gainReductionDb: number;
  inputTruePeakDb: number;
  dcCorrectionDb: number;
  repairedSamples: number;
}

let outputSafetyMeter: IDspOutputSafetyMeter = {
  enabled: true,
  truePeakFactor: 4,
  postFilterNormalizer: {
    gainReductionDb: 0,
    inputTruePeakDb: -120,
  },
  gainReductionDb: 0,
  inputTruePeakDb: -120,
  dcCorrectionDb: -120,
  repairedSamples: 0,
};

const subscribeOutputSafety = (listener: () => void) => {
  outputSafetyListeners.add(listener);
  return () => {
    outputSafetyListeners.delete(listener);
  };
};

export const setDspOutputSafetyMeter = (next: IDspOutputSafetyMeter): void => {
  outputSafetyMeter = next;
  outputSafetyListeners.forEach((listener) => listener());
};

export const readDspOutputSafetyMeter = (): IDspOutputSafetyMeter =>
  outputSafetyMeter;

export const useDspOutputSafetyMeter = (): IDspOutputSafetyMeter =>
  useSyncExternalStore(
    subscribeOutputSafety,
    readDspOutputSafetyMeter,
    readDspOutputSafetyMeter,
  );

export type TInputAnalysisStatus =
  'idle' | 'analyzing' | 'ready' | 'unavailable';

export interface IDspInputAnalysisState {
  trackId?: string;
  status: TInputAnalysisStatus;
  fraction: number;
  analysis?: ILibraryNormalizationAnalysis;
}

let inputAnalysis: IDspInputAnalysisState = {
  status: 'idle',
  fraction: 0,
};

const subscribeInputAnalysis = (listener: () => void) => {
  inputAnalysisListeners.add(listener);
  return () => {
    inputAnalysisListeners.delete(listener);
  };
};

export const setDspInputAnalysis = (next: IDspInputAnalysisState): void => {
  inputAnalysis = next;
  inputAnalysisListeners.forEach((listener) => listener());
};

export const readDspInputAnalysis = (): IDspInputAnalysisState => inputAnalysis;

export const useDspInputAnalysis = (): IDspInputAnalysisState =>
  useSyncExternalStore(
    subscribeInputAnalysis,
    readDspInputAnalysis,
    readDspInputAnalysis,
  );

export interface IDspNormalizerMeter {
  inputPeaks: readonly [number, number];
  outputPeaks: readonly [number, number];
  appliedGainDb: number;
}

let normalizerMeter: IDspNormalizerMeter = {
  inputPeaks: [0, 0],
  outputPeaks: [0, 0],
  appliedGainDb: 0,
};

const subscribeNormalizerMeter = (listener: () => void) => {
  normalizerMeterListeners.add(listener);
  return () => {
    normalizerMeterListeners.delete(listener);
  };
};

export const setDspNormalizerMeter = (next: IDspNormalizerMeter): void => {
  normalizerMeter = next;
  normalizerMeterListeners.forEach((listener) => listener());
};

export const readDspNormalizerMeter = (): IDspNormalizerMeter =>
  normalizerMeter;

export const useDspNormalizerMeter = (): IDspNormalizerMeter =>
  useSyncExternalStore(
    subscribeNormalizerMeter,
    readDspNormalizerMeter,
    readDspNormalizerMeter,
  );

/** Real chain-boundary analysers, read directly inside each canvas frame. */
export interface IDspAnalyser {
  frequencyBinCount: number;
  getFloatFrequencyData(target: Float32Array): void;
}

const analysers: Partial<Record<TDspAnalyserStage, IDspAnalyser>> = {};

export const setDspAnalyser = (
  stage: TDspAnalyserStage,
  next: IDspAnalyser | undefined,
): void => {
  analysers[stage] = next;
};

export const clearDspAnalysers = (): void => {
  (Object.keys(analysers) as TDspAnalyserStage[]).forEach((stage) => {
    delete analysers[stage];
  });
};

export const readDspAnalyser = (
  stage: TDspAnalyserStage,
): IDspAnalyser | undefined => analysers[stage];

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

/**
 * Largest sample leaving the chain since the last report, full scale = 1.
 *
 * Above 1 the output is clipping, and that is the one form of distortion the
 * curve itself causes: a boost the graph draws happily is still broken once the
 * sum runs out of headroom. Measured rather than predicted, because what clips
 * depends on the material as much as on the settings.
 */
let peak = 0;

export const setDspPeak = (next: number): void => {
  if (Number.isFinite(next) && next >= 0) {
    peak = next;
  }
};

export const readDspPeak = (): number => peak;

/** Per-channel version of `readDspPeak`, used by the independent output meter. */
let channelPeaks: readonly number[] = [0, 0];

export const setDspChannelPeaks = (next: readonly number[]): void => {
  if (next.every((value) => Number.isFinite(value) && value >= 0)) {
    channelPeaks = next;
  }
};

export const readDspChannelPeaks = (): readonly number[] => channelPeaks;

/**
 * How much of each band is currently being applied, 0 to 1, by band index.
 *
 * Only dynamic bands ever report anything but 1: a static band is always fully
 * applied, which is what makes it static. Reported rather than predicted for
 * the same reason the phase meter is — what a dynamic band is doing depends on
 * the material, and the settings cannot say.
 *
 * Without this the threshold dial had no visible effect at all. The graph drew
 * the curve at full strength and its at-rest twin at zero, and neither of those
 * moves when the threshold does, so the control looked broken while working.
 */
let bandAmounts: readonly number[] = [];

export const setDspBandAmounts = (next: readonly number[]): void => {
  bandAmounts = next;
};

export const readDspBandAmounts = (): readonly number[] => bandAmounts;

/**
 * What the exciter's three bands and its organic stage actually contributed.
 *
 * Reported by the worklet rather than derived from the settings, and that
 * difference is the whole reason the display is worth having. A dynamic
 * band's amount depends on how loud its own passband is this instant, while
 * the smoothed activity values show switch and control transitions without
 * pretending that the nonlinear stage has a fixed EQ transfer curve.
 */
let exciterBands: readonly number[] = [0, 0, 0];

let exciterOrganic = 0;

export const setDspExciterActivity = (
  bands: readonly number[],
  organic: number,
): void => {
  exciterBands = bands;
  exciterOrganic = organic;
};

export const readDspExciterBands = (): readonly number[] => exciterBands;

export const readDspExciterOrganic = (): number => exciterOrganic;

/**
 * Each dynamic band's own detected level, in dBFS, by band index.
 *
 * The quantity the threshold is compared against, and NOT the same thing as
 * the spectrum behind the curve. The spectrum is per-FFT-bin, and broadband
 * music spreads its energy across a thousand of them, so every bin reads far
 * below the level of the signal itself — a full-scale track never approaches
 * the top of that display and is not meant to.
 *
 * This is a time-domain envelope where 1.0 is full scale, which is the same
 * reference the threshold dial uses. Reporting it is what makes the threshold
 * readable: the two are drawn on the same axis and compared to each other,
 * rather than to a spectrum that answers a different question.
 */
let bandLevels: readonly number[] = [];

export const setDspBandLevels = (next: readonly number[]): void => {
  bandLevels = next;
};

export const readDspBandLevels = (): readonly number[] => bandLevels;

/**
 * Recent sample pairs leaving the chain, interleaved left, right.
 *
 * What the goniometer draws. The needle answers "how correlated" with one
 * number; this answers "shaped how" — a vertical trace is mono, a circle is
 * wide, a horizontal one is out of phase — and no single figure can.
 */
let scatter: Float32Array = new Float32Array(0);

export const setDspScatter = (next: Float32Array): void => {
  scatter = next;
};

export const readDspScatter = (): Float32Array => scatter;

/**
 * Which of the phase block’s three views is showing, if any.
 *
 * Its own storage key rather than a DSP setting: nothing here reaches the
 * audio, and putting a display preference in the chain would make choosing a
 * view rebuild filters.
 */
export type TPhaseView = 'off' | 'needle' | 'scope';

const PHASE_VIEW_KEY = 'fluideq.dsp.phaseView';

const readStoredPhaseView = (): TPhaseView => {
  try {
    const stored = window.localStorage.getItem(PHASE_VIEW_KEY);
    return stored === 'off' || stored === 'scope' ? stored : 'needle';
  } catch {
    return 'needle';
  }
};

let phaseView: TPhaseView | undefined;

export const readDspPhaseView = (): TPhaseView => {
  if (phaseView === undefined) {
    phaseView = readStoredPhaseView();
  }
  return phaseView;
};

export const setDspPhaseView = (next: TPhaseView): void => {
  phaseView = next;
  try {
    window.localStorage.setItem(PHASE_VIEW_KEY, next);
  } catch {
    // A full or disabled store costs the preference, not the session.
  }
  emit();
};

export const useDspPhaseView = (): TPhaseView =>
  useSyncExternalStore(subscribe, readDspPhaseView, readDspPhaseView);

export const useDspSettings = (): IDspSettings =>
  useSyncExternalStore(subscribe, readDspSettings, readDspSettings);

export const useDspEngineState = (): TDspEngineState =>
  useSyncExternalStore(subscribe, readDspEngineState, readDspEngineState);
