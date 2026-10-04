/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the engine measures on the rack, for the displays that draw it: Auto
 * Headroom, the input analysis, the noise rescan, Denoise, the Normalizer and
 * the analysers, and clearing them all when the source stops. Each with
 * listeners of its own, so a meter moving wakes only what draws it — never a
 * reader of the rack. `store.ts` re-exports all of it.
 */

import { useSyncExternalStore } from 'react';
import { ANALYSIS_BASS_FORGE_BANDS } from '../../common/dsp/analysisWire';
import { ILibraryNormalizationAnalysis } from '../../common/library/types';
import { TDspAnalyserStage } from './monitorOutputs';
import { setDspRoomReport } from './roomTelemetry';
import { publishDspSourceAnalysis } from './sourceAnalysis';
import {
  setDspBandAmounts,
  setDspBandLevels,
  setDspBassForgeBands,
  setDspBassPunchActivity,
  setDspChannelPeaks,
  setDspCorrelation,
  setDspDimensionGuard,
  setDspExciterActivity,
  setDspLoudness,
  setDspMaximizerReduction,
  setDspPeak,
  setDspScatter,
} from './telemetryStore';

const headroomListeners = new Set<() => void>();
const inputAnalysisListeners = new Set<() => void>();
const noiseRescanListeners = new Set<() => void>();
const normalizerMeterListeners = new Set<() => void>();
const denoiseMeterListeners = new Set<() => void>();

/** What the Master's Auto Headroom is doing, as the engine measures it. */
export interface IDspHeadroomMeter {
  /** Its deepest reduction over the window, dB. Never positive. */
  gainReductionDb: number;
  /** What it saw arriving, dBTP; -120 is nothing measured. */
  inputTruePeakDb: number;
}

let headroomMeter: IDspHeadroomMeter = {
  gainReductionDb: 0,
  inputTruePeakDb: -120,
};

const subscribeHeadroom = (listener: () => void) => {
  headroomListeners.add(listener);
  return () => {
    headroomListeners.delete(listener);
  };
};

export const setDspHeadroomMeter = (next: IDspHeadroomMeter): void => {
  headroomMeter = next;
  headroomListeners.forEach((listener) => listener());
};

export const readDspHeadroomMeter = (): IDspHeadroomMeter => headroomMeter;

export const useDspHeadroomMeter = (): IDspHeadroomMeter =>
  useSyncExternalStore(
    subscribeHeadroom,
    readDspHeadroomMeter,
    readDspHeadroomMeter,
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
  publishDspSourceAnalysis(next);
  inputAnalysisListeners.forEach((listener) => listener());
};

export const readDspInputAnalysis = (): IDspInputAnalysisState => inputAnalysis;

export const useDspInputAnalysis = (): IDspInputAnalysisState =>
  useSyncExternalStore(
    subscribeInputAnalysis,
    readDspInputAnalysis,
    readDspInputAnalysis,
  );

export interface IDspNoiseRescanRequest {
  id: number;
  trackId?: string;
}

let noiseRescanRequest: IDspNoiseRescanRequest = { id: 0 };

const subscribeNoiseRescan = (listener: () => void) => {
  noiseRescanListeners.add(listener);
  return () => {
    noiseRescanListeners.delete(listener);
  };
};

/** Ask the player to replace the current track's frozen noise profile. */
export const requestDspNoiseRescan = (trackId: string | undefined): void => {
  if (!trackId) {
    return;
  }
  noiseRescanRequest = { id: noiseRescanRequest.id + 1, trackId };
  noiseRescanListeners.forEach((listener) => listener());
};

export const readDspNoiseRescanRequest = (): IDspNoiseRescanRequest =>
  noiseRescanRequest;

export const useDspNoiseRescanRequest = (): IDspNoiseRescanRequest =>
  useSyncExternalStore(
    subscribeNoiseRescan,
    readDspNoiseRescanRequest,
    readDspNoiseRescanRequest,
  );

/**
 * What the Denoise stage did, as opposed to what its dials are set to.
 *
 * None of it is derivable from the settings: how much a subtractor removed
 * depends on the material, whether the click detector fired depends on whether
 * the file has clicks, and whether the neural module is running at all depends
 * on a download. A card showing only dial positions looks identical in every
 * one of those cases.
 */
export interface IDspDenoiseMeter {
  reductionDb: number;
  noiseFloorDb: number;
  /** The floor being subtracted right now, per band. See `floorBandsDb`. */
  floorBandsDb: readonly number[];
  /** Actual per-band hiss gain in dB, sampled from the native processor. */
  hissReductionBandsDb: readonly number[];
  clicksRepaired: number;
  voiceUnderruns: number;
  profileReady: boolean;
  voiceModelLoaded: boolean;
}

const DENOISE_METER_IDLE: IDspDenoiseMeter = {
  reductionDb: 0,
  noiseFloorDb: -120,
  floorBandsDb: [],
  hissReductionBandsDb: [],
  clicksRepaired: 0,
  voiceUnderruns: 0,
  profileReady: false,
  voiceModelLoaded: false,
};

let denoiseMeter: IDspDenoiseMeter = DENOISE_METER_IDLE;

const subscribeDenoiseMeter = (listener: () => void) => {
  denoiseMeterListeners.add(listener);
  return () => {
    denoiseMeterListeners.delete(listener);
  };
};

export const setDspDenoiseMeter = (next: IDspDenoiseMeter): void => {
  denoiseMeter = next;
  denoiseMeterListeners.forEach((listener) => listener());
};

export const readDspDenoiseMeter = (): IDspDenoiseMeter => denoiseMeter;

export const useDspDenoiseMeter = (): IDspDenoiseMeter =>
  useSyncExternalStore(
    subscribeDenoiseMeter,
    readDspDenoiseMeter,
    readDspDenoiseMeter,
  );

/**
 * One flag from the Denoise meter, re-rendering only when that flag flips.
 *
 * The meter is a new object with every host frame, so a component that reads
 * it whole redraws a hundred times a second. The Denoise page needs two of its
 * fields to decide what its controls allow, and those change once in a
 * session; the numbers that move every frame are read by the readouts alone.
 */
export const useDspDenoiseMeterFlag = (
  flag: 'profileReady' | 'voiceModelLoaded',
): boolean => {
  const read = () => denoiseMeter[flag];
  return useSyncExternalStore(subscribeDenoiseMeter, read, read);
};

export interface IDspNormalizerMeter {
  inputTruePeakDb?: number;
  inputLufs?: number;
  referenceLufs?: number;
  levelState?: number;
  inputPeaks: readonly [number, number];
  outputPeaks: readonly [number, number];
  appliedGainDb: number;
}

let normalizerMeter: IDspNormalizerMeter = {
  inputPeaks: [0, 0],
  outputPeaks: [0, 0],
  appliedGainDb: 0,
};

/** Below -120 dBFS there is no programme worth repainting as a new value. */
const NORMALIZER_METER_SIGNAL_FLOOR = 1e-6;

const subscribeNormalizerMeter = (listener: () => void) => {
  normalizerMeterListeners.add(listener);
  return () => {
    normalizerMeterListeners.delete(listener);
  };
};

export const setDspNormalizerMeter = (next: IDspNormalizerMeter): void => {
  const nextHasProgramme = [...next.inputPeaks, ...next.outputPeaks].some(
    (peak) => peak > NORMALIZER_METER_SIGNAL_FLOOR,
  );
  const heldHasProgramme = [
    ...normalizerMeter.inputPeaks,
    ...normalizerMeter.outputPeaks,
  ].some((peak) => peak > NORMALIZER_METER_SIGNAL_FLOOR);
  // Empty decoder quanta and track handoffs report literal zero. Painting
  // those between valid windows made the bars and numbers flash 0 -> value ->
  // 0 even though the programme itself was continuous. Hold the last valid
  // levels through silence; the applied gain remains live because analysis may
  // legitimately finish while the transport is paused.
  normalizerMeter =
    nextHasProgramme || !heldHasProgramme
      ? next
      : {
          ...next,
          inputPeaks: normalizerMeter.inputPeaks,
          outputPeaks: normalizerMeter.outputPeaks,
        };
  normalizerMeterListeners.forEach((listener) => listener());
};

export const readDspNormalizerMeter = (): IDspNormalizerMeter =>
  normalizerMeter;

/**
 * One value from the Normalizer meter, re-rendering only when it changes.
 *
 * The meter is a new object with every host frame, and a figure that read it
 * whole redrew with each one whether or not the tenth of a decibel it shows
 * had moved. `read` returns what is shown — a number, or the text itself — so
 * equal readings are the same snapshot and render nothing.
 */
export const useDspNormalizerMeterValue = <
  T extends string | number | undefined,
>(
  read: (meter: IDspNormalizerMeter) => T,
): T => {
  const snapshot = () => read(normalizerMeter);
  return useSyncExternalStore(subscribeNormalizerMeter, snapshot, snapshot);
};

/** Real chain-boundary analysers, read directly inside each canvas frame. */
export interface IDspAnalyser {
  frequencyBinCount: number;
  getFloatFrequencyData(target: Float32Array): void;
}

const analysers: Partial<Record<TDspAnalyserStage, IDspAnalyser>> = {};

/**
 * Told when a stage changes hands, because nothing else can say so.
 *
 * The slot is a plain module value read inside a canvas frame, and that is
 * what keeps twenty-three host frames a second out of React. The price of it
 * is that FILLING one is invisible: a graph that stopped its loop because the
 * slot was empty has nothing to wake it when the engine starts publishing, and
 * it stays frozen until some unrelated render happens to re-arm it.
 *
 * That is the bug behind "the graphs do not move after a refresh". A fresh
 * renderer mounts the panel with every slot empty — the host is not engaged
 * yet — so the loop paints once and stops; the first analysis frame then
 * arrives from an IPC callback, which renders nothing. Changing the output or
 * restarting the audio driver reaches the same state by a different road: the
 * engine disengages, `release` hands the slots back empty, and the loops stop
 * before the engine comes back.
 *
 * Fired only when the occupant actually CHANGES, which is once per engage and
 * once per release. It is not on the frame path and must never become so —
 * `nativeMeters` compares before it assigns for exactly this reason.
 */
const analyserListeners = new Set<() => void>();

export const subscribeDspAnalysers = (listener: () => void): (() => void) => {
  analyserListeners.add(listener);
  return () => {
    analyserListeners.delete(listener);
  };
};

const announceAnalysers = (): void => {
  analyserListeners.forEach((listener) => listener());
};

export const setDspAnalyser = (
  stage: TDspAnalyserStage,
  next: IDspAnalyser | undefined,
): void => {
  if (analysers[stage] === next) {
    return;
  }
  // Deleted rather than set to `undefined`, so an emptied slot is absent from
  // the record instead of present and holding nothing. `release` passes the
  // displaced holder straight through and that is `undefined` now that the
  // worklet registers nothing, which would otherwise leave every stage listed
  // forever.
  if (next === undefined) {
    delete analysers[stage];
  } else {
    analysers[stage] = next;
  }
  announceAnalysers();
};

export const clearDspAnalysers = (): void => {
  const held = Object.keys(analysers) as TDspAnalyserStage[];
  held.forEach((stage) => {
    delete analysers[stage];
  });
  if (held.length > 0) {
    announceAnalysers();
  }
};

export const readDspAnalyser = (
  stage: TDspAnalyserStage,
): IDspAnalyser | undefined => analysers[stage];

/**
 * Whether the engine is publishing anything at all, for a graph with no tap.
 *
 * Most cards in the rack draw a measurement rather than a spectrum — a gain
 * over time, a guard, a reduction depth — so they have no analyser of their
 * own to ask, and gating them on one that happens to exist is wrong in a way
 * that shows: Denoise's tap goes quiet when the stage is bypassed, and a
 * Denoise graph gated on it would freeze while the engine ran on.
 *
 * The stage slots are the only evidence of the host publishing that reaches
 * this side, so any one of them being held is the signal. `master` is the
 * output tap and is always among them while the engine is engaged, so this is
 * true for exactly as long as frames are arriving and false the moment
 * `nativeMeters` hands the slots back.
 */
export const readDspAnalysisLive = (): boolean =>
  (Object.keys(analysers) as TDspAnalyserStage[]).some(
    (stage) => analysers[stage] !== undefined,
  );

/** A stopped source has no current measurements; do not retain its last bars. */
export const clearDspMeterTelemetry = (): void => {
  setDspRoomReport(undefined);
  normalizerMeter = {
    inputPeaks: [0, 0],
    outputPeaks: [0, 0],
    appliedGainDb: 0,
  };
  normalizerMeterListeners.forEach((listener) => listener());
  setDspDenoiseMeter(DENOISE_METER_IDLE);
  setDspHeadroomMeter({ gainReductionDb: 0, inputTruePeakDb: -120 });
  setDspPeak(0);
  setDspChannelPeaks([0, 0]);
  setDspCorrelation(1);
  setDspScatter(new Float32Array(0));
  setDspBandAmounts([]);
  setDspBandLevels([]);
  setDspExciterActivity([0, 0, 0], 0);
  setDspMaximizerReduction(0);
  setDspDimensionGuard(1);
  const floor = new Array<number>(ANALYSIS_BASS_FORGE_BANDS).fill(-120);
  setDspBassForgeBands(floor, floor);
  setDspBassPunchActivity(0, 0, 0);
  setDspLoudness({
    momentaryLufs: -120,
    shortTermLufs: -120,
    integratedLufs: -120,
    rangeLu: 0,
  });
};
