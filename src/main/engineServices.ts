/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import log from 'electron-log';
import fs from 'fs';
import type { TAudioEngine } from '../common/audioEngine';
import { IDeviceProfileSettings, IState } from '../common/constants';
import {
  createApoGuard,
  isApoOnAnyOutput,
  isApoSwitchedOff,
} from './apoSwitchOff';
import {
  loadAudioEnginePreference,
  migrateAudioEnginePreference,
  saveAudioEnginePreference,
} from './audioEngineStore';
import { createAutomaticSetup } from './automaticSetup';
import { createEngineLoadRepair } from './engineLoadRepair';
import neutraliseEngine from './engineNeutralise';
import { createEngineOutputRepair } from './engineOutputRepair';
import { runEngineSetup } from './engineSetup';
import { readAudioEngineStatus } from './engineStatus';
import { registerAudioEngineIpc, TReflushResult } from './ipc/audioEngine';
import { registerCurveComparisonIpc } from './ipc/curveComparison';
import { registerTrebleDesignIpc } from './ipc/trebleDesign';
import type { IMainSession } from './mainSession';
import {
  forgetApoInstall,
  getConfigPath,
  getFluidEngineDllPath,
  isEngineInstalled,
  isEqualizerAPOInstalled,
} from './registry';
import {
  writeSystemDspChain,
  writeLegacySystemDspChain,
} from './systemDspChain';
import { createOutputSoundStore } from './outputSoundStore';
import { getStateForAudioDevice } from './deviceProfiles';
import { flushOutputDsp } from './outputDsp';

/**
 * Which engine this launch writes to, before anything can ask for a config
 * directory.
 *
 * Asked once the app is ready rather than at module scope because the answer
 * needs a registry probe, and before the window because the first thing the
 * renderer does is a health check — which is the first flush of the launch and
 * must already know where to write.
 *
 * The rule itself lives in `migrateAudioEnginePreference`, where it can be
 * held to all four of its cells; this is the machine it is asked about. The
 * probes are only run when the file has no answer — a recorded preference is
 * obeyed whatever the machine looks like.
 */
export const chooseLaunchEngine = async (
  userDataDir: string,
): Promise<TAudioEngine | null> => {
  const enginePreference = loadAudioEnginePreference(userDataDir);
  const isWindows = process.platform === 'win32';
  const unanswered = enginePreference.engine === null && isWindows;
  const migration = migrateAudioEnginePreference(enginePreference, {
    isWindows,
    apoInstalled: unanswered ? await isEqualizerAPOInstalled() : false,
    fluidInstalled: unanswered && fs.existsSync(getFluidEngineDllPath()),
  });
  if (migration.persist && migration.engine !== null) {
    try {
      saveAudioEnginePreference(userDataDir, migration.engine);
    } catch (error) {
      // A read-only or full %APPDATA% must not take the launch down with it.
      // This write only settles the question for NEXT time; the answer for
      // this session is the one returned, and letting the throw escape would
      // abort the rest of `onAppReady` — no window, no tray, no message, on a
      // machine where nothing is actually wrong with the audio.
      log.error(
        'Could not record the migrated audio engine preference',
        userDataDir,
        error,
      );
    }
  }
  return migration.engine;
};

export interface IEngineServicesDeps {
  userDataDir: string;
  state: IState;
  session: IMainSession;
  deviceProfileSettings: IDeviceProfileSettings;
  presetDirForDevice: (deviceId: string) => string;
  /** Rewrites the current state into whichever engine is chosen now. */
  reflush: () => Promise<TReflushResult>;
  /** A switch of engine finished — `IAudioEngineIpcDeps.onSwitched`. */
  onEngineSwitched: () => void;
}

/**
 * The engine the session writes to: switching it, repairing it, and the two
 * things the window asks of the FluidEQ Engine's folder alone.
 */
export const registerEngineServices = ({
  userDataDir,
  state,
  session,
  deviceProfileSettings,
  presetDirForDevice,
  reflush,
  onEngineSwitched,
}: IEngineServicesDeps) => {
  const outputSound = createOutputSoundStore(
    state,
    session,
    deviceProfileSettings,
    presetDirForDevice,
    userDataDir,
  );
  const flushOutputSound = async () => {
    const result = await reflush();
    if (!result.ok) {
      throw new Error('Could not apply the output sound.');
    }
  };
  /**
   * The one gate every automatic elevated run passes through: the two halves
   * of the Equalizer APO switch-off and both engine repairs, so no two of them
   * put two Windows prompts up for one thing (`automaticSetup.ts`).
   */
  const automaticSetup = createAutomaticSetup();

  /**
   * One engine in Windows' effect lists, kept that way for the whole session —
   * see `createApoGuard`. Fed by the device list, re-read on every output
   * change Windows reports and whenever the window is come back to, so
   * Equalizer APO's Device Selector being run while FluidEQ is open is noticed
   * on the way back from it.
   */
  const apoGuard = createApoGuard({
    getEngine: () => session.audioEngine,
    runEngineSetup,
    automatic: automaticSetup,
  });

  registerCurveComparisonIpc({
    state,
    getEngine: () => session.audioEngine,
    getStatus: () => readAudioEngineStatus(userDataDir, session.audioEngine),
    getConfigPath: () => getConfigPath('fluid'),
    isSwitching: () => session.engineSwitching,
    getOutputGuid: () => session.activeAudioDevice?.guid,
    persist: outputSound.persist,
    getEditGeneration: () => session.outputEditGeneration ?? 0,
    flush: flushOutputSound,
  });

  registerTrebleDesignIpc({
    state,
    getOutputGuid: () => session.activeAudioDevice?.guid,
    persist: outputSound.persist,
    getEditGeneration: () => session.outputEditGeneration ?? 0,
    flush: flushOutputSound,
    getEngine: () => session.audioEngine,
    getConfigPath: () => getConfigPath('fluid'),
  });

  registerAudioEngineIpc({
    userDataDir,
    getEngine: () => session.audioEngine,
    setEngine: (engine) => {
      session.audioEngine = engine;
      // The cached directory belongs to the engine being left. Kept, it would
      // send the next flush — the reflush this switch is about to run — into
      // the folder the app has just finished neutralising.
      session.configPath = '';
      // And Equalizer APO's installation is asked of the registry again: the
      // session keeps it between switches (`registry.ts`), and a switch is
      // where somebody who has just installed or moved it comes back to it.
      forgetApoInstall();
    },
    setSwitching: (isSwitching) => {
      session.engineSwitching = isSwitching;
    },
    isSwitching: () => session.engineSwitching,
    getConfigPath,
    isEngineInstalled,
    reflush,
    runEngineSetup,
    readAudioEngineStatus,
    neutraliseEngine: (other) =>
      neutraliseEngine(other, deviceProfileSettings, presetDirForDevice),
    writeSystemDspChain,
    writeLegacySystemDspChain,
    getDspTarget: () =>
      session.activeAudioDevice
        ? {
            device: session.activeAudioDevice,
            generation: session.outputEditGeneration ?? 0,
          }
        : undefined,
    getPlaybackGuid: () => session.playbackAudioDevice?.guid,
    saveOutputDsp: outputSound.saveDsp,
    isOutputDspCurrent: (edit) =>
      session.outputDspOverrides?.get(edit.deviceId) === edit.settings,
    writeOutputDsp: (configDirPath, edit) => {
      const device =
        session.audioDevices?.find((entry) => entry.id === edit.deviceId) ??
        (session.activeAudioDevice?.id === edit.deviceId
          ? session.activeAudioDevice
          : undefined);
      if (!device) {
        return Promise.reject(new Error('The output is no longer available.'));
      }
      const outputState =
        session.activeAudioDeviceId === edit.deviceId
          ? state
          : (session.outputStateOverrides?.get(edit.deviceId) ??
            getStateForAudioDevice(
              deviceProfileSettings,
              edit.deviceId,
              presetDirForDevice,
            ));
      const assignment = deviceProfileSettings.assignments[edit.deviceId];
      return flushOutputDsp({
        configDirPath,
        settings: {
          ...deviceProfileSettings,
          assignments: assignment ? { [edit.deviceId]: assignment } : {},
        },
        presetDirForDevice,
        outputs: [device],
        activeOverride: {
          deviceId: device.id,
          devicePattern: device.guid,
          state: structuredClone(outputState),
        },
        isEnabled: state.isEnabled,
        dspOverrides: new Map([[edit.deviceId, edit.settings]]),
        stateOverrides: session.outputStateOverrides,
        systemRackEnabled: session.systemRackEnabled,
      });
    },
    isApoOnAnyOutput,
    isApoSwitchedOff,
    repairEngineLoading: createEngineLoadRepair({
      getEngine: () => session.audioEngine,
      runEngineSetup,
      automatic: automaticSetup,
    }).check,
    repairEngineOutput: createEngineOutputRepair({
      getEngine: () => session.audioEngine,
      readStatus: () => readAudioEngineStatus(userDataDir, session.audioEngine),
      runEngineSetup,
      automatic: automaticSetup,
    }).repair,
    automatic: automaticSetup,
    onSwitched: onEngineSwitched,
  });

  return { apoGuard };
};
