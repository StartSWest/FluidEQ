/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import type { IDeviceProfileSettings, IState } from '../common/constants';
import type { IOutputDspEdit, IOutputSound } from '../common/outputSettings';
import { fetchPreset, save, savePreset } from './flush';
import type { IMainSession } from './mainSession';
import { migrateLegacyOutputDsp } from './outputSoundMigration';

export const createOutputSoundStore = (
  state: IState,
  session: IMainSession,
  assignments: IDeviceProfileSettings,
  presetDirForDevice: (deviceId: string) => string,
  userDataDir: string,
) => {
  const persist = (sound: IOutputSound): Promise<void> => {
    const assignment = assignments.assignments[session.activeAudioDeviceId];
    if (!assignment) {
      return Promise.reject(new Error('The output has no profile.'));
    }
    const dir = presetDirForDevice(assignment.deviceId);
    const next = { ...fetchPreset(assignment.presetName, dir), ...sound };
    Object.assign(state, sound);
    if (session.outputStateOverrides?.has(session.activeAudioDeviceId)) {
      session.outputStateOverrides.set(
        session.activeAudioDeviceId,
        structuredClone(state),
      );
    }
    // Capture both destination and contents before the writer yields; changing
    // editor meanwhile cannot redirect this save to the new output.
    return Promise.all([
      savePreset(assignment.presetName, next, dir, 'output-sound'),
      save(state, userDataDir),
    ]).then(() => undefined);
  };

  const saveDsp = async (edit: IOutputDspEdit): Promise<void> => {
    if (
      edit.deviceId !== session.activeAudioDeviceId ||
      edit.generation !== (session.outputEditGeneration ?? 0)
    ) {
      return;
    }
    const own = edit.savedSettings ?? edit.settings;
    // Old builds kept one rack. Copy its value once into profiles without a
    // rack so upgrading keeps their sound without leaving a live global link.
    const migration =
      edit.legacySettings !== undefined
        ? migrateLegacyOutputDsp(userDataDir, edit.legacySettings)
        : Promise.resolve();
    session.outputDspOverrides ??= new Map();
    session.outputDspOverrides.set(edit.deviceId, edit.settings);
    const saved = persist({ dsp: own });
    await Promise.all([migration, saved]);
  };
  return { persist, saveDsp };
};
