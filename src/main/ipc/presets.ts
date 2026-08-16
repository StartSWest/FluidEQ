/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

import { ipcMain } from 'electron';
import log from 'electron-log';
import fs from 'fs';
import {
  IDeviceProfileSettings,
  IPresetV2,
  IState,
} from '../../common/constants';
import { ErrorCode } from '../../common/errors';
import ChannelEnum from '../../common/channels';
import { isRestrictedPresetName } from '../../common/utils';
import {
  deletePreset,
  deletePresetBaseline,
  doesPresetExist,
  fetchPreset,
  fetchPresetBaseline,
  hasPresetBaseline,
  renamePreset,
  renamePresetBaseline,
  savePreset,
  savePresetBaseline,
} from '../flush';
import {
  removeAssignmentsForPreset,
  renameAssignedPreset,
  saveDeviceProfileSettings,
} from '../deviceProfiles';
import { TSuccess } from '../../renderer/utils/equalizerApi';

/**
 * The longest list in this directory, and the length is the finding.
 *
 * Every other module here needed two or four things. Profiles need fifteen,
 * and most of them are about audio devices rather than about files — attaching,
 * reserving a name for the active output, rebuilding an empty profile when the
 * attached one is deleted. That is not an accident of how this was extracted:
 * in FluidEQ a profile only means anything relative to the output it is
 * attached to, so "presets" and "devices" are one subject wearing two names.
 *
 * Left as one list rather than hidden behind a convenience object, because a
 * long parameter list that is honest is worth more than a short one that is
 * not. If these two ever merge into a `profiles` module, this is the evidence
 * for it.
 */
export interface IPresetsIpcDeps {
  state: IState;
  userDataDir: string;
  presetPath: string;
  baselinePath: string;
  deviceProfileSettings: IDeviceProfileSettings;
  /** Reassigned as the user switches output, so it is read per call. */
  getActiveAudioDeviceId: () => string;
  handleUpdate: (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    syncActiveProfile?: boolean,
    useActiveSessionOverride?: boolean,
  ) => Promise<void>;
  handleUpdateHelper: <T>(
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    response: T,
    syncActiveProfile?: boolean,
    useActiveSessionOverride?: boolean,
  ) => Promise<void>;
  handleError: (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    errorCode: ErrorCode,
    message?: string,
    action?: string,
  ) => void;
  /** Serialises profile writes, because deleting several quickly is normal. */
  runProfileMutation: (work: () => Promise<void>) => Promise<void>;
  attachPresetToActiveDevice: (presetName: string) => void;
  clearCurrentLayoutSettings: () => void;
  createEmptyProfileForActiveDevice: () => void;
  getCurrentPreset: () => IPresetV2;
  hydrateActiveConvolution: () => void;
  isAutomaticPresetName: (presetName: string) => boolean;
  reservePresetNameForActiveDevice: (presetName: string) => string;
  resetStateToDefaults: () => void;
}

/** Load, save, rename, delete, and the manually saved copy each can go back to. */
export const registerPresetsIpc = ({
  state,
  userDataDir,
  presetPath,
  baselinePath,
  deviceProfileSettings,
  getActiveAudioDeviceId,
  handleUpdate,
  handleUpdateHelper,
  handleError,
  runProfileMutation,
  attachPresetToActiveDevice,
  clearCurrentLayoutSettings,
  createEmptyProfileForActiveDevice,
  getCurrentPreset,
  hydrateActiveConvolution,
  isAutomaticPresetName,
  reservePresetNameForActiveDevice,
  resetStateToDefaults,
}: IPresetsIpcDeps) => {
  ipcMain.on(ChannelEnum.LOAD_PRESET, async (event, arg) => {
    const channel = ChannelEnum.LOAD_PRESET;
    const presetName = arg[0];
    log.info(`Loading preset: ${presetName}`);

    try {
      const presetSettings: IPresetV2 = fetchPreset(presetName, presetPath);
      clearCurrentLayoutSettings();
      state.preAmp = presetSettings.preAmp;
      state.filters = presetSettings.filters;
      state.eqFormat = presetSettings.eqFormat;
      state.graphicEq = presetSettings.graphicEq;
      state.convolution = presetSettings.convolution;
      state.isFlat = presetSettings.isFlat;
      state.voicing = presetSettings.voicing;
      state.driver = presetSettings.driver;
      state.smartEq = presetSettings.smartEq;
      state.headphone = presetSettings.headphone;
      state.headset = presetSettings.headset;
      state.headsetTarget = presetSettings.headsetTarget;
      state.headsetSource = presetSettings.headsetSource;
      state.headsetSignature = presetSettings.headsetSignature;
      state.eqImport = presetSettings.eqImport;
      // Which layers this profile has switched off comes with it, like the layers
      // themselves. Keeping the previous profile's list would silence a layer this
      // one never switched off.
      state.bypassed = presetSettings.bypassed;
      hydrateActiveConvolution();
      attachPresetToActiveDevice(presetName);
      await handleUpdate(event, channel, true);
    } catch (ex) {
      log.info('Failed to read preset: ', presetName);
      log.info(ex);
      handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
    }
  });

  /**
   * Put back the copy the user last saved by hand.
   *
   * Edits auto-save straight into the attached profile, which is convenient
   * right up until you want the version from before you started experimenting.
   * That is what the baseline is: an explicit save is the only thing that writes
   * it, so it always represents a state the user deliberately chose to keep.
   */
  ipcMain.on(ChannelEnum.RESTORE_PRESET_BASELINE, async (event, arg) => {
    const channel = ChannelEnum.RESTORE_PRESET_BASELINE;
    const presetName = arg[0] as string;
    try {
      const baseline = fetchPresetBaseline(presetName, baselinePath);
      if (!baseline) {
        handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
        return;
      }
      clearCurrentLayoutSettings();
      state.preAmp = baseline.preAmp;
      state.filters = baseline.filters;
      state.eqFormat = baseline.eqFormat;
      state.graphicEq = baseline.graphicEq;
      state.convolution = baseline.convolution;
      state.isFlat = baseline.isFlat;
      state.voicing = baseline.voicing;
      state.driver = baseline.driver;
      state.smartEq = baseline.smartEq;
      state.headphone = baseline.headphone;
      state.headset = baseline.headset;
      state.headsetTarget = baseline.headsetTarget;
      state.headsetSource = baseline.headsetSource;
      state.headsetSignature = baseline.headsetSignature;
      state.eqImport = baseline.eqImport;
      state.bypassed = baseline.bypassed;
      hydrateActiveConvolution();
      // Restoring writes the profile back to the baseline, but deliberately does
      // NOT rewrite the baseline itself — restoring twice in a row is a no-op
      // rather than a way to lose the copy.
      savePreset(presetName, getCurrentPreset(), presetPath);
      attachPresetToActiveDevice(presetName);
      await handleUpdate(event, channel, true);
    } catch (e) {
      log.info('Failed to restore the saved copy of: ', presetName);
      handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
    }
  });

  /** Which profiles have a manually saved copy to go back to. */
  ipcMain.on(ChannelEnum.GET_PRESET_BASELINE_NAMES, async (event) => {
    const channel = ChannelEnum.GET_PRESET_BASELINE_NAMES;
    try {
      const names = Object.values(deviceProfileSettings.assignments)
        .map((assignment) => assignment.presetName)
        .concat(
          fs.existsSync(presetPath)
            ? fs
                .readdirSync(presetPath)
                .filter((n) => !isAutomaticPresetName(n))
            : [],
        )
        .filter(
          (name, index, all) =>
            all.indexOf(name) === index &&
            hasPresetBaseline(name, baselinePath),
        );
      const reply: TSuccess<string[]> = { result: names };
      event.reply(channel, reply);
    } catch (e) {
      handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
    }
  });

  // Queued with the others. `reservePresetNameForActiveDevice` reads the whole
  // catalogue to pick a free name, so two saves that overlap read the same
  // catalogue and reserve the same name — the second then writes over the first.
  ipcMain.on(ChannelEnum.SAVE_PRESET, async (event, arg) => {
    const channel = ChannelEnum.SAVE_PRESET;
    const presetName = arg[0];

    await runProfileMutation(async () => {
      try {
        // Validate that the preset name is not restricted
        if (isRestrictedPresetName(presetName)) {
          handleError(event, channel, ErrorCode.INVALID_PRESET_NAME);
          return;
        }

        // Never over the top of a profile another output is using. Saving on the
        // speakers must not overwrite what the headphones are playing, however
        // similar the two names are.
        const targetName = reservePresetNameForActiveDevice(presetName);

        const preset = getCurrentPreset();
        savePreset(targetName, preset, presetPath);
        // This is the copy the user chose to keep. Later edits auto-save over the
        // profile itself, so this is the only thing left to restore from.
        savePresetBaseline(targetName, preset, baselinePath);
        attachPresetToActiveDevice(targetName);
        await handleUpdateHelper<string>(event, channel, targetName, true);
      } catch (e) {
        handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
      }
    });
  });

  // Queued, because deleting several quickly is exactly what people do and this
  // is the longest of the profile mutations. See `runProfileMutation`.
  ipcMain.on(ChannelEnum.DELETE_PRESET, async (event, arg) => {
    const channel = ChannelEnum.DELETE_PRESET;
    const presetName = arg[0];
    await runProfileMutation(async () => {
      // The name only. This used to log `path.join(presetPath, presetName)`,
      // which was an unvalidated join built purely to be printed — it looked
      // like the file being deleted and was not. The real path is resolved
      // inside `deletePreset`, which refuses anything that leaves the
      // directory; printing a second, unguarded one here invited a reader to
      // believe the check happened at the call site.
      log.info(`Deleting preset: ${presetName}`);
      try {
        const wasAttachedHere =
          deviceProfileSettings.assignments[getActiveAudioDeviceId()]
            ?.presetName === presetName;

        deletePreset(presetName, presetPath);
        deletePresetBaseline(presetName, baselinePath);
        removeAssignmentsForPreset(deviceProfileSettings, presetName);
        saveDeviceProfileSettings(deviceProfileSettings, userDataDir);

        // Deleting what this output was playing through leaves it with nothing.
        // Reset to neutral and hand it a fresh empty profile rather than leaving
        // the user on a nameless tuning they cannot save to or get back from.
        if (wasAttachedHere) {
          resetStateToDefaults();
          createEmptyProfileForActiveDevice();
        }

        await handleUpdate(event, channel);
      } catch (e) {
        handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
      }
    });
  });

  // Queued with the others: it decides a name from what exists on disk and then
  // rewrites the assignments, so a save or a delete landing between those two
  // steps is a rename applied to a catalogue that has since moved.
  ipcMain.on(ChannelEnum.RENAME_PRESET, async (event, arg) => {
    const channel = ChannelEnum.RENAME_PRESET;
    const [oldName, newName]: string[] = arg;

    // No name change - the UI should handle this scenario and should not reach the BE
    if (oldName === newName) {
      const reply: TSuccess<void> = { result: undefined };
      event.reply(channel, reply);
    }

    await runProfileMutation(async () => {
      try {
        /**
         * Validate the provided name acording to the following rules:
         * - Disallow renaming to a restricted name
         * - Disallow renaming to an existing preset name
         *
         * Note: the function doesPresetExist performs comparisons based on the file system, meaning it whether the comparison
         * is case sensitive depends on the file system settings. For case sensitive systems, the existence of a preset that
         * matches the new name exactly is guaranteed to be an invalid operation (since we already handled the case where the
         * old and new names are exactly equal). For case insensitive systems, there is an edge case where we want to allow
         * the new name to be a duplicate of an existing preset. This is the case where we are renaming a preset to change the
         * casing of the characters.
         */
        if (
          isRestrictedPresetName(newName) ||
          (doesPresetExist(newName, presetPath) &&
            (state.isCaseSensitiveFs ||
              oldName.toLocaleLowerCase() !== newName.toLocaleLowerCase()))
        ) {
          handleError(event, channel, ErrorCode.INVALID_PRESET_NAME);
          return;
        }

        renamePreset(oldName, newName, presetPath);
        renamePresetBaseline(oldName, newName, baselinePath);
        renameAssignedPreset(deviceProfileSettings, oldName, newName);
        saveDeviceProfileSettings(deviceProfileSettings, userDataDir);
        await handleUpdate(event, channel);
      } catch (e) {
        handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
      }
    });
  });

  ipcMain.on(ChannelEnum.GET_PRESET_FILE_LIST, async (event) => {
    const channel = ChannelEnum.GET_PRESET_FILE_LIST;

    try {
      const fileNames: string[] = fs
        .readdirSync(presetPath)
        .filter((fileName) => !isAutomaticPresetName(fileName));
      log.info(`Fetched ${fileNames.length} files`);
      const reply: TSuccess<string[]> = { result: fileNames };
      event.reply(channel, reply);
    } catch (e) {
      log.error('Failed to get filenames');
      log.error(e);
      handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
    }
  });
};
