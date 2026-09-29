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

import { ipcMain, shell } from 'electron';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import type { IApoConfigLayer, IApoConfigTree } from '../../common/apoConfig';
import ChannelEnum from '../../common/channels';
import {
  IDeviceProfileAssignment,
  IDeviceProfileSettings,
  IPresetV2,
} from '../../common/constants';
import { ErrorCode } from '../../common/errors';
import { TSuccess } from '../../renderer/utils/equalizerApi';
import type { createApoAdoption } from '../apoAdopt';
import { readApoConfigTree } from '../apoConfigReader';
import { scheduleWrite } from '../asyncWriter';
import { isGeneratedConfigFile } from '../deviceProfileFlush';
import { runEqualizerApoSetup } from '../equalizerApoSetup';
import { fetchPreset, stateToApoFiles } from '../flush';
import type { IMainSession } from '../mainSession';
import mainText from '../mainText';
import { getConfigPath, isEqualizerAPOInstalled } from '../registry';
import type { TReplySink } from '../updatePath';
import onWindowMessage from './windowMessages';

export interface IApoConfigIpcDeps {
  session: IMainSession;
  deviceProfileSettings: IDeviceProfileSettings;
  presetDirForDevice: (deviceId: string) => string;
  readCustomFxForDevice: ReturnType<
    typeof createApoAdoption
  >['readCustomFxForDevice'];
  handleError: (
    event: TReplySink,
    channel: ChannelEnum | string,
    errorCode: ErrorCode,
    detail?: string,
  ) => void;
}

/**
 * Where Equalizer APO's own tools live — always APO's, never the session's.
 *
 * These two menu items open executables that ship inside the Equalizer APO
 * installation, so the directory they need is APO's and nothing else. Asking
 * for the session's engine sent them to `%ProgramData%\FluidEQ\engine` for a
 * user on the FluidEQ Engine — a folder with no `Editor.exe` in it, reported
 * as "the tools were not found", and CREATED by the very act of asking. The
 * installed check comes first for the same reason it does everywhere else:
 * `getConfigPath` is not a question that can be asked for free.
 */
const equalizerApoRootDir = async (): Promise<string | null> => {
  if (!(await isEqualizerAPOInstalled())) {
    return null;
  }
  return path.dirname(await getConfigPath('apo'));
};

/**
 * The engine's config as files: Equalizer APO's installer and tools, the
 * Config inspector's view of the folder, and its edits written back.
 */
const registerApoConfigIpc = ({
  session,
  deviceProfileSettings,
  presetDirForDevice,
  readCustomFxForDevice,
  handleError,
}: IApoConfigIpcDeps) => {
  onWindowMessage(ChannelEnum.INSTALL_EQUALIZER_APO, async (event) => {
    const channel = ChannelEnum.INSTALL_EQUALIZER_APO;
    try {
      // Awaited. Elevation is asked for asynchronously, so a synchronous call
      // would report success the instant the prompt appeared and could never
      // report a refusal — which is the most likely outcome of the two.
      await runEqualizerApoSetup();
      log.info('Started the Equalizer APO installer');
      event.reply(channel, { result: undefined });
    } catch (e) {
      log.error('Could not start the Equalizer APO installer', e);
      handleError(event, channel, ErrorCode.FAILURE, (e as Error).message);
    }
  });

  /**
   * Write one config file back to disk.
   *
   * Editing the config from inside the app means text out of a window ends up
   * in the audio engine's directory, so the name is checked rather than
   * trusted. It has to be one FluidEQ itself generates — the same list the
   * stale sweep uses — which rules out APO's own config.txt, its sample
   * configs, anything carrying a path, and anything at all outside that
   * directory. The contents are the user's business; the destination is not.
   *
   * Nothing is adopted back into the state. Equalizer APO reloads when a file
   * in its config directory changes, which is the same route a text editor
   * takes and makes the edit audible at once. What FluidEQ generates it will
   * generate again on the next change, and the panel says as much beside the
   * file.
   */
  onWindowMessage(ChannelEnum.WRITE_APO_CONFIG_FILE, async (event, arg) => {
    const channel = ChannelEnum.WRITE_APO_CONFIG_FILE;
    const fileName = arg?.[0];
    const contents = arg?.[1];

    if (
      typeof fileName !== 'string' ||
      typeof contents !== 'string' ||
      fileName !== path.basename(fileName) ||
      !isGeneratedConfigFile(fileName)
    ) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }

    try {
      if (!session.configPath) {
        session.configPath = await getConfigPath(session.audioEngine ?? 'apo');
      }
      // Through the writer like every other file in this folder: whole or not
      // at all (a plain write truncated first, and the engine reloading in
      // between read an empty file and played the output flat), and refused
      // once quit has sealed the folder, so a save racing the quit cannot
      // bring the EQ back after the app told the engine there is nothing to do.
      await scheduleWrite(path.join(session.configPath, fileName), contents);
      const reply: TSuccess<void> = { result: undefined };
      event.reply(channel, reply);
    } catch (e) {
      handleError(event, channel, ErrorCode.FAILURE, (e as Error).message);
    }
  });

  /**
   * Which layers an output has, and which of them the config is applying.
   *
   * The files cannot answer this on their own. A switched-off layer has no
   * file, so absence in the config is just absence: nothing there
   * distinguishes an output with no voicing from one whose voicing is switched
   * off, and the panel would simply stop showing a layer the moment somebody
   * bypassed it — which is the opposite of what a bypass switch wants to be
   * able to say. Reading the profile beside the config is the only way to
   * report "this exists, and it is off".
   *
   * Built by asking the writer what it would produce with nothing bypassed, so
   * the list is exactly the layers with something to say. A layer that is
   * empty is not switched off, it is empty, and it belongs on this list no
   * more than it belongs in the config.
   */
  const describeDeviceLayers = (
    assignment: IDeviceProfileAssignment,
  ): IApoConfigLayer[] | undefined => {
    let preset: IPresetV2;
    try {
      preset = fetchPreset(
        assignment.presetName,
        presetDirForDevice(assignment.deviceId),
      );
    } catch {
      return undefined;
    }

    const bypassed: string[] = preset.bypassed ?? [];
    const customFx = readCustomFxForDevice(assignment.deviceId);
    // Any truthy name will do: it only has to make the convolution count as
    // present, and nothing here is written to disk.
    const everything = stateToApoFiles(
      {
        isEnabled: true,
        isGraphViewOn: false,
        isCaseSensitiveFs: false,
        ...preset,
        isAutoPreAmpOn: preset.isAutoPreAmpOn ?? true,
        bypassed: undefined,
      },
      preset.convolution ? 'impulse' : undefined,
    );
    if (!everything) {
      return undefined;
    }

    return [
      ...(everything.convolution
        ? [
            {
              feature: 'convolution',
              isApplied: !bypassed.includes('convolution'),
            },
          ]
        : []),
      ...everything.features.map(({ feature }) => ({
        feature: feature as string,
        isApplied: !bypassed.includes(feature),
      })),
      ...(customFx
        ? [{ feature: 'custom', isApplied: !bypassed.includes('custom') }]
        : []),
    ];
  };

  /**
   * The config as it stands on disk, for the panel that shows it.
   *
   * Read every time rather than cached. The whole reason this view exists is
   * that the files can say something the app did not put there — a hand edit,
   * another tool, a write that failed — and a cached answer would be the app
   * telling you what it believes, which is what every other panel already
   * does.
   */
  onWindowMessage(ChannelEnum.GET_APO_CONFIG_TREE, async (event) => {
    const channel = ChannelEnum.GET_APO_CONFIG_TREE;
    try {
      if (!session.configPath) {
        session.configPath = await getConfigPath(session.audioEngine ?? 'apo');
      }
      const tree = readApoConfigTree(session.configPath);
      const reply: TSuccess<IApoConfigTree | undefined> = {
        result: tree && {
          ...tree,
          devices: tree.devices.map((device) => {
            const assignment = Object.values(
              deviceProfileSettings.assignments,
            ).find(
              (entry) =>
                (entry.deviceGuid || entry.deviceName).toLowerCase() ===
                device.devicePattern.toLowerCase(),
            );
            const layers = assignment
              ? describeDeviceLayers(assignment)
              : undefined;
            return layers ? { ...device, layers } : device;
          }),
        },
      };
      event.reply(channel, reply);
    } catch (e) {
      handleError(event, channel, ErrorCode.FAILURE, (e as Error).message);
    }
  });

  ipcMain.handle('open-equalizer-apo-configurator', async () => {
    try {
      const equalizerApoRoot = await equalizerApoRootDir();
      if (equalizerApoRoot === null) {
        return mainText('files.apo.notLocated');
      }
      const configuratorPath = ['DeviceSelector.exe', 'Configurator.exe']
        .map((fileName) => path.join(equalizerApoRoot, fileName))
        .find((candidate) => fs.existsSync(candidate));

      if (!configuratorPath) {
        return mainText('files.apo.selectorMissing');
      }

      return shell.openPath(configuratorPath);
    } catch {
      return mainText('files.apo.notLocated');
    }
  });

  ipcMain.handle('open-equalizer-apo-settings', async () => {
    try {
      const equalizerApoRoot = await equalizerApoRootDir();
      if (equalizerApoRoot === null) {
        return mainText('files.apo.notLocated');
      }
      // Equalizer APO 1.4.x renamed the old Configurator executable to Editor.
      // Keep the legacy name as a fallback for older installations.
      const settingsPath = ['Editor.exe', 'Configurator.exe']
        .map((fileName) => path.join(equalizerApoRoot, fileName))
        .find((candidate) => fs.existsSync(candidate));

      if (!settingsPath) {
        return mainText('files.apo.editorMissing');
      }

      return shell.openPath(settingsPath);
    } catch {
      return mainText('files.apo.notLocated');
    }
  });
};

export default registerApoConfigIpc;
