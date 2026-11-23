/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Main-process audio tuning authority behind the Tuning MCP Door.
 *
 * Every AI read and write goes through this controller rather than touching
 * config files directly:
 * - Writes validate and pass through `tuningSafety.ts` via `tuningMutations.ts`
 *   and `tuningRackMutations.ts`.
 * - Session snapshots, A/B compare, and one-click revert live in
 *   `tuningSession.ts`.
 * - Every write flushes through FluidEQ's own update path and notifies the
 *   window, keeping the UI, DSP store, Mic tab, and running audio engine in
 *   step with zero desync.
 */

import type {
  IFluidEngineMicrophone,
  TAudioEngine,
} from '../../common/audioEngine';
import type {
  IAudioDevice,
  IFiltersMap,
  IOpraProduct,
  IPresetV2,
  IState,
  TApoLayer,
} from '../../common/constants';
import type { IEngineAnalysis } from '../../common/dsp/engineAnalysis';
import type { IEnginePreamp } from '../../common/enginePreamp';
import type {
  IMicSoundEntry,
  IMicSoundFile,
  TMicSoundResult,
} from '../../common/micSound';
import type { ITuningSessionSummary } from '../../common/tuningAgent';
import type { IUserDspPreset } from '../../common/userPresetsFile';
import { computeMeasurementDelta } from './acousticDiagnostics';
import { evaluateEffectiveCurve } from './eqResponse';
import { ILiveAudioReport, summarizeLiveAudio } from './liveAudioMeasure';
import type { INowPlayingInfo } from './nowPlaying';
import {
  TPresetCatalogKind,
  buildAudioContext,
  listCatalogPresets,
  searchOpraProducts,
  summarizeActiveStages,
} from './tuningCatalog';
import { buildTuningGuide } from './tuningGuide';
import {
  IHeadphoneMutationArgs,
  IMainEqMutationArgs,
  IPreampMutationArgs,
  IStateMutationHooks,
  TMutationPlan,
  applyHeadphoneMutation,
  applyMainEqMutation,
  applyPreampMutation,
} from './tuningMutations';
import {
  IDspStageMutationArgs,
  IMicRackMutationArgs,
  IPresetMutationArgs,
  applyDspStageMutation,
  applyPresetMutation,
  prepareMicRackUpdate,
} from './tuningRackMutations';
import {
  ITuningSessionFailure,
  ITuningSessionOutcomeOk,
  TTuningSessionOutcome,
  createTuningSession,
} from './tuningSession';

export type ITuningMutationResult = ITuningSessionOutcomeOk;
export type ITuningFailure = ITuningSessionFailure;
export type TTuningOutcome<T = ITuningMutationResult> = T | ITuningFailure;

export interface ITuningControllerDeps {
  state: IState;
  getEngine: () => TAudioEngine | null;
  getActiveOutput: () => IAudioDevice | undefined;
  getPlaybackOutput: () => IAudioDevice | undefined;
  getOutputs: () => readonly IAudioDevice[];
  getMicrophones: () => Promise<readonly IFluidEngineMicrophone[]>;
  getOpraProducts: () => readonly IOpraProduct[];
  getOpraPreset: (productId: string, curveId: string) => IPresetV2;
  getOpraLabel: (productId: string, curveId?: string) => string;
  shieldReferenceBands: (filters: IFiltersMap, limit?: number) => IFiltersMap;
  applyingLayer: (layer: TApoLayer) => void;
  switchToParametricEditing: () => void;
  /** Flush `state` (including EQ, layers, and `state.dsp`) to disk & engine. */
  flushAudioState: (reason: string) => Promise<{ ok: boolean; error?: string }>;
  /** Notify window that output state / DSP changed so all UI panels reload. */
  notifyOutputChanged: () => void;
  readMicSound: () => IMicSoundFile;
  writeMicSound: (
    guid: string,
    entry: IMicSoundEntry,
  ) => Promise<TMicSoundResult>;
  notifyMicChanged: () => void;
  loadUserPresets: () => IUserDspPreset[];
  saveUserPresets: (presets: IUserDspPreset[]) => void;
  sampleEngineAudio: (
    endpointGuid: string,
    targetFrames: number,
  ) => Promise<{ frames: IEngineAnalysis[]; preamp?: IEnginePreamp }>;
  readLibraryAudioFrames: () => readonly IEngineAnalysis[];
  getNowPlaying?: () => Promise<INowPlayingInfo>;
  onSessionChanged?: (session: ITuningSessionSummary) => void;
}

export const createTuningController = (deps: ITuningControllerDeps) => {
  let lastMeasurement: ILiveAudioReport | undefined;
  const session = createTuningSession({
    state: deps.state,
    flushAudioState: deps.flushAudioState,
    notifyOutputChanged: deps.notifyOutputChanged,
    readMicSound: deps.readMicSound,
    writeMicSound: deps.writeMicSound,
    notifyMicChanged: deps.notifyMicChanged,
    loadUserPresets: deps.loadUserPresets,
    saveUserPresets: deps.saveUserPresets,
    onSessionChanged: deps.onSessionChanged,
  });

  const commitAudio = async (
    toolName: string,
    plan: TMutationPlan,
  ): Promise<TTuningSessionOutcome> => {
    if (!plan.ok) {
      return plan;
    }
    const flushed = await deps.flushAudioState(`tuning-agent:${toolName}`);
    if (!flushed.ok) {
      return {
        ok: false,
        error:
          flushed.error ??
          'FluidEQ could not write the new settings to the audio engine.',
      };
    }
    deps.notifyOutputChanged();
    session.recordMutation(toolName);
    const effectiveCurve = evaluateEffectiveCurve(deps.state);
    return {
      ok: true,
      warnings: plan.warnings,
      session: session.getSession(),
      detail: {
        ...(plan.detail ?? {}),
        effectiveCurve: {
          summary: effectiveCurve.summary,
          peakBoostDb: effectiveCurve.peakBoostDb,
          maxCutDb: effectiveCurve.maxCutDb,
          totalDb: effectiveCurve.totalDb,
        },
      },
    };
  };

  const mutationHooks: IStateMutationHooks = {
    beforeWrite: session.ensureBaseline,
    getOpraProducts: deps.getOpraProducts,
    getOpraPreset: deps.getOpraPreset,
    getOpraLabel: deps.getOpraLabel,
    shieldReferenceBands: deps.shieldReferenceBands,
    applyingLayer: deps.applyingLayer,
    switchToParametricEditing: deps.switchToParametricEditing,
    loadUserPresets: deps.loadUserPresets,
  };

  const readTrack = async (): Promise<INowPlayingInfo> => {
    if (!deps.getNowPlaying) {
      return { source: 'none', isPlaying: false };
    }
    return deps.getNowPlaying().catch(() => ({
      source: 'none' as const,
      isPlaying: false,
    }));
  };

  const getContext = async () =>
    buildAudioContext({
      engine: deps.getEngine(),
      state: deps.state,
      activeOutput: deps.getActiveOutput(),
      playbackOutput: deps.getPlaybackOutput(),
      outputs: deps.getOutputs(),
      microphones: await deps.getMicrophones().catch(() => []),
      headphoneLabel: deps.state.headset
        ? deps.getOpraLabel(deps.state.headset, deps.state.headsetTarget)
        : '',
      micFile: deps.readMicSound(),
      session: session.getSession(),
      nowPlaying: await readTrack(),
    });

  const finalizeMeasurement = (
    report: ILiveAudioReport,
    nowPlaying: INowPlayingInfo,
  ): ILiveAudioReport => {
    const delta =
      lastMeasurement && report.hasSignal
        ? computeMeasurementDelta(lastMeasurement, report)
        : undefined;
    if (report.hasSignal) {
      lastMeasurement = report;
    }
    return {
      ...report,
      nowPlaying,
      ...(delta ? { deltaFromPrevious: delta } : {}),
    };
  };

  const measureLiveAudio = async (
    targetFrames = 6,
  ): Promise<
    | { ok: true; report: ILiveAudioReport }
    | { ok: false; reason: 'no-engine' | 'no-signal'; message: string }
  > => {
    const nowPlaying = await readTrack();
    const endpoint =
      deps.getPlaybackOutput()?.guid ?? deps.getActiveOutput()?.guid;
    if (deps.getEngine() === 'fluid' && endpoint) {
      const sampled = await deps.sampleEngineAudio(endpoint, targetFrames);
      if (sampled.frames.length > 0) {
        const report = summarizeLiveAudio(
          sampled.frames,
          'engine',
          sampled.preamp,
        );
        return report.hasSignal
          ? { ok: true, report: finalizeMeasurement(report, nowPlaying) }
          : {
              ok: false,
              reason: 'no-signal',
              message:
                'The FluidEQ Engine is connected, but the output is silent. Ask the listener to play reference audio and call measure_live_audio again.',
            };
      }
    }

    const libraryFrames = deps.readLibraryAudioFrames();
    if (libraryFrames.length > 0) {
      const report = summarizeLiveAudio(libraryFrames, 'library');
      return report.hasSignal
        ? { ok: true, report: finalizeMeasurement(report, nowPlaying) }
        : {
            ok: false,
            reason: 'no-signal',
            message:
              'The Library player is open, but currently silent. Ask the listener to play a track and call measure_live_audio again.',
          };
    }

    return {
      ok: false,
      reason: 'no-engine',
      message:
        deps.getEngine() === 'apo'
          ? 'Live engine metering requires the FluidEQ Engine (currently on Equalizer APO) or playback inside the FluidEQ Library player. You can still tune EQ, OPRA headphone curves, and presets.'
          : 'No live audio frames arrived from the engine yet. Ask the listener to play audio on the active output and try again.',
    };
  };

  const searchHeadphoneCorrection = (query: string, limit = 15) =>
    searchOpraProducts(deps.getOpraProducts(), query, limit);

  const listPresets = (
    kind: TPresetCatalogKind = 'all',
    query = '',
    limit = 40,
  ) => listCatalogPresets(deps.loadUserPresets(), kind, query, limit);

  const applyHeadphoneCorrection = async (args: IHeadphoneMutationArgs) =>
    commitAudio(
      'apply_headphone_correction',
      applyHeadphoneMutation(deps.state, mutationHooks, args),
    );

  const setMainEq = async (args: IMainEqMutationArgs) =>
    commitAudio(
      'set_main_eq',
      applyMainEqMutation(deps.state, mutationHooks, args),
    );

  const setPreamp = async (args: IPreampMutationArgs) =>
    commitAudio(
      'set_preamp',
      applyPreampMutation(deps.state, session.ensureBaseline, args),
    );

  const applyPreset = async (args: IPresetMutationArgs) =>
    commitAudio(
      'apply_preset',
      applyPresetMutation(deps.state, mutationHooks, args),
    );

  const configureDspStage = async (args: IDspStageMutationArgs) =>
    commitAudio(
      'configure_dsp_stage',
      applyDspStageMutation(deps.state, session.ensureBaseline, args),
    );

  const configureMicRack = async (
    args: IMicRackMutationArgs,
  ): Promise<TTuningSessionOutcome> => {
    const mics = await deps.getMicrophones().catch(() => []);
    const prepared = prepareMicRackUpdate(session.getBaseMicFile(), mics, args);
    if (!prepared.ok) {
      return prepared;
    }

    session.ensureBaseline();
    const { guid, entry, warnings } = prepared;
    const result = await deps.writeMicSound(guid, entry);
    if (result === 'rejected') {
      return { ok: false, error: 'Microphone settings were rejected.' };
    }
    if (result === 'not-fluid') {
      warnings.push(
        'Saved microphone rack, but live mic processing only runs under the FluidEQ Engine.',
      );
    } else if (result === 'not-installed') {
      warnings.push(
        'Saved microphone rack, but the FluidEQ Engine is not installed yet.',
      );
    }
    deps.notifyMicChanged();
    session.recordMutation('configure_mic_rack');
    return {
      ok: true,
      warnings,
      session: session.getSession(),
      detail: {
        guid,
        name: entry.name,
        profileId: entry.profileId,
        engineResult: result,
        activeStages: summarizeActiveStages(entry.settings),
      },
    };
  };

  return {
    getSession: session.getSession,
    getContext,
    measureLiveAudio,
    getTuningGuide: buildTuningGuide,
    searchHeadphoneCorrection,
    listPresets,
    applyHeadphoneCorrection,
    setMainEq,
    setPreamp,
    applyPreset,
    configureDspStage,
    configureMicRack,
    abCompare: session.abCompare,
    revert: session.revert,
    sessionAction: session.sessionAction,
  };
};

export type ITuningController = ReturnType<typeof createTuningController>;
