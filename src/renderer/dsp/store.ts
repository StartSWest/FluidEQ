/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import { useSyncExternalStore } from 'react';
import type { IEqualizerSnapshot } from '../../common/outputSettings';
import { readOutputEditor } from '../utils/outputEditor';
import { presetToneOf } from '../../common/dsp/presetTone';
import {
  publishDspSourceAnalysis,
  setDspSourcePlayback,
} from './sourceAnalysis';
import { setDspRoomReport } from './roomTelemetry';

import {
  DSP_DEFAULTS,
  IDspSettings,
  clampDspSettings,
} from '../../common/dsp/chain';
import { ANALYSIS_BASS_FORGE_BANDS } from '../../common/dsp/analysisWire';
import {
  appendPresetTone,
  encodeChainSettings,
  IPresetTone,
} from '../../common/dsp/chainWire';
import { readPresetTone, updatePresetTone } from './presetToneStore';
import { sendSystemDspChain } from './systemChain';
import {
  IRackGate,
  engineRunsRack,
  rackFor,
  readRackGate,
  updateRackGate,
} from './rackPlacement';
import { TDspAnalyserStage } from './monitorOutputs';
import { ILibraryNormalizationAnalysis } from '../../common/library/types';
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

export {
  readDspBandAmounts,
  readDspBandLevels,
  readDspBassForgeBands,
  readDspBassPunchActivity,
  readDspChannelPeaks,
  readDspCorrelation,
  readDspDimensionGuard,
  readDspExciterBands,
  readDspExciterOrganic,
  readDspLoudness,
  readDspMaximizerReduction,
  readDspPeak,
  readDspScatter,
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
      bassForge: { ...settings.bassForge, isolate: false },
      bassPunch: { ...settings.bassPunch, isolate: false },
      denoise: { ...settings.denoise, isolate: false },
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

let settings: IDspSettings = DSP_DEFAULTS;
let loaded = false;
let engineState: TDspEngineState = 'idle';
let sampleRate = ASSUMED_SAMPLE_RATE;

/**
 * The C++ engine is the only one that processes audio. There is no switch.
 *
 * The TypeScript chain stayed through the migration so the two could be
 * compared on the same material. It earned that overlap: the parity corpus held
 * the native chain to it sample for sample. The final 2,085 fixtures are frozen
 * in the native tests, and the TypeScript processors themselves are gone.
 * There is no switch, second audible path, or fallback: nothing TypeScript
 * touches the audio any more.
 *
 * No fallback in particular is a decision rather than an omission. A chain that
 * quietly did something different when the host failed to start is a user
 * hearing the wrong engine and being told nothing — so a failure is shown
 * instead. See `readDspNativeState`.
 */

const listeners = new Set<() => void>();
const headroomListeners = new Set<() => void>();
const inputAnalysisListeners = new Set<() => void>();
const noiseRescanListeners = new Set<() => void>();
const normalizerMeterListeners = new Set<() => void>();
const denoiseMeterListeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * The rack, to the engine that runs it on every output — switched off at the
 * root whenever it belongs somewhere else (`rackPlacement.ts`): in the
 * Library player while that plays, or nowhere while the engine is off.
 *
 * The only sender. The player's host used to send the same array on every
 * push of its own, which was one of the two halves of the rack running twice.
 * The send is de-duplicated inside `systemChain.ts`.
 */
const pushSystemChain = (persist = false): void => {
  const target = readOutputEditor().editor;
  if (!target) {
    return;
  }
  const rack = rackFor(readDspSettings(), engineRunsRack(readRackGate()));
  // A rack switched off at the root carries no curve: nothing limits through
  // it, and the engine reloads every output on each write it sees.
  const line = encodeChainSettings(rack);
  sendSystemDspChain(
    rack.enabled ? appendPresetTone(line, readPresetTone()) : line,
    {
      deviceId: target.device.id,
      generation: target.generation,
      settings: readDspSettings(),
      legacySettings: legacySettings ?? (legacySettings = readStored()),
      savedSettings:
        persist || ownRack ? (ownRack ?? readDspSettings()) : undefined,
    },
  );
};

let outputKey = '';
let legacySettings: IDspSettings | undefined;
const outputRacks = new Map<string, IDspSettings>();
const outputTones = new Map<string, IPresetTone | undefined>();

export const readPlaybackDspSettings = (): IDspSettings => {
  const { editor, main } = readOutputEditor();
  if (!main || editor?.device.id === main.id) {
    return readDspSettings();
  }
  return outputRacks.get(main.id) ?? DSP_DEFAULTS;
};
export const usePlaybackDspSettings = (): IDspSettings =>
  useSyncExternalStore(
    subscribe,
    readPlaybackDspSettings,
    readPlaybackDspSettings,
  );

export const readPlaybackPresetTone = (): IPresetTone | undefined => {
  const { editor, main } = readOutputEditor();
  return !main || editor?.device.id === main.id
    ? readPresetTone()
    : outputTones.get(main.id);
};
export const usePlaybackPresetTone = (): IPresetTone | undefined =>
  useSyncExternalStore(
    subscribe,
    readPlaybackPresetTone,
    readPlaybackPresetTone,
  );

/** Loading an editor must never publish its predecessor's rack to this output. */
export const adoptOutputDsp = (state: IEqualizerSnapshot): void => {
  const target = state.outputEditor;
  if (!target) {
    return;
  }
  let playbackChanged = false;
  if (state.playbackOutput && state.playbackState) {
    const { id } = state.playbackOutput;
    if (state.playbackState.dsp) {
      const next = clampDspSettings(state.playbackState.dsp);
      if (JSON.stringify(outputRacks.get(id)) !== JSON.stringify(next)) {
        outputRacks.set(id, next);
        playbackChanged = true;
      }
    }
    const tone = presetToneOf(state.playbackState, {
      eq:
        readRackGate().engine === 'fluid' &&
        state.playbackState.trebleDesigns?.eq !== 'classic',
      curves:
        readRackGate().engine === 'fluid' &&
        state.playbackState.trebleDesigns?.curves !== 'classic',
    });
    if (JSON.stringify(outputTones.get(id)) !== JSON.stringify(tone)) {
      outputTones.set(id, tone);
      playbackChanged = true;
    }
  }
  const key = `${target.device.id}:${target.generation}`;
  if (key === outputKey) {
    if (playbackChanged) {
      emit();
    }
    return;
  }
  const first = outputKey === '';
  outputKey = key;
  ownRack = state.ownedDsp ? clampDspSettings(state.ownedDsp) : undefined;
  settings = clampDspSettings(
    state.dsp ?? (first ? readStored() : DSP_DEFAULTS),
  );
  outputRacks.set(target.device.id, settings);
  loaded = true;
  updatePresetTone(undefined);
  emit();
  if (first || !state.dsp) {
    pushSystemChain(!state.dsp);
  }
};

/**
 * The curve the Preset layer plays after the rack (`presetToneStore.ts`),
 * and the engine's copy of the rack sent again with it. The player's copy
 * follows through `usePresetTone`.
 */
export const setDspPresetTone = (next: IPresetTone | undefined): void => {
  const id = readOutputEditor().editor?.device.id;
  if (id) {
    outputTones.set(id, next);
  }
  if (updatePresetTone(next)) {
    emit();
    pushSystemChain();
  }
};

/**
 * Tell the rack where it may run, and send the engine what that leaves it.
 *
 * Called by the shell with the engine, FluidEQ's switch and whether the engine
 * is off, and by the Library player with whether it is playing. The player's
 * own copy follows the same gate through `useRackGate`.
 */
export const setDspRackGate = (patch: Partial<IRackGate>): void => {
  const changed = updateRackGate(patch);
  if (
    patch.libraryAudible !== undefined ||
    patch.sendingRawAudio !== undefined
  ) {
    const gate = readRackGate();
    setDspSourcePlayback({
      libraryAudible: gate.libraryAudible,
      sendingRawAudio: gate.sendingRawAudio,
    });
  }
  if (changed) {
    pushSystemChain();
  }
};

/**
 * Send the rack as it currently stands, whether or not it just changed.
 *
 * For the moment the window learns it is running under FluidEQ Engine. The
 * rack file does not survive between sessions — quitting FluidEQ removes it,
 * so nothing keeps processing once the app is gone — and an engine only just
 * switched to has never had one, so without this the engine would run no rack
 * until the user happened to touch a control. The send is de-duplicated, so
 * calling this when nothing has moved costs one array comparison.
 */
export const publishSystemDspChain = (): void => {
  pushSystemChain();
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
  const id = readOutputEditor().editor?.device.id;
  if (id) {
    outputRacks.set(id, settings);
  }
  loaded = true;
  emit();
  pushSystemChain();
};

/**
 * The listener's own rack while a song's preset is lent to it
 * (`songSoundSession.ts`), and what is written down meanwhile: a song's rack
 * never outlives its song, not even through an app that ends while it plays.
 * Main keeps the preset's curve the same way (`songSoundLoan.ts`).
 */
let ownRack: IDspSettings | undefined;

/** Write whatever is currently applied. Called when a gesture ends. */
export const persistDspSettings = (): void => {
  pushSystemChain(true);
};

/**
 * Play a song's rack. The listener's own is kept aside the first time; a
 * song following a song keeps the rack the first one took.
 */
export const lendDspSettings = (next: IDspSettings): void => {
  ownRack = ownRack ?? readDspSettings();
  applyDspSettings(next);
};

/** Whether a song's rack is playing in place of the listener's own. */
export const isDspLent = (): boolean => ownRack !== undefined;

/**
 * End a loan: the listener's own rack back on (`restore`), or what plays kept
 * as theirs; written down either way.
 */
export const endDspLoan = (restore: boolean): void => {
  const own = ownRack;
  if (!own) {
    return;
  }
  ownRack = undefined;
  if (restore) {
    applyDspSettings(own);
  }
  persistDspSettings();
};

/** Game mode is an output preference, independent of the selected sound. */
export const setGameMode = (enabled: boolean): void => {
  applyDspSettings({ ...readDspSettings(), gameMode: enabled });
  persistDspSettings();
};

/** Apply and persist in one step, for a control with no drag to protect. */

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
 * Whether the native engine is actually carrying the audio right now.
 *
 * A host that fails to spawn, a platform with no device backend compiled in, or
 * a binary missing from the package all mean the same thing: nothing native is
 * running. The media elements are muted only after this reaches `engaged`.
 * Otherwise browser playback stays audible and the rack is visibly unavailable
 * instead of becoming a silent failure.
 *
 * Three states rather than a boolean, for exactly the reason `TDspEngineState`
 * above has three: the boolean version cannot tell "has not tried yet" from
 * "tried and failed". The engine lives inside `LibraryPlayerProvider`, which
 * only mounts once the Library has been opened, so before that there is no host
 * and no failure either — and a warning shown then would be a warning about
 * nothing, on a machine that is fine. That precise bug has already shipped once
 * in this file.
 */
export type TDspNativeState = 'idle' | 'engaged' | 'failed';

let nativeState: TDspNativeState = 'idle';

export const setDspNativeState = (next: TDspNativeState): void => {
  if (next === nativeState) {
    return;
  }
  nativeState = next;
  emit();
};

export const readDspNativeState = (): TDspNativeState => nativeState;

/**
 * Which endpoint the host is currently playing to, as a counter.
 *
 * Bumped whenever the host reopens the device — following the default output
 * to a new endpoint, or recovering one that went away. It matters because a
 * reopen rebuilds the player, and a rebuilt player has no decks: the endpoint
 * is right and every deck is empty, so the device change is handled and the
 * music has still stopped.
 *
 * The renderer is the only side that knows what was playing and where, so this
 * is what tells it to cue that again.
 */
let nativeDeviceGeneration = 0;

export const setDspNativeDeviceGeneration = (next: number): void => {
  if (!Number.isInteger(next) || next === nativeDeviceGeneration) {
    return;
  }
  nativeDeviceGeneration = next;
  emit();
};

export const readDspNativeDeviceGeneration = (): number =>
  nativeDeviceGeneration;

/** What the engine making the sound says about where it is. */
export interface IDspNativeTransport {
  /** False until a deck has been loaded, so nothing reads a position of zero
   * as "the track is at its beginning" while there is no track. */
  hasSource: boolean;
  positionSeconds: number;
  /** Zero when the decoder could not say, which is legal for some streams. */
  durationSeconds: number;
  /** The deck reached the end of its file, which is end-of-track. */
  ended: boolean;
}

const IDLE_TRANSPORT: IDspNativeTransport = {
  hasSource: false,
  positionSeconds: 0,
  durationSeconds: 0,
  ended: false,
};

/**
 * The transport, from the host rather than from a second decoder.
 *
 * The seek bar and end-of-track used to come from a muted `<audio>` element
 * decoding every track a second time purely to have a clock. Two clocks that
 * could disagree, and did: a deck cued at the position the PREVIOUS track had
 * reached played from the middle while the bar read zero, because each was
 * telling the truth about a different player.
 *
 * Published from telemetry, which already arrives about forty times a second.
 */
let nativeTransport: IDspNativeTransport = IDLE_TRANSPORT;

export const setDspNativeTransport = (next: IDspNativeTransport): void => {
  const current = nativeTransport;
  if (
    current.hasSource === next.hasSource &&
    current.ended === next.ended &&
    current.positionSeconds === next.positionSeconds &&
    current.durationSeconds === next.durationSeconds
  ) {
    return;
  }
  nativeTransport = next;
  emit();
};

/**
 * A deck has the track — said by the mirror, a frame before telemetry says it.
 *
 * `hasSource` is what the player means by "the host is the engine playing
 * this", and every guard built on it runs at element speed while the fact
 * itself arrived at telemetry speed. The gap is small and it was fatal: the
 * mirror pauses the elements the instant a deck is loaded and selected, the
 * element fires `pause`, and `onPause` asked this question one frame too
 * early — got `false`, read a deliberate stand-down as the listener pressing
 * pause, and set `isPlaying` false. That flag gates the native engine, so the
 * engine tore itself down 120 ms after engaging, every single track.
 *
 * The load, select and play were all acknowledged by the host before this is
 * called, so the deck genuinely holds the file: every telemetry frame that
 * follows agrees, and nothing here can flap.
 */
export const claimDspNativeSource = (positionSeconds: number): void => {
  if (nativeTransport.hasSource) {
    return;
  }
  // Carrying the position the deck was cued to, because the bar switches to
  // the host's clock on the same tick this flag turns true. Left at the stored
  // zero, a rack engaged mid-track showed 0:00 until the first frame arrived.
  setDspNativeTransport({
    ...nativeTransport,
    hasSource: true,
    positionSeconds,
  });
};

export const readDspNativeTransport = (): IDspNativeTransport =>
  nativeTransport;

/** Forgotten when the engine lets go, so nothing reads a stale position. */
export const clearDspNativeTransport = (): void => {
  setDspNativeTransport(IDLE_TRANSPORT);
};

export const useDspNativeDeviceGeneration = (): number =>
  useSyncExternalStore(
    subscribe,
    readDspNativeDeviceGeneration,
    readDspNativeDeviceGeneration,
  );

export const useDspNativeState = (): TDspNativeState =>
  useSyncExternalStore(subscribe, readDspNativeState, readDspNativeState);

/**
 * Safe to return by reference: `setDspNativeTransport` compares every field
 * and keeps the previous object when nothing moved, so `useSyncExternalStore`
 * is not handed a new identity forty times a second for a position that has
 * not changed.
 */
export const useDspNativeTransport = (): IDspNativeTransport =>
  useSyncExternalStore(
    subscribe,
    readDspNativeTransport,
    readDspNativeTransport,
  );

/** The one question the worklet asks: is something else making the sound? */
export const readDspNativeEngaged = (): boolean => nativeState === 'engaged';

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
