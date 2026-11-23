/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Wires the Tuning Agent Door and Tuning Controller into the main process's
 * live audio state, profile flush path, microphone store, OPRA library, and
 * analysis pipes.
 */

import type { BrowserWindow } from 'electron';
import log from 'electron-log';
import type { IFiltersMap, IState, TApoLayer } from '../../common/constants';
import { TUNING_AGENT_CHANNELS } from '../../common/tuningAgent';
import type {
  IMicSoundEntry,
  IMicSoundFile,
  TMicSoundResult,
} from '../../common/micSound';
import { setTuningMeterHold } from '../engineAnalysisPipe';
import { readAudioEngineStatus } from '../engineStatus';
import { readDspHostAnalysisFrames } from '../ipc/dspHost';
import type { IMainSession } from '../mainSession';
import { getOpraLabel, getOpraPreset, getOpraProductList } from '../opra';
import type { TReplySink } from '../updatePath';
import { loadUserPresets, saveUserPresets } from '../userPresetsFile';
import createEngineAnalysisSampler from './engineAnalysisSampler';
import { readNowPlaying } from './nowPlaying';
import { createTuningAgentDoor } from './tuningAgentDoor';
import { createTuningController } from './tuningController';

export interface IRegisterTuningAgentDeps {
  userDataDir: string;
  appVersion: string;
  state: IState;
  session: IMainSession;
  getMainWindow: () => BrowserWindow | null;
  shieldReferenceBands: (filters: IFiltersMap, limit?: number) => IFiltersMap;
  applyingLayer: (layer: TApoLayer) => void;
  switchToParametricEditing: () => void;
  handleUpdate: (
    event: TReplySink,
    channel: string,
    syncActiveProfile?: boolean,
    useActiveSessionOverride?: boolean,
  ) => Promise<void>;
  notifyOutputStateChanged: () => void;
  readMicSound: () => IMicSoundFile;
  applyMicSound: (
    guid: string,
    entry: IMicSoundEntry,
  ) => Promise<TMicSoundResult>;
}

const isErrorPayload = (
  payload: unknown,
): payload is { errorCode: number; detail?: string } =>
  typeof payload === 'object' &&
  payload !== null &&
  'errorCode' in payload &&
  typeof (payload as { errorCode: unknown }).errorCode === 'number';

export const registerTuningAgent = ({
  userDataDir,
  appVersion,
  state,
  session,
  getMainWindow,
  shieldReferenceBands,
  applyingLayer,
  switchToParametricEditing,
  handleUpdate,
  notifyOutputStateChanged,
  readMicSound,
  applyMicSound,
}: IRegisterTuningAgentDeps) => {
  let notifyDoor: () => void = () => undefined;

  const flushAudioState = async (
    reason: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    if (session.activeAudioDeviceId && state.dsp) {
      session.outputDspOverrides ??= new Map();
      session.outputDspOverrides.set(session.activeAudioDeviceId, state.dsp);
    }
    let failure: string | undefined;
    const sink: TReplySink = {
      reply: (_channel, ...args) => {
        const [payload] = args;
        if (isErrorPayload(payload)) {
          failure =
            payload.detail ??
            `Engine update refused with error code ${payload.errorCode}.`;
        }
      },
    };
    await handleUpdate(sink, reason, false, true);
    if (failure) {
      return { ok: false, error: failure };
    }
    session.outputEditGeneration = (session.outputEditGeneration ?? 0) + 1;
    return { ok: true };
  };

  const controller = createTuningController({
    state,
    getEngine: () => session.audioEngine,
    getActiveOutput: () => session.activeAudioDevice,
    getPlaybackOutput: () => session.playbackAudioDevice,
    getOutputs: () => session.audioDevices ?? [],
    getMicrophones: async () => {
      const status = await readAudioEngineStatus(
        userDataDir,
        session.audioEngine,
      );
      return status.fluid.microphones ?? [];
    },
    getOpraProducts: () => getOpraProductList(),
    getOpraPreset: (productId, curveId) => getOpraPreset(productId, curveId),
    getOpraLabel: (productId, curveId) => getOpraLabel(productId, curveId),
    shieldReferenceBands,
    applyingLayer,
    switchToParametricEditing,
    flushAudioState,
    notifyOutputChanged: notifyOutputStateChanged,
    readMicSound,
    writeMicSound: applyMicSound,
    notifyMicChanged: () => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(TUNING_AGENT_CHANNELS.micSoundChanged);
      }
    },
    loadUserPresets: () => loadUserPresets(userDataDir, log),
    saveUserPresets: (presets) => saveUserPresets(userDataDir, presets),
    sampleEngineAudio: createEngineAnalysisSampler(getMainWindow),
    readLibraryAudioFrames: readDspHostAnalysisFrames,
    getNowPlaying: readNowPlaying,
    onSessionChanged: () => notifyDoor(),
  });

  const door = createTuningAgentDoor({
    userDataDir,
    getMainWindow,
    controller,
    appVersion,
    onOpenChanged: setTuningMeterHold,
    logger: log,
  });
  notifyDoor = door.notifyWindow;

  return {
    door,
    controller,
    dispose: door.dispose,
  };
};
